// workerd-bash host harness: ONE miniflare + ONE Durable Object that owns a
// shared NATIVE /tmp inside a v8 isolate (the workerd fork's VFS). The DO runs
// just-bash as the interactive shell, and registers `npm install`, `scaffold`,
// `vite build`, and `vite dev` as shell commands. The REPL (repl.mjs) drives it.
//
// This file is the module-fallback service: it resolves the TOP-LEVEL worker's
// (the DO's) imports against real node_modules on disk. Three roots are mounted:
//   /tmp/xnm    -> npm-in-workerd/node_modules   (npm + arborist + miniflare deps)
//   /tmp/jbnm   -> harness/node_modules          (just-bash + its deps)
//   /tmp/shims  -> do-native-fs/shims            (process.cjs / npmcli-agent.cjs)
// Bare specifiers resolve against the npm root first, the just-bash root second.
// The vite-dev / vite-build CHILD isolates do NOT use this service — they use the
// fork's `vfsModuleFallback` to import vite/rolldown directly from the DO's own
// /tmp/proj/node_modules (the registry-installed tree). All the workerd
// source-rewrite workarounds (process shim, eval/Function/WASM rewrites, the tar
// sync-extract hack that makes npm install work over native fs) are kept verbatim
// from do-shell/shell-host.mjs + do-machine-clean/host-do.mjs.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { init as cjsLexerInit, parse as cjsLexer } from "cjs-module-lexer";
import enhancedResolve from "enhanced-resolve";
import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

await cjsLexerInit();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");          // vite-workerd-demo
const NPM_NM = path.resolve(HERE, "..", "node_modules");     // npm-in-workerd/node_modules
const JB_NM = path.join(REPO, "harness", "node_modules");    // just-bash + deps
const SHIMS = path.resolve(HERE, "..", "do-native-fs", "shims"); // process.cjs / npmcli-agent.cjs
const BASHSHIM = path.join(HERE, "worker"); // bash-native.mjs (the NativeFsAdapter)

const MOUNTS = [
  { virt: "/tmp/xnm", host: NPM_NM },
  { virt: "/tmp/jbnm", host: JB_NM },
  { virt: "/tmp/shims", host: SHIMS },
  { virt: "/tmp/bashshim", host: BASHSHIM },
];
const BARE_ROOTS = [NPM_NM, JB_NM];

