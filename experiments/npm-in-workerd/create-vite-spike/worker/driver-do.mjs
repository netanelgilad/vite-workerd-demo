// CREATE-VITE SPIKE driver: install the REAL `create-vite` from the public npm
// registry into a DO's native /tmp via Arborist, then run its REAL bundled bin
// (dist/index.js) UNMODIFIED inside a Worker-Loader child that shares the DO's
// /tmp (shareParentTmp) and resolves modules from it (vfsModuleFallback).
//
// We do NOT replace create-vite with a lookalike. We set process.argv the way
// `npm create vite` would (`create-vite cvout --template react-ts --no-interactive`)
// and let create-vite's own code copy its bundled template-react-ts/ into /tmp/cvout.
// This de-risks the whole "real npm create vite" feature: if the genuine bin runs
// here, the only remaining piece is bridging child_process.spawn -> this child run.
import * as nodeFs from "node:fs";

const ARBORIST = "/tmp/xnm/npm/node_modules/@npmcli/arborist/lib/index.js";
const NPX = "/tmp/cvnpx"; // where create-vite is installed (its own tree, like npm's _npx cache)
const CACHE = "/tmp/npmcache";
const TARGET = "/tmp/cvout"; // the scaffolded project

async function patchProcessReport() {
  const stub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };
  const targets = new Set([process, globalThis.process]);
  try {
    const m = await import("node:process");
    targets.add(m.default);
    targets.add(m);
  } catch {}
  for (const t of targets) {
    if (!t) continue;
    try { Object.defineProperty(t, "report", { configurable: true, value: stub }); } catch {}
  }
}

const CHILD_FLAGS = ["nodejs_compat", "nodejs_compat_v2", "experimental", "enable_nodejs_fs_module"];
const CHILD_COMPAT_DATE = "2026-06-01";

function createViteChild() {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    mainModule: "main.js",
    modules: { "main.js": `export { default } from "/tmp/cv-probe.mjs";` },
  };
}

// ---- the child_process -> isolate-spawn bridge (what makes REAL `npm exec` work) ----
// A generic Worker-Loader child that runs an arbitrary JS entry from the shared /tmp
// the way a spawned `node <entry> <args>` process would.
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

// Minimal POSIX-ish tokenizer for the `sh -c "<line>"` that promise-spawn builds.
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

// promise-spawn calls spawn('sh', ['-c', line], opts) (or cmd /d /s /c on win).
function resolveArgv(file, args = []) {
  const base = String(file || "").split("/").pop();
  if ((base === "sh" || base === "bash" || base === "zsh") && args[0] === "-c") return tokenize(args[1] || "");
  if ((base === "cmd" || base === "cmd.exe") && args.includes("/c")) return tokenize(args[args.indexOf("/c") + 1] || "");
  return [file, ...args];
}

function realOrSelf(fs, p) { try { return fs.realpathSync(p); } catch { return p; } }

// Resolve a bin name to the JS file a real `node` would execute, via PATH/.bin (the
// way the OS would) with a node_modules manifest-bin scan as a symlink-free fallback.
function resolveBinToJs(fs, cmd, options) {
  if (cmd.startsWith("/") && fs.existsSync(cmd)) return realOrSelf(fs, cmd);
  const env = options.env || {};
  const PATH = env.PATH || env.Path || "";
  const dirs = PATH.split(":").filter(Boolean);
  for (const dir of dirs) {
    const cand = dir + "/" + cmd;
    try { if (fs.existsSync(cand)) return realOrSelf(fs, cand); } catch {}
  }
  // Fallback: scan node_modules adjacent to each .bin dir for a package whose
  // manifest `bin` maps this command (works even when bin symlinks weren't laid down).
  for (const dir of dirs) {
    if (!dir.endsWith("/.bin")) continue;
    const nm = dir.slice(0, -"/.bin".length);
    const hit = scanNmForBin(fs, nm, cmd);
    if (hit) return hit;
  }
  return null;
}

