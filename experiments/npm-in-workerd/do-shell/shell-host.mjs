// Shell DO host: miniflare + fork binary + worker_loaders + module fallback.
//
// The fallback resolves the TOP-LEVEL worker's imports (the DO) against real
// node_modules on disk. Two roots are mounted:
//   /tmp/xnm    -> experiments/npm-in-workerd/node_modules  (npm + arborist)
//   /tmp/jbnm   -> harness/node_modules                      (just-bash + deps)
//   /tmp/shims  -> do-shell/shims                            (NativeFsAdapter)
// Bare specifiers are resolved against BOTH roots (npm root first, just-bash
// root second). All the workerd source-rewrite workarounds from do-native-fs
// are kept (process shim, eval/Function/WASM rewrites, the tar sync-extract hack
// that makes npm install work over native fs).
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { init as cjsLexerInit, parse as cjsLexer } from "cjs-module-lexer";
import enhancedResolve from "enhanced-resolve";
import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

await cjsLexerInit();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");           // vite-workerd-demo
const NPM_NM = path.resolve(HERE, "..", "node_modules");      // npm-in-workerd/node_modules
const JB_NM = path.join(REPO, "harness", "node_modules");     // just-bash + deps
const SHIMS = path.join(HERE, "shims");
const NPM_SHIMS = path.resolve(HERE, "..", "do-native-fs", "shims");

const MOUNTS = [
  { virt: "/tmp/xnm", host: NPM_NM },
  { virt: "/tmp/jbnm", host: JB_NM },
  { virt: "/tmp/shims", host: SHIMS },
  { virt: "/tmp/npmshims", host: NPM_SHIMS },
];
// bare-resolution roots, tried in order
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
  "@npmcli/agent": path.join(NPM_SHIMS, "npmcli-agent.cjs"),
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

  // tar sync-extract workaround (npm install over native fs) — see do-native-fs.
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

  // route node:process / process to the shim (segfault workaround)
  const importSite = (spec) =>
    new RegExp(String.raw`(\bfrom\s*|\bimport\s*\(\s*|\b__require\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])${spec.replace(/[/\\]/g, "\\$&")}\2`, "gm");
  for (const [spec, target] of [["node:process", "/tmp/npmshims/process.cjs"], ["process", "/tmp/npmshims/process.cjs"]]) {
    src = src.replace(importSite(spec), (m, lead, q) => `${lead}${q}${target}${q}`);
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
    if (builtinName === "process") return new MfResponse(null, { status: 301, headers: { Location: "/tmp/npmshims/process.cjs" } });
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
      if (virtResolved === "/tmp/npmshims/process.cjs") {
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

export async function createShellHarness({ verbose = false } = {}) {
  const mf = new Miniflare({
    log: new Log(verbose ? LogLevel.DEBUG : LogLevel.INFO),
    modules: [{ type: "ESModule", path: "do-shell/worker/shell-do.mjs" }],
    modulesRoot: ".",
    compatibilityDate: "2026-06-01",
    compatibilityFlags: ["nodejs_compat", "experimental"],
    unsafeEvalBinding: "UNSAFE_EVAL",
    unsafeUseModuleFallbackService: true,
    unsafeModuleFallbackService: moduleFallback,
    durableObjects: { SHELL: "Shell" },
    workerLoaders: { LOADER: {} },
  });
  return { mf, stats: () => ({ fallbackCount, servedModules: served.size }) };
}
