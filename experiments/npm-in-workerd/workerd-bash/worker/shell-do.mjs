// workerd-bash Durable Object: ONE v8 isolate that owns a shared NATIVE /tmp and
// runs just-bash as an interactive shell over it. The user types commands in the
// REPL (repl.mjs); each line is POSTed to /exec and run here. The shell exposes:
//
//   - just-bash builtins over the DO's native /tmp: ls, cat, echo, mkdir, pwd, rm,
//     pipes, redirects (via the NativeFsAdapter, shared with do-shell).
//   - `npm install [pkgs...]` -> Arborist install into /tmp/proj/node_modules from
//     the PUBLIC registry. Default (no args) installs @netanelgilad/vite + the ToDo
//     app's deps (the exact set do-machine-clean proved buildable/serveable).
//   - `npm create <init>` / `npm exec` / `npx`  -> REAL libnpmexec: install the pkg via
//     Arborist, then run its bin in a child over /tmp via the child_process->isolate
//     spawn bridge (e.g. `npm create vite myapp -- --template react-ts`).
//   - `scaffold`                         -> write the app-todo source into /tmp/proj.
//   - `vite build`                       -> run vite build from /tmp in a child; list dist.
//   - `vite dev` / `npm run dev`         -> boot the vite dev server in a child over /tmp,
//                                           reachable on the bound miniflare port; print URL.
//
// The heavy toolchain (vite/rolldown) runs in a Worker-Loader CHILD that shares the
// DO's /tmp (shareParentTmp) and resolves its module graph from /tmp/proj via the
// fork's `vfsModuleFallback`. npm install runs IN the DO (it has the module-fallback
// service that resolves npm's own code from the host node_modules).
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";

const ARBORIST = "/tmp/xnm/npm/node_modules/@npmcli/arborist/lib/index.js";
const PROJ = "/tmp/proj";
const CACHE = "/tmp/npmcache";

// The dependency set @netanelgilad/vite + the ToDo app needs (proven by
// do-machine-clean). `npm install` with no args installs exactly this.
const DEFAULT_DEPS = {
  "@netanelgilad/vite": "8.0.16-workerd.0",
  vite: "npm:@netanelgilad/vite@8.0.16-workerd.0",
  rolldown: "npm:@netanelgilad/rolldown@1.0.3-workerd.0",
  "@vitejs/plugin-react": "^6",
  react: "^19",
  "react-dom": "^19",
  tailwindcss: "^3",
  autoprefixer: "^10",
  postcss: "^8",
};

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__wasmCompile = async (b) => env.UNSAFE_EVAL.newWasmModule(b instanceof Uint8Array ? b : new Uint8Array(b));
  globalThis.__safeEval = (c) => env.UNSAFE_EVAL.eval(String(c));
  globalThis.__newFunction = (...a) => { const body = a.pop(); return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...a); };
}

// npm-install-checks' libc probe calls process.report.getReport() -> segfault.
async function patchProcessReport() {
  const stub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };
  const targets = new Set([process, globalThis.process]);
  try { const m = await import("node:process"); targets.add(m.default); targets.add(m); } catch {}
  for (const t of targets) {
    if (!t) continue;
    try { Object.defineProperty(t, "report", { configurable: true, value: stub }); } catch {}
  }
}

const CHILD_FLAGS = ["nodejs_compat", "nodejs_compat_v2", "experimental", "enable_nodejs_fs_module"];
const CHILD_COMPAT_DATE = "2026-06-01";