function scanNmForBin(fs, nm, cmd) {
  let names = [];
  try { names = fs.readdirSync(nm); } catch { return null; }
  const pkgDirs = [];
  for (const n of names) {
    if (n.startsWith("@")) {
      try { for (const s of fs.readdirSync(nm + "/" + n)) pkgDirs.push(n + "/" + s); } catch {}
    } else pkgDirs.push(n);
  }
  for (const d of pkgDirs) {
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(nm + "/" + d + "/package.json", "utf8")); } catch { continue; }
    const bin = pkg.bin;
    const shortName = String(pkg.name || "").split("/").pop();
    if (typeof bin === "string" && (pkg.name === cmd || shortName === cmd)) return nm + "/" + d + "/" + bin.replace(/^\.\//, "");
    if (bin && typeof bin === "object" && bin[cmd]) return nm + "/" + d + "/" + String(bin[cmd]).replace(/^\.\//, "");
  }
  return null;
}

// The generic process probe: set the process contract a real `node <entry>` provides,
// import the entry, capture stdout/stderr, and resolve when the program settles.
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
      // Bins kick off main() un-awaited; resolve on process.exit, else quiescence, capped.
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

function walkDir(fs, dir, base) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + "/" + e.name;
    if (e.isDirectory()) out.push(...walkDir(fs, p, base));
    else out.push(p.slice(base.length + 1));
  }
  return out;
}

export class NpmChildRunner {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  // Faithful `npm install create-vite` (into its own tree, like npm's _npx cache):
  // Arborist resolves+fetches create-vite from https://registry.npmjs.org/ over the
  // DO's native fs. create-vite has ZERO runtime deps (fully bundled), so this is one
  // tiny package + its shipped template-* dirs.
  async installCreateVite(fs) {
    fs.mkdirSync(NPX, { recursive: true });
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(
      NPX + "/package.json",
      JSON.stringify({ name: "_npx", version: "1.0.0", private: true, dependencies: { "create-vite": "latest" } }, null, 2)
    );
    const t0 = Date.now();
    const { default: Arborist } = await import(ARBORIST);
    const arb = new Arborist({
      path: NPX,
      cache: CACHE,
      registry: "https://registry.npmjs.org/",
      ignoreScripts: true,
      audit: false,
      fund: false,
      progress: false,
      packumentCache: new Map(),
    });
    await arb.reify({ ignoreScripts: true, audit: false });
    const cvRoot = NPX + "/node_modules/create-vite";
    const pkg = (() => { try { return JSON.parse(fs.readFileSync(cvRoot + "/package.json", "utf8")); } catch { return null; } })();
    let templates = [];
    try { templates = fs.readdirSync(cvRoot).filter((n) => n.startsWith("template-")); } catch {}
    return {
      ok: true,
      op: "install-create-vite",
      ms: Date.now() - t0,
      version: pkg?.version,
      resolved: pkg?._resolved,
      binEntry: pkg?.bin,
      distExists: fs.existsSync(cvRoot + "/dist/index.js"),
      templateReactTs: fs.existsSync(cvRoot + "/template-react-ts"),
      templates,
    };
  }

