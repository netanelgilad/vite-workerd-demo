// Host harness variant: run real npm inside a Durable Object over workerd's
// NATIVE node:fs (no memfs). Copied from ../host.mjs with two differences:
//   1. The fs->memfs source rewrite and the fs->memfs 301 redirects are REMOVED,
//      so npm's `require('node:fs')` / `import 'fs'` resolves to workerd's real
//      node:fs (which persists /tmp across requests inside a DO).
//   2. The worker is wired as a Durable Object (NpmInstaller) routed to a single
//      named instance so /tmp survives across separate dispatchFetch calls.
//
// KEPT (these are NOT fs-related workerd workarounds and remain necessary):
//   - process / node:process source rewrite + 301 -> shims/process.cjs
//     (require('node:process') through the fallback SEGFAULTS workerd)
//   - @npmcli/agent alias -> shims/npmcli-agent.cjs (keepalive agent breaks https)
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { init as cjsLexerInit, parse as cjsLexer } from "cjs-module-lexer";
import enhancedResolve from "enhanced-resolve";

await cjsLexerInit();
import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));
// npm's code on disk lives in the original experiment's node_modules
// (prep-install-url/ is a scratch copy with no node_modules of its own).
const NPM_NM = path.join(HARNESS_DIR, "..", "experiments", "npm-in-workerd", "node_modules");