const CHILD_GLOBALS_PRELUDE = `
  function installGlobals(env) {
    globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
    globalThis.__wasmCompile = async (b) =>
      env.UNSAFE_EVAL.newWasmModule(b instanceof Uint8Array ? b : new Uint8Array(b));
    globalThis.__safeEval = (c) => env.UNSAFE_EVAL.eval(String(c));
    globalThis.__newFunction = (...a) => { const body = a.pop(); return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...a); };
    globalThis.__requireResolve = (base, spec) => {
      if (typeof spec === "string" && spec.startsWith("file://")) spec = spec.slice(7);
      return spec;
    };
    const _WA = globalThis.WebAssembly;
    if (!_WA.__patchedForUnsafeEval) {
      const origInstantiate = _WA.instantiate.bind(_WA);
      const toModule = (src) => {
        if (src instanceof _WA.Module) return src;
        const bytes = src instanceof Uint8Array ? src : new Uint8Array(src);
        return env.UNSAFE_EVAL.newWasmModule(bytes);
      };
      _WA.compile = async (src) => toModule(src);
      _WA.instantiate = async (src, imports) => {
        if (src instanceof _WA.Module) return origInstantiate(src, imports);
        const mod = toModule(src);
        const instance = await origInstantiate(mod, imports);
        return { module: mod, instance };
      };
      _WA.__patchedForUnsafeEval = true;
    }
  }
  function makeEnoentFs(base) {
    const O_CREAT = 0o100;
    const enoent = (p, syscall) => { const e = new Error("ENOENT: no such file or directory, " + syscall + " '" + p + "'"); e.code = "ENOENT"; e.errno = -2; e.syscall = syscall; e.path = p; throw e; };
    return new Proxy(base, { get(t, k) {
      const v = t[k];
      if (k === "openSync") return (p, flags, ...a) => {
        const wantsCreate = typeof flags === "number" && (flags & O_CREAT) !== 0;
        if (!wantsCreate && !t.existsSync(p)) enoent(p, "open");
        return v.call(t, p, flags, ...a);
      };
      if (k === "readFileSync") return (p, ...a) => { if (!t.existsSync(p)) enoent(p, "open"); return v.call(t, p, ...a); };
      if (k === "statSync") return (p, ...a) => { if (!t.existsSync(p)) enoent(p, "stat"); return v.call(t, p, ...a); };
      if (k === "lstatSync") return (p, ...a) => { if (!t.existsSync(p)) enoent(p, "lstat"); return v.call(t, p, ...a); };
      return typeof v === "function" ? v.bind(t) : v;
    }});
  }
`;

function viteBuildChild() {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    mainModule: "main.js",
    modules: { "main.js": `export { default } from "/tmp/proj/vite-build-probe.mjs";` },
  };
}

function viteDevChild(devPort) {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    env: { DEV_PORT: String(devPort ?? "") },
    mainModule: "main.js",
    modules: {
      "main.js": `
        import { WorkerEntrypoint } from "cloudflare:workers";
        let _impl;
        async function impl() {
          if (!_impl) _impl = (await import("/tmp/proj/vite-dev-probe.mjs")).default;
          return _impl;
        }
        export default class extends WorkerEntrypoint {
          async #inst() {
            const I = await impl();
            const ctx = this.ctx ?? { waitUntil() {}, passThroughOnException() {} };
            if (!ctx.waitUntil) ctx.waitUntil = () => {};
            const inst = new I(ctx, this.env);
            inst.ctx = ctx; inst.env = this.env;
            return inst;
          }
          async warmup() { return (await this.#inst()).warmup(); }
          async fetch(request) { return (await this.#inst()).fetch(request); }
        }
      `,
    },
  };
}

// ---- child_process -> isolate-spawn bridge (makes REAL `npm create/exec/npx` work) ----
const NPXCACHE = "/tmp/npxcache";
const VSHIM_DIR = "/tmp/_vshims";
const VHTTP_SHIM = VSHIM_DIR + "/node-http.mjs";
// The probe lives INSIDE the project root so its bare imports ("rolldown", "vite") resolve
// against <root>/node_modules.
const probePathFor = (root) => root + "/.vite-realbin-probe.mjs";

// A child that runs the REAL `vite` bin against `root` (whatever's in the pwd), honoring
// the project's own vite.config. The node:http shim (which we redirect vite's import onto)
// supplies the listening server; the probe dispatches browser HTTP into vite's connect app.
function viteRealBinChild(devPort, bin, root) {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    env: { DEV_PORT: String(devPort ?? ""), VITE_BIN: bin, VITE_ROOT: root },
    mainModule: "main.js",
    modules: {
      "main.js": `
        import { WorkerEntrypoint } from "cloudflare:workers";
        let _impl;
        async function impl() { if (!_impl) _impl = (await import(${JSON.stringify(probePathFor(root))})).default; return _impl; }
        export default class extends WorkerEntrypoint {
          async #inst() {
            const I = await impl();
            const ctx = this.ctx ?? { waitUntil() {}, passThroughOnException() {} };
            if (!ctx.waitUntil) ctx.waitUntil = () => {};
            const inst = new I(ctx, this.env);
            inst.ctx = ctx; inst.env = this.env;
            return inst;
          }
          async warmup() { return (await this.#inst()).warmup(); }
          async fetch(request) { return (await this.#inst()).fetch(request); }
        }
      `,
    },
  };
}

function nodeProcessChild(probePath) {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    mainModule: "main.js",
    modules: { "main.js": `export { default } from ${JSON.stringify(probePath)};` },
  };
}

