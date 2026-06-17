// Host-side harness: boots workerd (via miniflare) with a module fallback
// service that resolves the worker's imports against real node_modules on
// disk, applying aliases (esbuild -> esbuild-wasm shim, rollup -> wasm-node)
// and source rewrites (import.meta.url, WebAssembly.Module under UnsafeEval).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { init as cjsLexerInit, parse as cjsLexer } from "cjs-module-lexer";
import enhancedResolve from "enhanced-resolve";

await cjsLexerInit();
import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
// Target app selectable via SPIKE_APP_DIR (relative paths resolve against the
// harness dir); default is the Vite 8 + Tailwind demo app in ../app.
const APP_DIR = path.resolve(HARNESS_DIR, process.env.SPIKE_APP_DIR ?? "../app");

// virtual path <-> host path mapping
const MOUNTS = [
  { virt: "/tmp/app", host: APP_DIR },
  { virt: "/tmp/xnm", host: path.join(HARNESS_DIR, "node_modules") },
  { virt: "/tmp/shims", host: path.join(HARNESS_DIR, "shims") },
];
export function virt2host(p) {
  for (const m of MOUNTS) if (p === m.virt || p.startsWith(m.virt + "/")) return m.host + p.slice(m.virt.length);
  return null;
}
export function host2virt(p) {
  for (const m of MOUNTS) if (p === m.host || p.startsWith(m.host + "/")) return m.virt + p.slice(m.host.length);
  return null;
}

const importResolver = enhancedResolve.create.sync({
  conditionNames: ["node", "import", "default"],
  extensions: [".js", ".mjs", ".cjs", ".json"],
  mainFields: ["module", "main"],
});
const requireResolver = enhancedResolve.create.sync({
  conditionNames: ["node", "require", "default"],
  extensions: [".js", ".cjs", ".json"],
  mainFields: ["main"],
});

// alias values: absolute file path, a package name resolved from the harness
// node_modules (subpaths preserved), or "404" to hard-fail the import
const ALIASES = {
  esbuild: path.join(HARNESS_DIR, "shims/esbuild.mjs"),
  rollup: "@rollup/wasm-node",
  rolldown: "rolldown",
  fsevents: "404",
  lightningcss: "lightningcss-wasm",
};
const hostRequire = createRequire(path.join(HARNESS_DIR, "package.json"));

function pkgTypeIsModule(file) {
  let dir = path.dirname(file);
  while (dir.length > 1) {
    const pj = path.join(dir, "package.json");
    if (existsSync(pj)) {
      try { return JSON.parse(readFileSync(pj, "utf8")).type === "module"; } catch { return false; }
    }
    dir = path.dirname(dir);
  }
  return false;
}