  async runCreateVite(fs) {
    // The probe runs the REAL create-vite bin (dist/index.js) inside the child. It only
    // sets up the process contract a real `node create-vite ...` invocation provides:
    // process.argv, a cwd, a non-TTY stdin, and console capture. No create-vite code is
    // touched. create-vite kicks off main() un-awaited at module top-level, so we poll
    // /tmp/cvout for the scaffold to land, then settle.
    fs.writeFileSync(
      "/tmp/cv-probe.mjs",
      `
      import { WorkerEntrypoint } from "cloudflare:workers";
      import * as nodeFs from "node:fs";
      function walk(dir, base) {
        const out = [];
        for (const e of nodeFs.readdirSync(dir, { withFileTypes: true })) {
          const p = dir + "/" + e.name;
          if (e.isDirectory()) out.push(...walk(p, base));
          else out.push(p.slice(base.length + 1));
        }
        return out;
      }
      export default class extends WorkerEntrypoint {
        async run() {
          const out = { log: [] };
          const TARGET = ${JSON.stringify(TARGET)};
          try { nodeFs.rmSync(TARGET, { recursive: true, force: true }); } catch {}

          // --- process contract a real CLI invocation would provide ---
          const argv = ["node", "create-vite", "cvout", "--template", "react-ts", "--no-interactive"];
          const np = await import("node:process");
          for (const proc of new Set([np.default, np, globalThis.process])) {
            if (!proc) continue;
            try { proc.argv = argv.slice(); } catch {}
            try { proc.cwd = () => "/tmp"; } catch { try { Object.defineProperty(proc, "cwd", { configurable: true, value: () => "/tmp" }); } catch {} }
            try { if (proc.stdin) proc.stdin.isTTY = false; } catch {}
          }

          // --- console capture (create-vite prints via console + clack) ---
          const cap = (...a) => { out.log.push(a.map((x) => (typeof x === "string" ? x : (()=>{try{return JSON.stringify(x)}catch{return String(x)}})())).join(" ")); };
          const o = { log: console.log, error: console.error, warn: console.warn, info: console.info };
          console.log = cap; console.error = cap; console.warn = cap; console.info = cap;

          let importError = null;
          try {
            await import("/tmp/cvnpx/node_modules/create-vite/dist/index.js");
          } catch (e) { importError = String(e && e.stack || e); }

          // create-vite calls main().catch(...) at top-level (not awaited) -> poll for output.
          const sentinel = TARGET + "/package.json";
          let waited = 0;
          while (waited < 20000) {
            if (nodeFs.existsSync(sentinel)) break;
            await new Promise((r) => setTimeout(r, 100));
            waited += 100;
          }
          await new Promise((r) => setTimeout(r, 400)); // settle the tail of the copy

          console.log = o.log; console.error = o.error; console.warn = o.warn; console.info = o.info;

          out.importError = importError;
          out.waitedMs = waited;
          out.exists = nodeFs.existsSync(TARGET);
          try { out.files = walk(TARGET, TARGET).sort(); } catch (e) { out.files = ["ERR " + String(e)]; }
          try { out.pkg = JSON.parse(nodeFs.readFileSync(sentinel, "utf8")); } catch {}
          try { out.indexHtmlHead = nodeFs.readFileSync(TARGET + "/index.html", "utf8").slice(0, 160); } catch {}
          return out;
        }
      }
      `
    );
    const child = this.env.LOADER.get("create-vite-spike", () => createViteChild());
    return await child.getEntrypoint().run();
  }

  // Install the child_process -> isolate-spawn bridge: spawn() (via the host shim)
  // delegates here, where we resolve the bin to a JS entry and run it in a child.
  installIsolateSpawn() {
    const self = this;
    const fs = nodeFs;
    globalThis.__SPAWN_LOG = globalThis.__SPAWN_LOG || [];
    globalThis.__ISOLATE_SPAWN = async (file, args, options = {}) => {
      const argv = resolveArgv(file, args);
      const cmd = argv[0];
      const rest = argv.slice(1);
      const entry = resolveBinToJs(fs, cmd, options);
      if (!entry) throw new Error("isolate-spawn: cannot resolve '" + cmd + "' (PATH=" + (options.env?.PATH || "") + ")");
      const res = await self.runNodeChild(entry, rest, options);
      if (res?.stdout) globalThis.__SPAWN_LOG.push(res.stdout);
      if (res?.stderr) globalThis.__SPAWN_LOG.push(res.stderr);
      return res;
    };
  }

  async runNodeChild(entry, args, options) {
    const fs = nodeFs;
    // Node strips shebangs from module sources; workerd's loader doesn't, and an ESM
    // file starting with `#!` is a syntax error. Replicate Node by importing a
    // shebang-stripped sibling (same dir+ext -> identical package type / relative
    // imports / import.meta dir).
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
    fs.writeFileSync(probePath, probeSrc(realEntry, args, options.cwd || "/tmp", options.env || {}));
    const child = this.env.LOADER.get("isolate-spawn-" + n, () => nodeProcessChild(probePath));
    return await child.getEntrypoint().run();
  }