function tokenize(line) {
  const out = [];
  let cur = "", q = null, has = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === q) q = null;
      else if (q === '"' && ch === "\\" && i + 1 < line.length) cur += line[++i];
      else cur += ch;
    } else if (ch === "'" || ch === '"') { q = ch; has = true; }
    else if (ch === "\\" && i + 1 < line.length) { cur += line[++i]; has = true; }
    else if (ch === " " || ch === "\t" || ch === "\n") { if (has || cur) { out.push(cur); cur = ""; has = false; } }
    else { cur += ch; has = true; }
  }
  if (has || cur) out.push(cur);
  return out;
}

// promise-spawn calls spawn('sh', ['-c', line], opts).
function resolveArgv(file, args = []) {
  const base = String(file || "").split("/").pop();
  if ((base === "sh" || base === "bash" || base === "zsh") && args[0] === "-c") return tokenize(args[1] || "");
  if ((base === "cmd" || base === "cmd.exe") && args.includes("/c")) return tokenize(args[args.indexOf("/c") + 1] || "");
  return [file, ...args];
}

function realOrSelf(fs, p) { try { return fs.realpathSync(p); } catch { return p; } }

function resolveBinToJs(fs, cmd, options) {
  if (cmd.startsWith("/") && fs.existsSync(cmd)) return realOrSelf(fs, cmd);
  const env = options.env || {};
  const dirs = String(env.PATH || env.Path || "").split(":").filter(Boolean);
  for (const dir of dirs) {
    const cand = dir + "/" + cmd;
    try { if (fs.existsSync(cand)) return realOrSelf(fs, cand); } catch {}
  }
  for (const dir of dirs) {
    if (!dir.endsWith("/.bin")) continue;
    const hit = scanNmForBin(fs, dir.slice(0, -"/.bin".length), cmd);
    if (hit) return hit;
  }
  return null;
}

function scanNmForBin(fs, nm, cmd) {
  let names = [];
  try { names = fs.readdirSync(nm); } catch { return null; }
  const pkgDirs = [];
  for (const n of names) {
    if (n.startsWith("@")) { try { for (const s of fs.readdirSync(nm + "/" + n)) pkgDirs.push(n + "/" + s); } catch {} }
    else pkgDirs.push(n);
  }
  for (const d of pkgDirs) {
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(nm + "/" + d + "/package.json", "utf8")); } catch { continue; }
    const bin = pkg.bin, shortName = String(pkg.name || "").split("/").pop();
    if (typeof bin === "string" && (pkg.name === cmd || shortName === cmd)) return nm + "/" + d + "/" + bin.replace(/^\.\//, "");
    if (bin && typeof bin === "object" && bin[cmd]) return nm + "/" + d + "/" + String(bin[cmd]).replace(/^\.\//, "");
  }
  return null;
}

function probeSrc(entry, args, cwd, envObj) {
  return `
  import { WorkerEntrypoint } from "cloudflare:workers";
  export default class extends WorkerEntrypoint {
    async run() {
      const ENTRY = ${JSON.stringify(entry)};
      const ARGV = ${JSON.stringify(["node", entry, ...args])};
      const CWD = ${JSON.stringify(cwd)};
      const ENV = ${JSON.stringify(envObj)};
      const out = [], err = [];
      const now = () => Date.now();
      let last = now();
      const np = await import("node:process");
      for (const proc of new Set([np.default, np, globalThis.process].filter(Boolean))) {
        try { proc.argv = ARGV.slice(); } catch {}
        try { proc.cwd = () => CWD; } catch { try { Object.defineProperty(proc, "cwd", { configurable: true, value: () => CWD }); } catch {} }
        try { proc.env = Object.assign(proc.env || {}, ENV); } catch {}
        try { if (proc.stdin) proc.stdin.isTTY = false; } catch {}
      }
      let exitCode = null;
      try { np.default.exit = (c) => { exitCode = (c == null ? 0 : c); throw { __ISOLATE_EXIT__: exitCode }; }; } catch {}
      const enc = (a) => a.map((x) => typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })()).join(" ");
      const oLog = console.log, oErr = console.error, oWarn = console.warn, oInfo = console.info;
      console.log = (...a) => { last = now(); out.push(enc(a) + "\\n"); };
      console.info = (...a) => { last = now(); out.push(enc(a) + "\\n"); };
      console.warn = (...a) => { last = now(); err.push(enc(a) + "\\n"); };
      console.error = (...a) => { last = now(); err.push(enc(a) + "\\n"); };
      try { np.default.stdout.write = (s) => { last = now(); out.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
      try { np.default.stderr.write = (s) => { last = now(); err.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
      let importErr = null;
      last = now();
      try { await import(ENTRY); }
      catch (e) {
        if (e && typeof e === "object" && "__ISOLATE_EXIT__" in e) exitCode = e.__ISOLATE_EXIT__;
        else importErr = String(e && e.stack || e);
      }
      const QUIET = 800, MAX = 60000, t0 = now();
      while (exitCode === null && (now() - t0) < MAX) {
        if (now() - last > QUIET) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      console.log = oLog; console.error = oErr; console.warn = oWarn; console.info = oInfo;
      return { code: exitCode == null ? 0 : exitCode, signal: null, stdout: out.join(""), stderr: err.join(""), importErr };
    }
  }
  `;
}