function virt2host(p) {
  for (const m of MOUNTS) if (p === m.virt || p.startsWith(m.virt + "/")) return m.host + p.slice(m.virt.length);
  return null;
}
function host2virt(p) {
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
function resolveFrom(dir, spec, method) {
  const r = method === "require" ? requireResolver : importResolver;
  try { return r(dir, spec); } catch {
    const alt = method === "require" ? importResolver : requireResolver;
    return alt(dir, spec);
  }
}
function resolveExact(hostPath, method) {
  if (existsSync(hostPath) && statSync(hostPath).isFile()) return hostPath;
  return resolveFrom(path.dirname(hostPath), "./" + path.basename(hostPath), method);
}

const ALIASES = {
  fsevents: "404",
  "@npmcli/agent": path.join(SHIMS, "npmcli-agent.cjs"),
};

function pkgTypeIsModule(file) {
  let dir = path.dirname(file);
  while (dir.length > 1) {
    const pj = path.join(dir, "package.json");
    if (existsSync(pj)) { try { return JSON.parse(readFileSync(pj, "utf8")).type === "module"; } catch { return false; } }
    dir = path.dirname(dir);
  }
  return false;
}

function rewriteSource(src, virtPath, format) {
  src = src.replace(/(?<!["'`\\])\bimport\.meta\.url\b(?!["'`])/g, JSON.stringify("file://" + virtPath));
  src = src.replace(/(?<!["'`\\])\bimport\.meta\.dirname\b(?!["'`])/g, JSON.stringify(path.dirname(virtPath)));
  src = src.replace(/(?<!["'`\\])\bimport\.meta\.filename\b(?!["'`])/g, JSON.stringify(virtPath));
  if (format === "cjs") {
    src = `const __filename = ${JSON.stringify(virtPath)}, __dirname = ${JSON.stringify(path.dirname(virtPath))};\n` + src;
  }
  src = src.replaceAll("new WebAssembly.Module(", "globalThis.__UNSAFE_EVAL.newWasmModule(");
  src = src.replaceAll("WebAssembly.compile(", "globalThis.__wasmCompile(");
  src = src.replaceAll("(0,eval)", "(globalThis.__safeEval)");
  src = src.replaceAll("(0, eval)", "(globalThis.__safeEval)");
  src = src.replaceAll("new Function(", "globalThis.__newFunction(");

  // tar sync-extract workaround (npm install over native fs) — see do-machine-clean.
  if (virtPath.endsWith("/pacote/lib/fetcher.js")) {
    src = src.replace(
`  #extract (dest, tarball) {
    const extractor = tar.x(this.#tarxOptions({ cwd: dest }))
    const p = new Promise((resolve, reject) => {
      extractor.on('end', () => {
        resolve({
          resolved: this.resolved,
          integrity: this.integrity && String(this.integrity),
          from: this.from,
        })
      })

      extractor.on('error', er => {
        log.warn('tar', er.message)
        log.silly('tar', er)
        reject(er)
      })

      tarball.on('error', er => reject(er))
    })

    tarball.pipe(extractor)
    return p
  }`,
`  #extract (dest, tarball) {
    return new Promise((resolve, reject) => {
      const chunks = []
      tarball.on('data', c => chunks.push(Buffer.from(c)))
      tarball.on('error', er => reject(er))
      tarball.on('end', () => {
        try {
          const buf = Buffer.concat(chunks)
          tar.x({ ...this.#tarxOptions({ cwd: dest }), sync: true }).end(buf)
          resolve({ resolved: this.resolved, integrity: this.integrity && String(this.integrity), from: this.from })
        } catch (er) { log.warn('tar', er.message); log.silly('tar', er); reject(er) }
      })
    })
  }`);
  }

  // route node:process / process to the shim (require('node:process') segfaults workerd)
  const importSite = (spec) =>
    new RegExp(String.raw`(\bfrom\s*|\bimport\s*\(\s*|\b__require\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])${spec.replace(/[/\\]/g, "\\$&")}\2`, "gm");
  // Don't rewrite specifiers inside our own shims (they intentionally require the real
  // builtins — rewriting would create a self-referential loop).
  if (!virtPath.startsWith("/tmp/shims/")) {
    for (const [spec, target] of [
      ["node:process", "/tmp/shims/process.cjs"], ["process", "/tmp/shims/process.cjs"],
      // workerd resolves node builtins internally (never via the fallback) and its native
      // child_process.spawn throws; rewrite the specifier to a shim that maps spawn() onto
      // an isolate-spawn over /tmp (globalThis.__ISOLATE_SPAWN). Lets real `npm create/exec` run.
      ["node:child_process", "/tmp/shims/child_process.cjs"], ["child_process", "/tmp/shims/child_process.cjs"],
      // workerd's v8.getHeapStatistics().heap_size_limit is 0, so Arborist's PackumentCache
      // builds an lru-cache with maxSize:0 and throws. Shim supplies a sane heap limit so the
      // REAL npm install runs.
      ["node:v8", "/tmp/shims/v8.cjs"], ["v8", "/tmp/shims/v8.cjs"],
    ]) {
      src = src.replace(importSite(spec), (m, lead, q) => `${lead}${q}${target}${q}`);
    }
  }
  return src;
}

const served = new Map();
let fallbackCount = 0;

function moduleFallback(request) {
  fallbackCount++;
  const url = new URL(request.url);
  const method = request.headers.get("X-Resolve-Method") ?? "import";
  const specifier = url.searchParams.get("specifier") ?? "";
  const rawSpecifier = url.searchParams.get("rawSpecifier") ?? specifier;
  const referrer = url.searchParams.get("referrer") ?? "";
  const verbose = process.env.FALLBACK_VERBOSE === "1";
  if (verbose) console.log(`[fallback] ${method} raw=${rawSpecifier} spec=${specifier} ref=${referrer}`);

  try {
    const builtinName = rawSpecifier.startsWith("node:") ? rawSpecifier.slice(5) : rawSpecifier;
    if (builtinName === "process") return new MfResponse(null, { status: 301, headers: { Location: "/tmp/shims/process.cjs" } });
    if (/^(fs|fs\/promises|path|url|util|os|module|crypto|events|stream|buffer|assert|zlib|querystring|http|https|http2|net|tls|child_process|worker_threads|perf_hooks|readline|tty|v8|vm|string_decoder|constants|async_hooks|dns|inspector|timers|punycode|diagnostics_channel|sys|wasi)(\/|$)/.test(builtinName)) {
      return new MfResponse(null, { status: 301, headers: { Location: "node:" + builtinName } });
    }

    let hostResolved;
    const isBare = !rawSpecifier.startsWith("./") && !rawSpecifier.startsWith("../") && !rawSpecifier.startsWith("/");
    if (rawSpecifier.startsWith("#")) {
      const refHost = virt2host(referrer);
      if (!refHost) return new MfResponse("hash specifier outside mounts", { status: 404 });
      hostResolved = resolveFrom(path.dirname(refHost), rawSpecifier, method);
    } else if (isBare) {
      const baseName = rawSpecifier.split("/")[0].startsWith("@") ? rawSpecifier.split("/").slice(0, 2).join("/") : rawSpecifier.split("/")[0];
      if (ALIASES[baseName] === "404") return new MfResponse("not found", { status: 404 });
      if (ALIASES[baseName]) {
        const rest = rawSpecifier.slice(baseName.length);
        const aliasBase = ALIASES[baseName];
        hostResolved = path.isAbsolute(aliasBase) ? aliasBase : resolveFrom(HERE, aliasBase + rest, method);
      } else {
        const refHost = virt2host(referrer);
        const bases = [];
        if (refHost) bases.push(path.dirname(refHost));
        bases.push(...BARE_ROOTS);
        let lastErr;
        for (const base of bases) {
          try { hostResolved = resolveFrom(base, rawSpecifier, method); if (hostResolved) break; }
          catch (e) { lastErr = e; }
        }
        if (!hostResolved) throw lastErr ?? new Error("unresolved bare " + rawSpecifier);
      }
    } else {
      const hostPath = virt2host(specifier);
      if (!hostPath) return new MfResponse("outside mounts: " + specifier, { status: 404 });
      hostResolved = resolveExact(hostPath, method);
    }

    if (!hostResolved) return new MfResponse("unresolved: " + rawSpecifier, { status: 404 });
    const virtResolved = host2virt(hostResolved);
    if (!virtResolved) return new MfResponse("resolved outside mounts: " + hostResolved, { status: 404 });
    if (virtResolved !== specifier) return new MfResponse(null, { status: 301, headers: { Location: virtResolved } });

    const ext = path.extname(hostResolved);
    if (ext === ".json") {
      const raw = readFileSync(hostResolved, "utf8");
      let named = [];
      try { named = Object.keys(JSON.parse(raw)).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k)); } catch {}
      return new MfResponse(JSON.stringify({ name: specifier.slice(1), commonJsModule: "module.exports = " + raw + ";", namedExports: named }), { headers: { "content-type": "application/json" } });
    }
    if (ext === ".wasm" || ext === ".node") return new MfResponse("binary modules not served as modules", { status: 404 });

    let src = readFileSync(hostResolved, "utf8");
    let format;
    if (ext === ".mjs") format = "esm";
    else if (ext === ".cjs") format = "cjs";
    else if (pkgTypeIsModule(hostResolved)) format = "esm";
    else if (/^\s*(export\s+(default|const|let|var|function|class|\{|\*)|import[\s{"'])/m.test(src) && !/(?<![.\w$])(module\.exports|exports\.[A-Za-z_$])/.test(src)) format = "esm";
    else format = "cjs";
    src = rewriteSource(src, virtResolved, format);
    served.set(virtResolved, src.length);

    let mod;
    if (format === "esm") mod = { esModule: src };
    else {
      let named = [];
      if (virtResolved === "/tmp/shims/process.cjs") {
        named = ["env","argv","argv0","platform","arch","version","versions","cwd","chdir","nextTick","hrtime","exit","exitCode","pid","ppid","release","features","config","execPath","execArgv","on","once","off","emit","emitWarning","removeListener","stdout","stderr","stdin","kill","umask","uptime","memoryUsage","title","report","getBuiltinModule","allowedNodeEnvironmentFlags","throwDeprecation","noDeprecation","hrtimeBigInt"];
      } else {
        try {
          const lexed = cjsLexer(src);
          named = [...lexed.exports];
          for (const re of lexed.reexports) {
            try { const reHost = resolveFrom(path.dirname(hostResolved), re, "require"); named.push(...cjsLexer(readFileSync(reHost, "utf8")).exports); } catch {}
          }
        } catch {}
      }
      named = [...new Set(named)].filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && n !== "default");
      mod = { commonJsModule: src, namedExports: named };
    }
    return new MfResponse(JSON.stringify({ name: specifier.replace(/^\//, ""), ...mod }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    if (verbose || process.env.FALLBACK_ERRORS !== "0") console.log(`[fallback] ERROR ${rawSpecifier} from ${referrer}: ${e.message}`);
    return new MfResponse(String(e), { status: 404 });
  }
}

// The DO needs the ToDo app source (to scaffold into /tmp/proj) and the dev-server
// probe source. We serve both over a service binding so the DO can pull them without
// a host mount (the app source lives outside the mounted node_modules roots).
const APP_TODO = path.join(REPO, "app-todo");

function buildAppManifest() {
  const files = {};
  const skip = (p) =>
    p.includes("/node_modules/") || p.includes("/dist/") || p.includes("/.git/") ||
    p.includes("/proof-screenshots/") || p.endsWith("package-lock.json");
  const stack = [APP_TODO];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && !skip(p)) files[p.slice(APP_TODO.length + 1)] = readFileSync(p).toString("base64");
    }
  }
  return files;
}

function hostService(request) {
  const url = new URL(request.url);
  if (url.pathname === "/app-manifest") {
    return new MfResponse(JSON.stringify(buildAppManifest()), { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/dev-probe") {
    return new MfResponse(readFileSync(path.join(HERE, "worker/vite-dev-probe.mjs")), { headers: { "content-type": "text/javascript" } });
  }
  if (url.pathname === "/realbin-probe") {
    return new MfResponse(readFileSync(path.join(HERE, "worker/vite-realbin-probe.mjs")), { headers: { "content-type": "text/javascript" } });
  }
  if (url.pathname === "/vite-http-shim") {
    return new MfResponse(readFileSync(path.join(HERE, "..", "shims-vite", "node-http.mjs")), { headers: { "content-type": "text/javascript" } });
  }
  return new MfResponse("not found", { status: 404 });
}

export async function createShellHarness({ verbose = false, port } = {}) {
  const mf = new Miniflare({
    log: new Log(verbose ? LogLevel.DEBUG : LogLevel.WARN),
    ...(port ? { host: "127.0.0.1", port } : {}),
    modules: [{ type: "ESModule", path: path.join(HERE, "worker/shell-do.mjs") }],
    modulesRoot: HERE,
    compatibilityDate: "2026-06-01",
    compatibilityFlags: ["nodejs_compat", "experimental"],
    unsafeEvalBinding: "UNSAFE_EVAL",
    unsafeUseModuleFallbackService: true,
    unsafeModuleFallbackService: moduleFallback,
    bindings: { DEV_PORT: String(port ?? "") },
    serviceBindings: { HOST: hostService },
    durableObjects: { SHELL: "Shell" },
    workerLoaders: { LOADER: {} },
  });
  return { mf, stats: () => ({ fallbackCount, servedModules: served.size }) };
}