function rewriteSource(src, virtPath, format) {
  // workerd gives import.meta.url === undefined; bake in a file URL.
  // Quote-guarded so string literals like "import.meta.url" in vite's own
  // source (client-code injection sites) survive untouched.
  src = src.replace(/(?<!["'`\\])\bimport\.meta\.url\b(?!["'`])/g, JSON.stringify("file://" + virtPath));
  src = src.replace(/(?<!["'`\\])\bimport\.meta\.dirname\b(?!["'`])/g, JSON.stringify(path.dirname(virtPath)));
  src = src.replace(/(?<!["'`\\])\bimport\.meta\.filename\b(?!["'`])/g, JSON.stringify(virtPath));
  if (format === "cjs") {
    // workerd CJS may not define __dirname/__filename
    src = `const __filename = ${JSON.stringify(virtPath)}, __dirname = ${JSON.stringify(path.dirname(virtPath))};\n` + src;
  }
  // runtime wasm compilation is blocked; route through UnsafeEval binding
  src = src.replaceAll("new WebAssembly.Module(", "globalThis.__UNSAFE_EVAL.newWasmModule(");
  src = src.replaceAll("WebAssembly.compile(", "globalThis.__wasmCompile(");
  // bare eval / new Function are code-generation, also blocked outside UnsafeEval
  // (es-module-lexer unescapes import specifiers via `(0,eval)(str)`)
  src = src.replaceAll("(0,eval)", "(globalThis.__safeEval)");
  src = src.replaceAll("(0, eval)", "(globalThis.__safeEval)");
  src = src.replaceAll("new Function(", "globalThis.__newFunction(");
  // postcss-load-config's `req` helper does
  //   createRequire(rootFile).resolve(name)            (workerd require() has no .resolve)
  //   import(`${pathToFileURL(url)}?t=${Date.now()}`)  (workerd can't import file:// URLs / query strings)
  // Route resolution through a worker-side helper and import the virtual path
  // (or bare specifier) directly — the module fallback service resolves it.
  src = src.replace(/createRequire[\w$]*\(([\w$]+)\)\.resolve\(/g, "globalThis.__requireResolve($1, ");
  src = src.replace(/`\$\{pathToFileURL[\w$]*\(([\w$]+)\)\}\?t=\$\{Date\.now\(\)\}`/g, "$1");
  // workerd's node:fs VFS is per-request; swap fs imports for the in-heap
  // memfs shim. Only rewrite import/require sites, not arbitrary strings
  // (vite keeps builtin-name string lists that must stay intact).
  // `__require(` covers rolldown/tsdown-style CJS-interop helpers: vite's own
  // chunks wrap bundled deps (lilconfig, postcss-load-config, ...) with
  // `const fs = __require("fs")`, which otherwise reaches workerd's real
  // (empty, per-request) node:fs and silently finds no postcss config.
  const importSite = (spec, target) =>
    new RegExp(String.raw`(\bfrom\s*|\bimport\s*\(\s*|\b__require\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])${spec.replace(/[/\\]/g, "\\$&")}\2`, "gm");
  for (const [spec, target] of [
    ["node:fs/promises", "/tmp/shims/fs-promises.mjs"],
    ["node:fs", "/tmp/shims/fs.mjs"],
    ["fs/promises", "/tmp/shims/fs-promises.mjs"],
    ["fs", "/tmp/shims/fs.mjs"],
  ]) {
    src = src.replace(importSite(spec, target), (m, lead, q) => `${lead}${q}${target}${q}`);
  }
  return src;
}

const served = new Map(); // virtPath -> bytes served (stats)
let fallbackCount = 0;

export function moduleFallback(request) {
  fallbackCount++;
  const url = new URL(request.url);
  const method = request.headers.get("X-Resolve-Method") ?? "import";
  const specifier = url.searchParams.get("specifier") ?? "";
  const rawSpecifier = url.searchParams.get("rawSpecifier") ?? specifier;
  const referrer = url.searchParams.get("referrer") ?? "";
  const verbose = process.env.FALLBACK_VERBOSE === "1";
  if (verbose) console.log(`[fallback] ${method} raw=${rawSpecifier} spec=${specifier} ref=${referrer}`);

  try {
    // fs goes to the in-heap memfs shim (workerd's VFS is per-request)
    if (rawSpecifier === "fs" || rawSpecifier === "node:fs") {
      return new MfResponse(null, { status: 301, headers: { Location: "/tmp/shims/fs.mjs" } });
    }
    if (rawSpecifier === "fs/promises" || rawSpecifier === "node:fs/promises") {
      return new MfResponse(null, { status: 301, headers: { Location: "/tmp/shims/fs-promises.mjs" } });
    }
    // rolldown's non-browser chunks import the node WASI binding directly;
    // route every reference to the patched single-threaded browser binding
    if (specifier.endsWith("/rolldown-binding.wasi.cjs") || rawSpecifier.endsWith("/rolldown-binding.wasi.cjs")) {
      const dir = path.dirname(specifier.endsWith(".cjs") ? specifier : "/tmp/xnm/rolldown/dist/x");
      return new MfResponse(null, { status: 301, headers: { Location: dir + "/rolldown-binding.wasi-browser.js" } });
    }
    // node builtins that sneak through without the node: prefix
    if (/^(path|url|util|os|module|crypto|events|stream|buffer|assert|zlib|querystring|http|https|net|tls|child_process|worker_threads|perf_hooks|readline|tty|v8|vm|string_decoder|constants|process|async_hooks|dns|inspector)(\/|$)/.test(rawSpecifier)) {
      return new MfResponse(null, { status: 301, headers: { Location: "node:" + rawSpecifier } });
    }

    let hostResolved;
    const isBare = !rawSpecifier.startsWith("./") && !rawSpecifier.startsWith("../") && !rawSpecifier.startsWith("/");
    if (rawSpecifier.startsWith("#")) {
      // package "imports" (hash) specifier — resolve relative to the referrer's package
      const refHost = virt2host(referrer);
      if (!refHost) return new MfResponse("hash specifier outside mounts", { status: 404 });
      hostResolved = resolveFrom(path.dirname(refHost), rawSpecifier, method);
    } else if (isBare) {
      const baseName = rawSpecifier.split("/")[0].startsWith("@") ? rawSpecifier.split("/").slice(0, 2).join("/") : rawSpecifier.split("/")[0];
      if (ALIASES[baseName] === "404") return new MfResponse("not found", { status: 404 });
      let target = rawSpecifier;
      if (ALIASES[baseName]) {
        const rest = rawSpecifier.slice(baseName.length);
        const aliasBase = ALIASES[baseName];
        hostResolved = path.isAbsolute(aliasBase)
          ? aliasBase
          : resolveFrom(HARNESS_DIR, aliasBase + rest, method);
      } else {
        const refHost = virt2host(referrer) ?? path.join(APP_DIR, "package.json");
        try {
          hostResolved = resolveFrom(path.dirname(refHost), target, method);
        } catch (e) {
          hostResolved = resolveFrom(HARNESS_DIR, target, method);
        }
      }
    } else {
      // workerd already joined relative specifiers onto the referrer
      const hostPath = virt2host(specifier);
      if (!hostPath) return new MfResponse("outside mounts: " + specifier, { status: 404 });
      hostResolved = resolveExact(hostPath, method);
    }

    if (!hostResolved) return new MfResponse("unresolved: " + rawSpecifier, { status: 404 });
    const virtResolved = host2virt(hostResolved);
    if (!virtResolved) return new MfResponse("resolved outside mounts: " + hostResolved, { status: 404 });

    if (virtResolved !== specifier) {
      if (verbose) console.log(`[fallback]   -> 301 ${virtResolved}`);
      return new MfResponse(null, { status: 301, headers: { Location: virtResolved } });
    }

    const ext = path.extname(hostResolved);
    if (ext === ".json") {
      const raw = readFileSync(hostResolved, "utf8");
      let named = [];
      try { named = Object.keys(JSON.parse(raw)).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k)); } catch {}
      const body = JSON.stringify({ name: specifier.slice(1), commonJsModule: "module.exports = " + raw + ";", namedExports: named });
      return new MfResponse(body, { headers: { "content-type": "application/json" } });
    }
    if (ext === ".wasm" || ext === ".node") {
      return new MfResponse("binary modules not served as modules", { status: 404 });
    }
    let src = readFileSync(hostResolved, "utf8");
    let format;
    if (ext === ".mjs") format = "esm";
    else if (ext === ".cjs") format = "cjs";
    else if (pkgTypeIsModule(hostResolved)) format = "esm";
    // packages without type:module sometimes ship untyped ESM (e.g. esbuild-wasm/esm)
    else if (/^\s*(export\s+(default|const|let|var|function|class|\{|\*)|import[\s{"'])/m.test(src) && !/(?<![.\w$])(module\.exports|exports\.[A-Za-z_$])/.test(src)) format = "esm";
    else format = "cjs";
    src = rewriteSource(src, virtResolved, format);
    served.set(virtResolved, src.length);
    let mod;
    if (format === "esm") mod = { esModule: src };
    else {
      let named = [];
      try {
        const lexed = cjsLexer(src);
        named = [...lexed.exports];
        // one level of `module.exports = require(...)`-style re-exports
        for (const re of lexed.reexports) {
          try {
            const reHost = resolveFrom(path.dirname(hostResolved), re, "require");
            named.push(...cjsLexer(readFileSync(reHost, "utf8")).exports);
          } catch {}
        }
      } catch {}
      named = [...new Set(named)].filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && n !== "default");
      mod = { commonJsModule: src, namedExports: named };
    }
    // workerd expects the module name WITHOUT a leading slash
    const body = JSON.stringify({ name: specifier.replace(/^\//, ""), ...mod });
    if (verbose) console.log(`[fallback]   -> 200 ${format} ${src.length}b`);
    return new MfResponse(body, { headers: { "content-type": "application/json" } });
  } catch (e) {
    if (verbose || process.env.FALLBACK_ERRORS !== "0") console.log(`[fallback] ERROR ${rawSpecifier} from ${referrer}: ${e.message}`);
    return new MfResponse(String(e), { status: 404 });
  }
}

function resolveFrom(dir, spec, method) {
  const r = method === "require" ? requireResolver : importResolver;
  try { return r(dir, spec); } catch (e) {
    // dual-package fallback: try the other condition set
    const alt = method === "require" ? importResolver : requireResolver;
    return alt(dir, spec);
  }
}

function resolveExact(hostPath, method) {
  if (existsSync(hostPath) && statSync(hostPath).isFile()) return hostPath;
  return resolveFrom(path.dirname(hostPath), "./" + path.basename(hostPath), method);
}

// ---- VFS manifest: files the worker copies into workerd's node:fs ----
// Browser-facing dep packages must have their trees in the VFS: vite's
// resolver, the esbuild dep optimizer and rollup all read them via fs (memfs).
// `optional` packages are skipped silently when the target app lacks them.
const APP_DEP_PACKAGES = [
  // base (stock react-ts template)
  { name: "react" },
  { name: "react-dom" },
  { name: "scheduler" },
  { name: "react-refresh" },
  // modern-app extras (app-modern; absent in app7)
  { name: "react-router", optional: true },
  { name: "cookie", optional: true }, // react-router runtime dep
  { name: "set-cookie-parser", optional: true }, // react-router runtime dep
  { name: "@tanstack/react-query", optional: true },
  { name: "@tanstack/query-core", optional: true },
  // tailwind reads files from its own package dir at runtime (css/preflight.css)
  { name: "tailwindcss", optional: true },
];

const VFS_INCLUDE = [
  // the app itself
  { host: APP_DIR, virt: "/tmp/app", filter: (p) => !p.includes("node_modules") && !p.includes("/dist/") && !p.endsWith("/dist") },
  // runtime deps resolved by vite via fs
  ...APP_DEP_PACKAGES.map(({ name, optional }) => ({
    host: path.join(APP_DIR, "node_modules", name),
    virt: "/tmp/app/node_modules/" + name,
    optional,
  })),
  // vite's client runtime + package.json (read via fs at serve/build time)
  { host: path.join(APP_DIR, "node_modules/vite/dist/client"), virt: "/tmp/app/node_modules/vite/dist/client" },
  { host: path.join(APP_DIR, "node_modules/vite/package.json"), virt: "/tmp/app/node_modules/vite/package.json" },
  { host: path.join(APP_DIR, "node_modules/vite/index.cjs"), virt: "/tmp/app/node_modules/vite/index.cjs" },
  // rollup wasm binary, read by the (aliased) bindings loader via fs
  { host: path.join(HARNESS_DIR, "node_modules/@rollup/wasm-node/dist/wasm-node/bindings_wasm_bg.wasm"), virt: "/tmp/xnm/@rollup/wasm-node/dist/wasm-node/bindings_wasm_bg.wasm" },
  // lightningcss wasm, read via fs by the (aliased) wasm-node.mjs loader
  { host: path.join(HARNESS_DIR, "node_modules/lightningcss-wasm/lightningcss_node.wasm"), virt: "/tmp/xnm/lightningcss-wasm/lightningcss_node.wasm", optional: true },
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) yield p;
  }
}

export function buildManifest() {
  const files = {};
  for (const inc of VFS_INCLUDE) {
    if (!existsSync(inc.host)) { if (!inc.optional) console.warn("[manifest] missing:", inc.host); continue; }
    if (statSync(inc.host).isFile()) {
      files[inc.virt] = readFileSync(inc.host).toString("base64");
      continue;
    }
    for (const f of walk(inc.host)) {
      if (inc.filter && !inc.filter(f)) continue;
      const virt = inc.virt + f.slice(inc.host.length);
      files[virt] = readFileSync(f).toString("base64");
    }
  }
  return files;
}

// ---- host service binding: serves the manifest + esbuild wasm to the worker ----
async function hostService(request) {
  const url = new URL(request.url);
  if (url.pathname === "/manifest") {
    const m = buildManifest();
    const bytes = Object.values(m).reduce((a, b) => a + b.length, 0);
    console.log(`[host] manifest: ${Object.keys(m).length} files, ~${(bytes * 0.75 / 1024 / 1024).toFixed(1)} MB`);
    return new MfResponse(JSON.stringify(m), { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/rolldown.wasm") {
    const p = process.env.ROLLDOWN_WASM ?? path.resolve(HARNESS_DIR, "../rolldown-fork/target/wasm32-wasip1/release-wasi/rolldown_binding.stripped.wasm");
    return new MfResponse(readFileSync(p), { headers: { "content-type": "application/wasm" } });
  }
  if (url.pathname === "/esbuild.wasm") {
    const p = hostRequire.resolve("esbuild-wasm/esbuild.wasm");
    return new MfResponse(readFileSync(p), { headers: { "content-type": "application/wasm" } });
  }
  return new MfResponse("not found", { status: 404 });
}

export async function createHarness({ verboseLog = false, port, host } = {}) {
  const mf = new Miniflare({
    log: new Log(verboseLog ? LogLevel.DEBUG : LogLevel.INFO),
    // When `port` is given, workerd listens on a real socket so a browser can
    // hit the in-isolate vite dev server directly (run-dev.mjs). Omitted for
    // the build/verify scripts, which talk to the isolate via dispatchFetch.
    ...(port != null ? { port, host: host ?? "127.0.0.1" } : {}),
    modules: [
      { type: "ESModule", path: "worker/driver.mjs" },
      { type: "CompiledWasm", path: "worker/rolldown.wasm" },
    ],
    modulesRoot: ".",
    compatibilityDate: "2026-06-01",
    compatibilityFlags: ["nodejs_compat", "experimental"],
    unsafeEvalBinding: "UNSAFE_EVAL",
    unsafeUseModuleFallbackService: true,
    unsafeModuleFallbackService: moduleFallback,
    serviceBindings: { HOST: hostService },
    // This demo targets Vite 8 (Rolldown), so the VITE8 code path is on by
    // default; set SPIKE_VITE8=0 to fall back to the Vite 7 path.
    bindings: { VITE8: process.env.SPIKE_VITE8 === "0" ? "" : "1", RD_LOG: process.env.RD_LOG ?? "" },
  });
  return { mf, stats: () => ({ fallbackCount, servedModules: served.size }) };
}