// `npm create <initializer>` -> the create-* package npm would exec.
function initToCreatePkg(spec) {
  const at = spec.lastIndexOf("@");
  let name = spec, version = "";
  if (at > 0) { name = spec.slice(0, at); version = spec.slice(at); }
  let pkg;
  if (name.startsWith("@")) {
    const [scope, rest] = name.split("/");
    pkg = rest ? `${scope}/create-${rest}` : `${scope}/create`;
  } else pkg = `create-${name}`;
  return { spec: pkg + version, bin: pkg };
}

export class Shell {
  constructor(state, env) { this.state = state; this.env = env; }

  // ---- toolchain ops (called by the shell `npm`/`scaffold`/`vite` commands) ----

  // Public-registry install via Arborist into the DO's /tmp/proj/node_modules.
  // Faithful to `npm install <pkgs>`: Arborist resolves+fetches from
  // https://registry.npmjs.org/ over workerd native fs (the tar sync-extract
  // workaround in the module-fallback host makes this work).
  async npmInstall(extraDeps, root = PROJ) {
    await patchProcessReport();
    const fs = nodeFs;
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(CACHE, { recursive: true });
    let pkg = { name: "scratch", version: "1.0.0", private: true, type: "module", dependencies: {} };
    try { pkg = JSON.parse(fs.readFileSync(root + "/package.json", "utf8")); pkg.dependencies ??= {}; } catch {}
    // Real `npm install` reifies the project's own package.json. We only inject the demo
    // default set (fork vite + ToDo deps) when this is a BARE project with no deps of its
    // own AND nothing was explicitly requested — otherwise we honor what's declared.
    const declared = Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;
    const explicit = extraDeps && Object.keys(extraDeps).length;
    let deps = {};
    if (explicit) { deps = extraDeps; Object.assign(pkg.dependencies, deps); fs.writeFileSync(root + "/package.json", JSON.stringify(pkg, null, 2)); }
    else if (declared === 0) { deps = DEFAULT_DEPS; Object.assign(pkg.dependencies, deps); fs.writeFileSync(root + "/package.json", JSON.stringify(pkg, null, 2)); }
    const t0 = Date.now();
    const { default: Arborist } = await import(ARBORIST);
    const arb = new Arborist({
      path: root, cache: CACHE, registry: "https://registry.npmjs.org/",
      ignoreScripts: true, audit: false, fund: false, progress: false,
      packumentCache: new Map(),
      // The fork's 8.0.16-workerd.0 is a prerelease that strict semver rejects against
      // plugin peers — the canonical --legacy-peer-deps case a real user would also pass.
      legacyPeerDeps: true,
    });
    await arb.reify({ ignoreScripts: true, audit: false, legacyPeerDeps: true });
    let installed = [];
    try { installed = fs.readdirSync(root + "/node_modules").filter((n) => !n.startsWith(".")); } catch {}
    return { ms: Date.now() - t0, installed, deps: Object.keys(deps), root };
  }

  // Install the child_process -> isolate-spawn bridge. The host rewrites npm's
  // `require('child_process')` to a shim that delegates here; we resolve the bin to a
  // JS entry and run it in a Worker-Loader child over the shared /tmp.
  installIsolateSpawn() {
    const self = this;
    const fs = nodeFs;
    globalThis.__SPAWN_LOG = globalThis.__SPAWN_LOG || [];
    globalThis.__ISOLATE_SPAWN = async (file, args, options = {}) => {
      const argv = resolveArgv(file, args);
      const cmd = argv[0];
      const entry = resolveBinToJs(fs, cmd, options);
      if (!entry) throw new Error("isolate-spawn: cannot resolve '" + cmd + "' (PATH=" + (options.env?.PATH || "") + ")");
      const res = await self.runNodeChild(entry, argv.slice(1), options);
      if (res?.stdout) globalThis.__SPAWN_LOG.push(res.stdout);
      if (res?.stderr) globalThis.__SPAWN_LOG.push(res.stderr);
      return res;
    };
  }