  // The REAL `npm create vite` path: drive libnpmexec.exec (the actual implementation
  // behind `npm exec`/`npm create`) UNMODIFIED. It resolves+installs create-vite into
  // the npx cache via Arborist, then spawns it -> our child_process shim runs the real
  // create-vite bin in a child over the shared /tmp.
  async execCreateVite(fs, opts = {}) {
    this.installIsolateSpawn();
    globalThis.__SPAWN_LOG = [];
    const runPath = "/tmp/proj";
    const project = opts.dir || "todo";
    fs.mkdirSync(runPath, { recursive: true });
    fs.mkdirSync("/tmp/npxcache", { recursive: true });
    fs.mkdirSync(CACHE, { recursive: true });
    try { fs.rmSync(runPath + "/" + project, { recursive: true, force: true }); } catch {}
    const t0 = Date.now();
    const mod = await import("/tmp/xnm/npm/node_modules/libnpmexec/lib/index.js");
    const libexec = mod.default || mod;
    await libexec({
      args: ["create-vite", project, "--template", "react-ts", "--no-interactive"],
      packages: [],
      path: runPath,
      runPath,
      yes: true,
      localBin: runPath + "/node_modules/.bin",
      globalBin: "",
      scriptShell: "sh",
      // flatOptions threaded into libnpmexec's internal Arborist + pacote:
      registry: "https://registry.npmjs.org/",
      cache: CACHE,
      npxCache: "/tmp/npxcache",
      // setPATH() only augments an EXISTING path-keyed env var with binPaths; workerd's
      // process.env has no PATH, so seed one (a real shell always has it). setPATH then
      // overwrites it with the npx-cache .bin path, which our spawn bridge resolves from.
      env: { PATH: "/usr/bin:/bin" },
      // Arborist builds its own PackumentCache (lru-cache) otherwise, which trips a
      // version quirk in workerd; a plain Map satisfies the same contract.
      packumentCache: new Map(),
      // makeSpawnArgs() does require.resolve('node-gyp/...') unless nodeGyp is supplied;
      // workerd's require has no .resolve, so provide the path (it's only ever exported
      // as the npm_config_node_gyp env var, which create-vite ignores).
      nodeGyp: "/tmp/xnm/npm/node_modules/node-gyp/bin/node-gyp.js",
      chalk: { reset: (s) => s, dim: (s) => s, bold: (s) => s },
    });
    const target = runPath + "/" + project;
    let files = [];
    try { files = walkDir(fs, target, target).sort(); } catch (e) { files = ["ERR " + String(e)]; }
    return {
      ok: fs.existsSync(target + "/package.json"),
      ms: Date.now() - t0,
      project,
      files,
      spawnLog: (globalThis.__SPAWN_LOG || []).join("").split("\n").filter(Boolean),
    };
  }

  async fetch(request) {
    await patchProcessReport();
    const fs = nodeFs;
    const url = new URL(request.url);
    try {
      if (url.pathname === "/install-cv") {
        return Response.json(await this.installCreateVite(fs));
      }
      if (url.pathname === "/run-cv") {
        const result = await this.runCreateVite(fs);
        return Response.json({ ok: !!result?.exists, op: "run-cv", result });
      }
      if (url.pathname === "/exec-cv") {
        const result = await this.execCreateVite(fs);
        return Response.json({ ok: result.ok, op: "exec-cv", result });
      }
      return new Response("ops: /install-cv /run-cv /exec-cv", { status: 404 });
    } catch (e) {
      return Response.json({ ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 40) }, { status: 500 });
    }
  }
}

export default {
  async fetch(request, env) {
    return env.RUNNER.get(env.RUNNER.idFromName("singleton")).fetch(request);
  },
};