const MOUNTS = [
  { virt: "/tmp/xnm", host: NPM_NM },
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

const ALIASES = {
  fsevents: "404",
  // npm's keepalive/proxy agent breaks node:https.request in workerd; swap it
  // for one that returns no agent (workerd's default request works).
  "@npmcli/agent": path.join(HARNESS_DIR, "shims/npmcli-agent.cjs"),
};

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
  // WORKAROUND for a workerd native-fs bug: when many async fs.write calls are
  // issued from within tar's Unpack pipeline, only the FIRST write's callback
  // fires; the rest never complete, so tar's pending-file counter never reaches
  // zero and Arborist's reify() hangs forever. (Verified in isolation: direct
  // fs, burst writes, and writes from inside Minipass/stream handlers all fire
  // their callbacks correctly — only tar's specific async write pipeline loses
  // them.) tar's per-file writer is `new fsm.WriteStream(...)`; fs-minipass also
  // ships `WriteStreamSync` (writeSync/closeSync, no async callbacks) with the
  // same interface. Rewriting the writer to the Sync variant makes file writes
  // synchronous — the parse/gunzip stream stays async, but each file completes
  // synchronously, so the pending counter drains and reify completes. This is
  // the single targeted source edit needed to make real npm install work over
  // workerd's native fs in a DO.
  // WORKAROUND for a workerd native-fs bug: tar's ASYNC Unpack pipeline loses
  // fs write/close callbacks under workerd — after the first file or two, the
  // per-file completion callbacks never fire, tar's pending counter never
  // reaches zero, and Arborist's reify() hangs forever. (Verified in isolation:
  // direct fs ops, burst writes, Minipass, minizlib gunzip, and fs-minipass all
  // work standalone; only tar's composed async write pipeline loses callbacks.)
  // tar's SYNC path (UnpackSync via writeSync/closeSync) has NO async fs
  // callbacks and extracts a full tarball correctly in workerd (proven by the
  // /syncextract probe). pacote's #extract pipes the tarball stream into the
  // async tar.x(); we rewrite that method to instead buffer the whole tarball
  // and run tar.x({sync:true}) once — keeping pacote's async contract while the
  // actual extraction is synchronous. This is the single targeted edit that
  // makes real npm install work over workerd native fs in a DO.
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
    // workerd workaround: buffer the tarball, then extract synchronously
    // (tar UnpackSync) — the async tar.x() pipeline loses fs callbacks here.
    return new Promise((resolve, reject) => {
      const chunks = []
      tarball.on('data', c => chunks.push(Buffer.from(c)))
      tarball.on('error', er => reject(er))
      tarball.on('end', () => {
        try {
          const buf = Buffer.concat(chunks)
          tar.x({ ...this.#tarxOptions({ cwd: dest }), sync: true }).end(buf)
          resolve({
            resolved: this.resolved,
            integrity: this.integrity && String(this.integrity),
            from: this.from,
          })
        } catch (er) {
          log.warn('tar', er.message)
          log.silly('tar', er)
          reject(er)
        }
      })
    })
  }`);

    // WORKAROUND for a workerd native-fs bug: cacache.get.stream.byDigest()
    // hangs in workerd — the content-addressable read stream never emits 'end'
    // (verified in isolation via /probe-cacache). pacote's tarballStream()
    // short-circuits to #tarballFromCache() (which calls that exact API)
    // whenever `this.integrity && this.resolved` are set. For a remote-tarball /
    // URL specifier, the manifest fetch populates the cache AND sets
    // this.integrity, so the subsequent extract() takes the cache-read path and
    // hangs forever. Re-downloading the tarball over HTTP works fine (proven by
    // a standalone pacote.extract = 2 server hits), so we disable the cache
    // short-circuit: force `fromCache = null` so tarballStream always uses the
    // online `fromResolved` path. (Registry installs are unaffected — they just
    // re-download too, and the registry tarball stream works in workerd.)
    src = src.replace(
      /const fromCache = \(\s*!this\.preferOnline &&\s*this\.integrity &&\s*this\.resolved\s*\) \?/,
      "const fromCache = (\n      false && !this.preferOnline &&\n      this.integrity &&\n      this.resolved\n    ) ?");
  }

  // WORKAROUND for a workerd native-fs bug: fs.mkdtempSync(prefix) returns
  // EINVAL when `prefix` ends in a path separator (i.e. the template has an
  // empty final filename component). npm's @npmcli/fs withTempDir builds the
  // template as `join(`${root}${sep}`, tmpPrefix || '')` — when tmpPrefix is
  // empty (the case for remote-tarball / URL specifiers, whose manifest fetch
  // goes through cacache.tmp with no prefix) the template ends in `/`, so
  // mkdtemp throws EINVAL and Arborist's reify() fails. Default the prefix to a
  // non-empty literal so workerd's mkdtemp gets a real trailing component
  // (`/tmp/npmcache/tmp/tmp-XXXXXX` works; `/tmp/npmcache/tmp/` does not).
  // This is the single targeted edit that makes URL-specifier installs work.
  if (virtPath.endsWith("/@npmcli/fs/lib/with-temp-dir.js")) {
    src = src.replace("options.tmpPrefix || ''", "options.tmpPrefix || 'tmp-'");
  }

  // NOTE: NO fs / fs/promises rewrite here — we want npm to use native node:fs.
  // Only the process rewrite is kept (require('node:process') segfaults workerd).
  const importSite = (spec) =>
    new RegExp(String.raw`(\bfrom\s*|\bimport\s*\(\s*|\b__require\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])${spec.replace(/[/\\]/g, "\\$&")}\2`, "gm");
  for (const [spec, target] of [
    // require('node:process') through workerd's CJS loader segfaults; rewrite
    // the specifier so workerd never sees it — the shim re-exports the global.
    ["node:process", "/tmp/shims/process.cjs"],
    ["process", "/tmp/shims/process.cjs"],
  ]) {
    src = src.replace(importSite(spec), (m, lead, q) => `${lead}${q}${target}${q}`);
  }
  return src;
}

const served = new Map();
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
    // NOTE: NO fs / fs/promises 301 redirect — let workerd resolve node:fs natively.
    // node: builtins (workerd resolves them natively). Handle both bare
    // (`process`) and prefixed (`node:process`) forms — npm uses the prefix.
    const builtinName = rawSpecifier.startsWith("node:") ? rawSpecifier.slice(5) : rawSpecifier;
    // `require('node:process')` through the fallback segfaults workerd (a
    // workerd bug); the global `process` is fine. Route it to a shim that
    // re-exports the global instead of the native module.
    if (builtinName === "process") {
      return new MfResponse(null, { status: 301, headers: { Location: "/tmp/shims/process.cjs" } });
    }
    // fs and fs/promises are now NATIVE — route them straight to workerd's builtin.
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
        hostResolved = path.isAbsolute(aliasBase) ? aliasBase : resolveFrom(HARNESS_DIR, aliasBase + rest, method);
      } else {
        const refHost = virt2host(referrer) ?? path.join(NPM_NM, "..", "package.json");
        try {
          hostResolved = resolveFrom(path.dirname(refHost), rawSpecifier, method);
        } catch (e) {
          hostResolved = resolveFrom(NPM_NM, rawSpecifier, method);
        }
      }
    } else {
      const hostPath = virt2host(specifier);
      if (!hostPath) return new MfResponse("outside mounts: " + specifier, { status: 404 });
      hostResolved = resolveExact(hostPath, method);
    }

    if (!hostResolved) return new MfResponse("unresolved: " + rawSpecifier, { status: 404 });
    const virtResolved = host2virt(hostResolved);
    if (!virtResolved) return new MfResponse("resolved outside mounts: " + hostResolved, { status: 404 });

    if (virtResolved !== specifier) {
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
    else if (/^\s*(export\s+(default|const|let|var|function|class|\{|\*)|import[\s{"'])/m.test(src) && !/(?<![.\w$])(module\.exports|exports\.[A-Za-z_$])/.test(src)) format = "esm";
    else format = "cjs";
    src = rewriteSource(src, virtResolved, format);
    served.set(virtResolved, src.length);
    let mod;
    if (format === "esm") mod = { esModule: src };
    else {
      let named = [];
      if (virtResolved === "/tmp/shims/process.cjs") {
        named = ["env", "argv", "argv0", "platform", "arch", "version", "versions",
          "cwd", "chdir", "nextTick", "hrtime", "exit", "exitCode", "pid", "ppid",
          "release", "features", "config", "execPath", "execArgv", "on", "once",
          "off", "emit", "emitWarning", "removeListener", "stdout", "stderr", "stdin",
          "kill", "umask", "uptime", "memoryUsage", "title", "report", "getBuiltinModule",
          "allowedNodeEnvironmentFlags", "throwDeprecation", "noDeprecation", "hrtimeBigInt"];
      } else {
        try {
          const lexed = cjsLexer(src);
          named = [...lexed.exports];
          for (const re of lexed.reexports) {
            try {
              const reHost = resolveFrom(path.dirname(hostResolved), re, "require");
              named.push(...cjsLexer(readFileSync(reHost, "utf8")).exports);
            } catch {}
          }
        } catch {}
      }
      named = [...new Set(named)].filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && n !== "default");
      mod = { commonJsModule: src, namedExports: named };
    }
    const body = JSON.stringify({ name: specifier.replace(/^\//, ""), ...mod });
    return new MfResponse(body, { headers: { "content-type": "application/json" } });
  } catch (e) {
    if (verbose || process.env.FALLBACK_ERRORS !== "0") console.log(`[fallback] ERROR ${rawSpecifier} from ${referrer}: ${e.message}`);
    return new MfResponse(String(e), { status: 404 });
  }
}

function resolveFrom(dir, spec, method) {
  const r = method === "require" ? requireResolver : importResolver;
  try { return r(dir, spec); } catch (e) {
    const alt = method === "require" ? importResolver : requireResolver;
    return alt(dir, spec);
  }
}

function resolveExact(hostPath, method) {
  if (existsSync(hostPath) && statSync(hostPath).isFile()) return hostPath;
  return resolveFrom(path.dirname(hostPath), "./" + path.basename(hostPath), method);
}

export async function createHarness({ verboseLog = false } = {}) {
  const mf = new Miniflare({
    log: new Log(verboseLog ? LogLevel.DEBUG : LogLevel.INFO),
    modules: [{ type: "ESModule", path: path.join(HARNESS_DIR, "worker", "driver-do.mjs") }],
    modulesRoot: HARNESS_DIR,
    compatibilityDate: "2026-06-01",
    compatibilityFlags: ["nodejs_compat", "experimental"],
    unsafeEvalBinding: "UNSAFE_EVAL",
    unsafeUseModuleFallbackService: true,
    unsafeModuleFallbackService: moduleFallback,
    durableObjects: {
      INSTALLER: "NpmInstaller",
    },
  });
  return { mf, stats: () => ({ fallbackCount, servedModules: served.size }) };
}