  async runNodeChild(entry, args, options) {
    const fs = nodeFs;
    // Replicate Node's shebang stripping (workerd's loader treats a leading `#!` as a
    // syntax error). Strip into a sibling so package type / relative imports / import.meta
    // dir are unchanged.
    let realEntry = entry;
    try {
      const head = fs.readFileSync(entry, "utf8");
      if (head.startsWith("#!")) {
        const slash = entry.lastIndexOf("/");
        realEntry = entry.slice(0, slash + 1) + "__nosheb_" + entry.slice(slash + 1);
        fs.writeFileSync(realEntry, head.replace(/^#![^\n]*\n/, "//\n"));
      }
    } catch {}
    const n = (globalThis.__SPAWN_N = (globalThis.__SPAWN_N || 0) + 1);
    const probePath = "/tmp/__spawn_probe_" + n + ".mjs";
    fs.writeFileSync(probePath, probeSrc(realEntry, args, options.cwd || PROJ, options.env || {}));
    const child = this.env.LOADER.get("isolate-spawn-" + n, () => nodeProcessChild(probePath));
    return await child.getEntrypoint().run();
  }

  // The REAL `npm create`/`npm exec`/`npx`: drive libnpmexec.exec UNMODIFIED. It
  // resolves+installs the package via Arborist, then spawns its bin -> our child_process
  // shim runs the real bin in a child over the shared /tmp.
  async execNpm(kind, rawArgs, cwd) {
    await patchProcessReport();
    this.installIsolateSpawn();
    globalThis.__SPAWN_LOG = [];
    const fs = nodeFs;
    const runPath = cwd || PROJ;
    const args = rawArgs.filter((a) => a !== "--");
    let packages = [], execArgs = [];
    if (kind === "create") {
      if (!args.length) throw new Error("usage: npm create <initializer> [args]");
      const { spec, bin } = initToCreatePkg(args[0]);
      packages = [spec];
      execArgs = [bin, ...args.slice(1)];
    } else {
      if (!args.length) throw new Error("usage: " + (kind === "npx" ? "npx" : "npm exec") + " <pkg> [args]");
      execArgs = args.slice();
    }
    fs.mkdirSync(runPath, { recursive: true });
    fs.mkdirSync(NPXCACHE, { recursive: true });
    fs.mkdirSync(CACHE, { recursive: true });
    const mod = await import("/tmp/xnm/npm/node_modules/libnpmexec/lib/index.js");
    const libexec = mod.default || mod;
    await libexec({
      args: execArgs,
      packages,
      path: runPath,
      runPath,
      yes: true,
      localBin: runPath + "/node_modules/.bin",
      globalBin: "",
      scriptShell: "sh",
      registry: "https://registry.npmjs.org/",
      cache: CACHE,
      npxCache: NPXCACHE,
      // Accommodations a real Node provides for free (none alter npm/bin logic):
      packumentCache: new Map(),
      nodeGyp: "/tmp/xnm/npm/node_modules/node-gyp/bin/node-gyp.js",
      env: { PATH: "/usr/bin:/bin" },
      chalk: { reset: (s) => s, dim: (s) => s, bold: (s) => s },
    });
    // The bin ran in a spawn child (shareParentTmp); files it created carry the child
    // isolate's node, and a later in-place write from this (parent) isolate trips a
    // workerd shared-VFS assertion (read is fine; in-place open-for-write crashes). Re-own
    // the scaffolded tree (read -> rm -> rewrite from here) so files are parent-owned and
    // editable with `sed -i` / `>` directly.
    if (kind === "create") {
      const targetName = args.slice(1).find((a) => !a.startsWith("-"));
      const targetDir = !targetName || targetName === "." ? runPath : runPath + "/" + targetName;
      try { this.reownTree(fs, targetDir); } catch {}
    }
    return { ok: true, spawnLog: (globalThis.__SPAWN_LOG || []).join("") };
  }

  // Re-materialize every file under dir from this (parent) isolate so subsequent in-place
  // writes don't hit the child-created-node assertion. read+rm+write is the proven-safe
  // sequence (a direct in-place overwrite of a child file crashes).
  reownTree(fs, dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = dir + "/" + e.name;
      if (e.isDirectory()) this.reownTree(fs, p);
      else if (e.isFile()) {
        const buf = fs.readFileSync(p);
        fs.rmSync(p);
        fs.writeFileSync(p, buf);
      }
    }
  }

  async scaffoldApp() {
    const fs = nodeFs;
    fs.mkdirSync(PROJ, { recursive: true });
    const res = await this.env.HOST.fetch("http://host/app-manifest");
    const manifest = await res.json();
    let files = 0;
    for (const [rel, b64] of Object.entries(manifest)) {
      if (rel === "package.json") continue; // keep our install package.json
      const p = PROJ + "/" + rel;
      fs.mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
      fs.writeFileSync(p, Buffer.from(b64, "base64"));
      files++;
    }
    // rolldown's wasm resolver treats a root-relative html src as fs-absolute.
    try {
      let html = fs.readFileSync(PROJ + "/index.html", "utf8");
      html = html.replace('src="/src/main.tsx"', 'src="./src/main.tsx"');
      fs.writeFileSync(PROJ + "/index.html", html);
    } catch {}
    return files;
  }

  async scaffoldDevProbe() {
    const fs = nodeFs;
    const res = await this.env.HOST.fetch("http://host/dev-probe");
    const src = await res.text();
    fs.writeFileSync(PROJ + "/vite-dev-probe.mjs", src);
    return src.length;
  }

  async viteBuild() {
    const fs = nodeFs;
    fs.writeFileSync(PROJ + "/vite-build-probe.mjs", `
      import { WorkerEntrypoint } from "cloudflare:workers";
      import * as nodeFs from "node:fs";
      ${CHILD_GLOBALS_PRELUDE}
      export default class extends WorkerEntrypoint {
        async run() {
          installGlobals(this.env);
          const out = {};
          globalThis.__WASI_NO_BUSY_SLEEP = true;
          globalThis.__TSFN_LOG = false;
          globalThis.__EMNAPI_SCHED = (cb) => queueMicrotask(cb);
          globalThis.__RD_ENV = { RD_LOG: "", RD_LOG_OUTPUT: "readable" };
          globalThis.__ROLLDOWN_FS = makeEnoentFs(nodeFs);
          globalThis.__WAIT_UNTIL = (p) => { try { this.ctx.waitUntil(p); } catch {} };
          try {
            await import("rolldown/dist/rolldown-binding.wasi-browser.js").catch(async () => {
              await import("/tmp/proj/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js");
            });
            if (globalThis.__ROLLDOWN_ENSURE_READY) await globalThis.__ROLLDOWN_ENSURE_READY();
            await import("rolldown");
          } catch (e) { out.error = "rolldown boot: " + String(e); return out; }
          try {
            const vite = await import("vite");
            const { default: react } = await import("@vitejs/plugin-react");
            const t0 = Date.now();
            await vite.build({
              root: "/tmp/proj", configFile: false, envFile: false, logLevel: "warn",
              plugins: [react()],
              build: { outDir: "/tmp/proj/dist", emptyOutDir: true, minify: false },
            });
            out.ok = true;
            out.buildMs = Date.now() - t0;
            out.viteVersion = vite.version;
            out.dist = nodeFs.readdirSync("/tmp/proj/dist");
            try { out.assets = nodeFs.readdirSync("/tmp/proj/dist/assets"); } catch {}
          } catch (e) {
            out.error = "vite.build: " + String(e);
            out.stack = (e && e.stack ? String(e.stack).split("\\n").slice(0,12) : []);
          }
          return out;
        }
      }
    `);
    const child = this.env.LOADER.get("workerd-bash-vite-build", () => viteBuildChild());
    return await child.getEntrypoint().run();
  }

  // ---- REAL vite bin dev server (cwd-driven) ----

  // Supply the node:http primitive + redirect the project's vite onto it, write the probe,
  // and resolve the real bin. Idempotent per root; returns the (shebang-stripped) bin path.
  async setupRealVite(root) {
    const fs = nodeFs;
    // node:http shim (child-visible native /tmp), written once.
    if (!fs.existsSync(VHTTP_SHIM)) {
      fs.mkdirSync(VSHIM_DIR, { recursive: true });
      fs.writeFileSync(VHTTP_SHIM, await (await this.env.HOST.fetch("http://host/vite-http-shim")).text());
    }
    const probePath = probePathFor(root);
    if (!fs.existsSync(probePath)) {
      fs.writeFileSync(probePath, await (await this.env.HOST.fetch("http://host/realbin-probe")).text());
    }
    // Redirect the installed vite's `import "node:http"` -> our shim (exact match leaves
    // node:http2 untouched). Provides the listening-server primitive; vite logic untouched.
    for (const f of [root + "/node_modules/vite/dist/node/chunks/node.js", root + "/node_modules/vite/dist/node/cli.js"]) {
      try {
        let src = fs.readFileSync(f, "utf8");
        if (!/["']node:http["']/.test(src)) continue;
        const out = src.replace(/(["'])node:http\1/g, JSON.stringify(VHTTP_SHIM));
        if (out !== src) fs.writeFileSync(f, out);
      } catch {}
    }
    // Resolve node_modules/vite's bin + shebang-strip (workerd's loader rejects a leading #!).
    const pkg = JSON.parse(fs.readFileSync(root + "/node_modules/vite/package.json", "utf8"));
    const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.vite;
    const binPath = root + "/node_modules/vite/" + rel.replace(/^\.\//, "");
    const head = fs.readFileSync(binPath, "utf8");
    if (head.startsWith("#!")) {
      const slash = binPath.lastIndexOf("/");
      const stripped = binPath.slice(0, slash + 1) + "__nosheb_" + binPath.slice(slash + 1);
      fs.writeFileSync(stripped, head.replace(/^#![^\n]*\n/, "//\n"));
      return stripped;
    }
    return binPath;
  }

  // Boot the real-bin vite dev server for `root` and remember it for the browser path.
  async bootRealVite(root) {
    const bin = await this.setupRealVite(root);
    const key = "vite-realbin:" + root;
    const child = this.env.LOADER.get(key, () => viteRealBinChild(this.env.DEV_PORT, bin, root));
    const result = await child.getEntrypoint().warmup();
    if (result?.ok) { this.devReady = true; this.devRoot = root; this.devBin = bin; }
    return result;
  }

  // ---- the interactive shell (just-bash + the toolchain commands) ----

  async getBash() {
    if (this.bash) return this.bash;
    const { Bash, defineCommand } = await import("just-bash");
    const { NativeFsAdapter } = await import("/tmp/bashshim/bash-native.mjs");
    nodeFs.mkdirSync(PROJ, { recursive: true });
    const bash = new Bash({ fs: new NativeFsAdapter(), cwd: PROJ, defenseInDepth: false });
    const self = this;

    // npm install [pkgs...] | npm ls | npm run dev
    const npm = defineCommand("npm", async (args, ctx) => {
      const sub = args[0];
      const cwd = ctx?.cwd || PROJ;
      if (sub === "install" || sub === "i" || sub === "add") {
        const specs = args.slice(1).filter((a) => !a.startsWith("-"));
        let extra = null;
        if (specs.length) { extra = {}; for (const s of specs) { const name = s.replace(/@[^@]*$/, "") || s; extra[name] = s.slice(name.length + 1) || "*"; } }
        try {
          const banner = `npm install${specs.length ? " " + specs.join(" ") : ""}  (Arborist -> ${cwd}/node_modules, public registry; can take a few minutes)\n`;
          const r = await self.npmInstall(extra, cwd);
          return { stdout: banner + `+ installed ${r.installed.length} packages in ${(r.ms / 1000).toFixed(1)}s\n` +
            `node_modules: ${r.installed.join(", ")}\n`, stderr: "", exitCode: 0 };
        } catch (e) {
          return { stdout: "", stderr: `npm install failed: ${e?.stack ?? e}\n`, exitCode: 1 };
        }
      }
      if (sub === "ls") {
        try {
          const ns = nodeFs.readdirSync(cwd + "/node_modules").filter((n) => !n.startsWith("."));
          return { stdout: ns.join("\n") + "\n", stderr: "", exitCode: 0 };
        } catch { return { stdout: "(no node_modules — run `npm install`)\n", stderr: "", exitCode: 0 }; }
      }
      if (sub === "run" && args[1] === "dev") return runViteDev(cwd);
      if (sub === "create" || sub === "init") return execNpmCmd("create", args.slice(1), ctx);
      if (sub === "exec") return execNpmCmd("exec", args.slice(1), ctx);
      return { stdout: "", stderr: `npm: supported here — install [pkgs], ls, run dev, create <initializer>, exec <pkg> (got: ${args.join(" ")})\n`, exitCode: 2 };
    });

    // Real `npm create`/`npm exec`/`npx` via libnpmexec + the child_process->isolate bridge.
    const execNpmCmd = async (kind, rest, ctx) => {
      const label = kind === "create" ? "npm create" : kind === "npx" ? "npx" : "npm exec";
      try {
        const r = await self.execNpm(kind, rest, ctx?.cwd || PROJ);
        return { stdout: (r.spawnLog || "") + "\n", stderr: "", exitCode: 0 };
      } catch (e) {
        return { stdout: "", stderr: `${label} failed: ${e?.stack ?? e}\n`, exitCode: 1 };
      }
    };
    const npx = defineCommand("npx", async (args, ctx) => execNpmCmd("npx", args, ctx));

    const doScaffold = async () => {
      try {
        const files = await self.scaffoldApp();
        return { stdout: `scaffolded ToDo app -> /tmp/proj (${files} files: index.html, src/, tailwind/postcss config)\n`, stderr: "", exitCode: 0 };
      } catch (e) { return { stdout: "", stderr: `scaffold failed: ${e}\n`, exitCode: 1 }; }
    };
    const scaffold = defineCommand("scaffold", doScaffold);

    // Run the REAL vite bin against the current project dir (whatever's in the pwd),
    // honoring its own vite.config. No hand-rolled createServer.
    const runViteDev = async (root) => {
      root = root || PROJ;
      if (!self.env.DEV_PORT) return { stdout: "", stderr: "vite dev needs a bound port (launch the REPL normally, not in --no-port mode)\n", exitCode: 1 };
      const url = `http://127.0.0.1:${self.env.DEV_PORT}/`;
      try {
        const fs = nodeFs;
        if (!fs.existsSync(root + "/node_modules/vite/package.json"))
          return { stdout: "", stderr: `no vite installed in ${root} — run \`npm install\` first\n`, exitCode: 1 };
        const t0 = Date.now();
        const warm = await self.bootRealVite(root);
        if (!warm?.ok) return { stdout: "", stderr: `vite dev failed to boot: ${warm?.error ?? "unknown"}\n${warm?.diag ? JSON.stringify(warm.diag).slice(0, 800) : ""}\n`, exitCode: 1 };
        return { stdout:
          `vite dev server is LIVE — REAL vite bin running from ${root} in a workerd child isolate\n` +
          `  booted in ${((Date.now() - t0) / 1000).toFixed(1)}s (config + plugins loaded from ${root}/vite.config; port ${warm.port})\n\n` +
          `  ->  open in your browser:  ${url}\n`,
          stderr: "", exitCode: 0 };
      } catch (e) { return { stdout: "", stderr: `vite dev failed: ${e?.stack ?? e}\n`, exitCode: 1 }; }
    };

    // vite build | vite dev
    const vite = defineCommand("vite", async (args, ctx) => {
      if (args[0] === "dev" || args[0] === "serve") return runViteDev(ctx?.cwd || PROJ);
      if (args[0] === "build" || !args[0]) {
        try {
          const fs = nodeFs;
          if (!fs.existsSync(PROJ + "/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js"))
            return { stdout: "", stderr: "no vite installed — run `npm install` first\n", exitCode: 1 };
          if (!fs.existsSync(PROJ + "/src/main.tsx")) await self.scaffoldApp();
          const r = await self.viteBuild();
          if (!r.ok) return { stdout: "", stderr: `vite build failed: ${r.error}\n${(r.stack || []).join("\n")}\n`, exitCode: 1 };
          return { stdout:
            `vite v${r.viteVersion} build complete in ${(r.buildMs / 1000).toFixed(1)}s (ran from /tmp in a child isolate)\n` +
            `dist/: ${r.dist.join(", ")}\n` +
            (r.assets ? `dist/assets/: ${r.assets.join(", ")}\n` : ""),
            stderr: "", exitCode: 0 };
        } catch (e) { return { stdout: "", stderr: `vite build failed: ${e?.stack ?? e}\n`, exitCode: 1 }; }
      }
      return { stdout: "", stderr: `vite: supported here — build, dev (got: ${args.join(" ")})\n`, exitCode: 2 };
    });

    for (const c of [npm, scaffold, vite, npx]) bash.registerCommand(c);
    this.bash = bash;
    return bash;
  }

  async fetch(request) {
    installGlobals(this.env);
    const url = new URL(request.url);
    const fs = nodeFs;

    if (url.pathname === "/init") {
      fs.mkdirSync(PROJ, { recursive: true });
      return Response.json({ ok: true, cwd: PROJ });
    }

    if (url.pathname === "/exec") {
      const body = await request.json();
      const bash = await this.getBash();
      const t0 = Date.now();
      try {
        const r = await bash.exec(body.cmd, { cwd: body.cwd || PROJ, ...(body.opts || {}) });
        return Response.json({ ok: true, ms: Date.now() - t0, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr });
      } catch (e) {
        return Response.json({ ok: false, error: String(e?.stack ?? e) }, { status: 500 });
      }
    }

    // Browser serve path: forward HTTP (and the HMR WebSocket upgrade) to the REAL vite
    // bin child for whichever project the user last `vite dev`'d (this.devRoot).
    if (this.env.DEV_PORT && url.pathname !== "/exec" && url.pathname !== "/init") {
      if (!this.devRoot) {
        return new Response("no vite dev server running yet — run `npm run dev` (or `vite dev`) in your project dir in the shell first.\n", { status: 503 });
      }
      const key = "vite-realbin:" + this.devRoot;
      const child = this.env.LOADER.get(key, () => viteRealBinChild(this.env.DEV_PORT, this.devBin, this.devRoot));
      const ep = child.getEntrypoint();
      const fwd = new Request(new URL(url.pathname + url.search, "http://vite.local"), request);
      return await ep.fetch(fwd);
    }

    return new Response("ops: POST /exec {cmd,cwd}, GET /init", { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    return env.SHELL.get(env.SHELL.idFromName("singleton")).fetch(request);
  },
};
