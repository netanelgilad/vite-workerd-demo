// BASE-IMAGE DO: boot a workerd-ready rootfs into the DO's native /tmp, then run the REAL
// npm bin from /usr in a Worker-Loader CHILD over the shared VFS — npm is no longer special,
// it's just another bin on the rootfs (like create-vite / vite). No host-mounted /tmp/xnm
// for npm: after boot, the child loads npm's code from the VFS via vfsModuleFallback.
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";

const CHILD_FLAGS = ["nodejs_compat", "nodejs_compat_v2", "experimental", "enable_nodejs_fs_module"];
const CHILD_COMPAT_DATE = "2026-06-01";
const NPM_BIN = "/tmp/usr/lib/node_modules/npm/bin/npm-cli.js";
// The standard npm CLI config flags every literal-bin invocation carries (same set the
// awaited programmatic flows used).
const NPM_CONFIG_FLAGS = ["--ignore-scripts", "--no-audit", "--no-fund", "--no-update-notifier",
  "--legacy-peer-deps", "--cache=/tmp/npmcache", "--registry=https://registry.npmjs.org/",
  "--userconfig=/tmp/.npmrc-u", "--globalconfig=/tmp/.npmrc-g"];

// workerd's module loader rejects a leading #! — write a stripped sibling and load that.
function shebangStripped(fs, bin) {
  try {
    const head = fs.readFileSync(bin, "utf8");
    if (head.startsWith("#!")) {
      const s = bin.lastIndexOf("/");
      const stripped = bin.slice(0, s + 1) + "__nosheb_" + bin.slice(s + 1);
      fs.writeFileSync(stripped, head.replace(/^#![^\n]*\n/, "//\n"));
      return stripped;
    }
  } catch {}
  return bin;
}

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__wasmCompile = async (b) => env.UNSAFE_EVAL.newWasmModule(b instanceof Uint8Array ? b : new Uint8Array(b));
  globalThis.__safeEval = (c) => env.UNSAFE_EVAL.eval(String(c));
  globalThis.__newFunction = (...a) => { const body = a.pop(); return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...a); };
}

async function patchProcessReport() {
  const stub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };
  const targets = new Set([process, globalThis.process]);
  try { const m = await import("node:process"); targets.add(m.default); targets.add(m); } catch {}
  for (const t of targets) { if (!t) continue; try { Object.defineProperty(t, "report", { configurable: true, value: stub }); } catch {} }
}

// ---- spawn bridge (proven; runs a JS entry from the VFS in a child as a "process") ----
function nodeProcessChild(probePath) {
  return {
    compatibilityDate: CHILD_COMPAT_DATE, compatibilityFlags: CHILD_FLAGS, allowExperimental: true,
    shareParentTmp: true, vfsModuleFallback: true, mainModule: "main.js",
    modules: { "main.js": `export { default } from ${JSON.stringify(probePath)};` },
  };
}

// The "node" shim: a sub-isolate that runs a bin as a supervised PROCESS. `drainProcess`
// (workerd-fork primitive) runs the isolate to event-loop quiescence after run() returns;
// the parent's `await child.run()` is waitpid. This is how we replace `node <script>`.
// Optional selfFetcher (= the DO's SELF binding) becomes the child's globalOutbound so a
// spawn bridge inside the child can fetch BACK to the DO's /isolate-spawn (npm create).
function nodeProcessChildDrain(probePath, selfFetcher) {
  return {
    compatibilityDate: CHILD_COMPAT_DATE, compatibilityFlags: CHILD_FLAGS, allowExperimental: true,
    shareParentTmp: true, vfsModuleFallback: true, drainProcess: true, mainModule: "main.js",
    ...(selfFetcher ? { globalOutbound: selfFetcher } : {}),
    modules: { "main.js": `export { default } from ${JSON.stringify(probePath)};` },
  };
}

// Probe = a process `main`: set argv/cwd, then `require()` the bin fire-and-forget. require
// is synchronous + in-context (dynamic import()'s microtask checkpoint would drop the
// IoContext -> "global scope" error). Output is appended to a VFS log the DO reads after
// the process exits (run() returns a snapshot BEFORE drainProcess runs npm's async work).
//
// KEEPALIVE (fork-primitive gap, measured): drainProcess's quiescence check counts pending
// TIMERS but NOT in-flight socket/HTTP I/O. A drain whose only remaining work is a network
// read ends immediately (a bare https.get dies ~20ms into the drain; the same 15 MB
// packument body streams fully in ~1.6s if any timer chain is live). npm only survived
// small installs by riding incidental timers. Until the fork counts I/O as work, the probe
// emulates node's active-handle refcount: a timer chain keeps the process alive until the
// bin calls process.exit (npm's exit-handler always does) or a hard deadline passes.
//
// withSpawnBridge (used by `npm create` via the literal bin): install __ISOLATE_SPAWN so
// npm's baked child_process shim can spawn create-vite — the fetch goes over the child's
// globalOutbound (= the DO's SELF Fetcher) back to /isolate-spawn. Critically, npm calls
// spawn AFTER run() returns, i.e. DURING the drain phase — drainProcess keeps the
// IoContext bound so the fetch still works; any failure is appended to the log verbatim.
// Also sets env.PATH (so @npmcli/run-script's setPATH has a PATH key to prepend the npx
// .bin dirs to — workerd's process.env has none) and stubs process.report (the
// npm-install-checks libc probe segfaults workerd; same guard as the libnpmexec child).
function drainBinProbeSrc(binEntry, argv, cwd, outLog, withSpawnBridge = false) {
  const bridge = !withSpawnBridge ? "" : `
      globalThis.__ISOLATE_SPAWN = async (file, args, options = {}) => {
        try {
          const r = await fetch("http://self/isolate-spawn", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ file, args, options: { cwd: options.cwd, env: options.env } }),
          });
          return await r.json();
        } catch (e) {
          append("[__ISOLATE_SPAWN failed during drain] " + (e && e.stack || e) + "\\n");
          return { code: 1, signal: null, stdout: "", stderr: "isolate-spawn bridge failed: " + String(e) };
        }
      };
      const reportStub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };`;
  return `
  import { WorkerEntrypoint } from "cloudflare:workers";
  export default class extends WorkerEntrypoint {
    async run() {
      const np = await import("node:process");
      const nfs = await import("node:fs");
      const mod = await import("node:module");
      const OUT = ${JSON.stringify(outLog)};
      try { nfs.writeFileSync(OUT, ""); } catch {}
      const append = (s) => { try { nfs.appendFileSync(OUT, typeof s === "string" ? s : String(s)); } catch {} return true; };
      // A rejection nobody awaits would otherwise kill the drain silently — log it.
      const logReason = (tag) => (r) => append("[" + tag + "] " + (r && (r.stack || r.reason && (r.reason.stack || r.reason) || r)) + "\\n");
      try { globalThis.addEventListener("unhandledrejection", logReason("unhandledrejection")); } catch {}
      try { globalThis.addEventListener("error", logReason("uncaught error")); } catch {}
      try { np.default.on && np.default.on("unhandledRejection", logReason("process unhandledRejection")); } catch {}
      try { np.default.on && np.default.on("uncaughtException", logReason("process uncaughtException")); } catch {}${bridge}
      let exitCode = null;
      const exitFn = (c) => { if (exitCode === null) { exitCode = c == null ? 0 : c; append("[process exited code=" + exitCode + "]\\n"); } };
      for (const p of new Set([np.default, np, globalThis.process].filter(Boolean))) {
        try { p.argv = ${JSON.stringify(argv)}.slice(); } catch {}
        try { p.cwd = () => ${JSON.stringify(cwd)}; } catch { try { Object.defineProperty(p, "cwd", { configurable: true, value: () => ${JSON.stringify(cwd)} }); } catch {} }
        try { if (p.stdin) p.stdin.isTTY = false; } catch {}
        try { p.exit = exitFn; } catch {}
        ${withSpawnBridge ? `try { p.env = Object.assign(p.env || {}, { PATH: "/usr/bin:/bin", HOME: "/tmp" }); } catch {}
        try { Object.defineProperty(p, "report", { configurable: true, value: reportStub }); } catch {}` : ""}
      }
      // honor write(chunk, [enc], cb) callbacks — npm's exit-handler flushes stdout/stderr
      // with empty writes and only calls process.exit from the write callback chain.
      const writeFn = (s, enc, cb) => { append(s); const f = typeof enc === "function" ? enc : cb; if (typeof f === "function") queueMicrotask(f); return true; };
      try { np.default.stdout.write = writeFn; } catch {}
      try { np.default.stderr.write = writeFn; } catch {}
      // active-handle keepalive: sustain the drain (timers count as work, sockets don't)
      // until the bin exits; the chain then stops and the drain reaches quiescence.
      const DEADLINE = Date.now() + 240000;
      const keepalive = () => { if (exitCode === null && Date.now() < DEADLINE) setTimeout(keepalive, 200); };
      setTimeout(keepalive, 200);
      const require = mod.createRequire(${JSON.stringify(cwd + "/x.js")});
      try { require(${JSON.stringify(binEntry)}); } catch (e) { append("[require threw] " + (e && e.stack || e) + "\\n"); }
      return { started: true };
    }
  }`;
}
// The libnpmexec child: runs npm's REAL `npm exec` engine FROM THE VFS (vfsModuleFallback).
// globalOutbound = the DO's SELF Fetcher, so the child's __ISOLATE_SPAWN can fetch back to
// the DO's /isolate-spawn to run the create-vite bin (the child has no LOADER of its own).
function libnpmexecChild(probePath, selfFetcher) {
  return {
    compatibilityDate: CHILD_COMPAT_DATE, compatibilityFlags: CHILD_FLAGS, allowExperimental: true,
    shareParentTmp: true, vfsModuleFallback: true, globalOutbound: selfFetcher, mainModule: "main.js",
    modules: { "main.js": `export { default } from ${JSON.stringify(probePath)};` },
  };
}

// The probe that runs inside the libnpmexec child: install __ISOLATE_SPAWN (fetch back to the
// DO), patch process.report (libc probe segfault guard), then await libnpmexec UNMODIFIED.
function libnpmexecProbeSrc(libexecEntry, opts) {
  return `
  import { WorkerEntrypoint } from "cloudflare:workers";
  export default class extends WorkerEntrypoint {
    async run() {
      const out = [], err = [];
      const np = await import("node:process");
      // The baked child_process shim calls globalThis.__ISOLATE_SPAWN(file,args,opts). We send
      // it to the DO over globalOutbound (plain fetch is routed to env.SELF) and return the
      // {code,stdout,stderr} the shim turns back into a ChildProcess.
      globalThis.__ISOLATE_SPAWN = async (file, args, options = {}) => {
        const safeOpts = { cwd: options.cwd, env: options.env };
        const r = await fetch("http://self/isolate-spawn", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ file, args, options: safeOpts }),
        });
        return await r.json();
      };
      // process.report.getReport() (npm-install-checks libc probe) segfaults workerd -> stub.
      const stub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };
      for (const t of new Set([np.default, np, globalThis.process].filter(Boolean))) {
        try { Object.defineProperty(t, "report", { configurable: true, value: stub }); } catch {}
        try { if (t.stdin) t.stdin.isTTY = false; } catch {}
      }
      try { np.default.stdout.write = (s) => { out.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
      try { np.default.stderr.write = (s) => { err.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
      let error = null;
      try {
        const mod = await import(${JSON.stringify(libexecEntry)});
        const libexec = mod.default || mod;
        await libexec({
          ...${JSON.stringify(opts)},
          // Arborist's PackumentCache lru-cache trips a version quirk in workerd; a plain Map
          // satisfies the same contract. (Built here, not serialized through the probe args.)
          packumentCache: new Map(),
          chalk: { reset: (s) => s, dim: (s) => s, bold: (s) => s },
        });
      } catch (e) { error = String(e && e.stack || e); }
      return { stdout: out.join(""), stderr: err.join(""), error };
    }
  }`;
}

function tokenize(line) {
  const out = []; let cur = "", q = null, has = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; else if (q === '"' && ch === "\\" && i + 1 < line.length) cur += line[++i]; else cur += ch; }
    else if (ch === "'" || ch === '"') { q = ch; has = true; }
    else if (ch === "\\" && i + 1 < line.length) { cur += line[++i]; has = true; }
    else if (ch === " " || ch === "\t" || ch === "\n") { if (has || cur) { out.push(cur); cur = ""; has = false; } }
    else { cur += ch; has = true; }
  }
  if (has || cur) out.push(cur);
  return out;
}
function resolveArgv(file, args = []) {
  const base = String(file || "").split("/").pop();
  if ((base === "sh" || base === "bash" || base === "zsh") && args[0] === "-c") return tokenize(args[1] || "");
  return [file, ...args];
}
function realOrSelf(fs, p) { try { return fs.realpathSync(p); } catch { return p; } }
function scanNmForBin(fs, nm, cmd) {
  let names = []; try { names = fs.readdirSync(nm); } catch { return null; }
  const dirs = [];
  for (const n of names) { if (n.startsWith("@")) { try { for (const s of fs.readdirSync(nm + "/" + n)) dirs.push(n + "/" + s); } catch {} } else dirs.push(n); }
  for (const d of dirs) {
    let pkg; try { pkg = JSON.parse(fs.readFileSync(nm + "/" + d + "/package.json", "utf8")); } catch { continue; }
    const bin = pkg.bin, short = String(pkg.name || "").split("/").pop();
    if (typeof bin === "string" && (pkg.name === cmd || short === cmd)) return nm + "/" + d + "/" + bin.replace(/^\.\//, "");
    if (bin && typeof bin === "object" && bin[cmd]) return nm + "/" + d + "/" + String(bin[cmd]).replace(/^\.\//, "");
  }
  return null;
}
function resolveBinToJs(fs, cmd, options) {
  if (cmd.startsWith("/") && fs.existsSync(cmd)) return realOrSelf(fs, cmd);
  const dirs = String((options.env || {}).PATH || "").split(":").filter(Boolean);
  for (const dir of dirs) { const cand = dir + "/" + cmd; try { if (fs.existsSync(cand)) return realOrSelf(fs, cand); } catch {} }
  for (const dir of dirs) { if (dir.endsWith("/.bin")) { const hit = scanNmForBin(fs, dir.slice(0, -5), cmd); if (hit) return hit; } }
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
      const now = () => Date.now(); let last = now();
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
      console.log = (...a) => { last = now(); out.push(enc(a) + "\\n"); };
      console.info = (...a) => { last = now(); out.push(enc(a) + "\\n"); };
      console.warn = (...a) => { last = now(); err.push(enc(a) + "\\n"); };
      console.error = (...a) => { last = now(); err.push(enc(a) + "\\n"); };
      try { np.default.stdout.write = (s) => { last = now(); out.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
      try { np.default.stderr.write = (s) => { last = now(); err.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
      let importErr = null;
      last = now();
      try { await import(ENTRY); }
      catch (e) { if (e && typeof e === "object" && "__ISOLATE_EXIT__" in e) exitCode = e.__ISOLATE_EXIT__; else importErr = String(e && e.stack || e); }
      const QUIET = 1500, MAX = 240000, t0 = now();
      while (exitCode === null && (now() - t0) < MAX) { if (now() - last > QUIET) break; await new Promise((r) => setTimeout(r, 100)); }
      return { code: exitCode == null ? 0 : exitCode, signal: null, stdout: out.join(""), stderr: err.join(""), importErr };
    }
  }`;
}
function walkDir(fs, dir, base) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + "/" + e.name;
    if (e.isDirectory()) out.push(...walkDir(fs, p, base)); else out.push(p.slice(base.length + 1));
  }
  return out;
}

export class NpmBaseImage {
  constructor(state, env) { this.state = state; this.env = env; }

  // Write the base-image manifest (path -> base64) into native /tmp via sync writes
  // (avoids the async tar-write bug). After this, /usr/... lives in the VFS.
  async boot() {
    const fs = nodeFs;
    if (fs.existsSync(NPM_BIN)) return { ok: true, cached: true };
    const res = await this.env.HOST.fetch("http://host/image-manifest");
    const manifest = await res.json();
    let files = 0;
    for (const [rel, b64] of Object.entries(manifest)) {
      const p = "/tmp/" + rel; // VFS is writable under /tmp -> rootfs at /tmp/usr
      fs.mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
      fs.writeFileSync(p, Buffer.from(b64, "base64"));
      files++;
    }
    return { ok: true, files, npm: fs.existsSync(NPM_BIN) };
  }

  // Run a resolved JS bin entry in a sub-isolate as a "process" (shared /tmp). Used by
  // isolateSpawn() to launch the create-vite bin the libnpmexec child asked us to spawn.
  async runNodeChild(entry, args, options) {
    const fs = nodeFs;
    const realEntry = shebangStripped(fs, entry);
    const n = (globalThis.__SPAWN_N = (globalThis.__SPAWN_N || 0) + 1);
    const probePath = "/tmp/__spawn_probe_" + n + ".mjs";
    fs.writeFileSync(probePath, probeSrc(realEntry, args, options.cwd || "/tmp", options.env || {}));
    const child = this.env.LOADER.get("base-image-spawn-" + n, () => nodeProcessChild(probePath));
    return await child.getEntrypoint().run();
  }

  // Run the REAL npm install command from the VFS in a child — npm's own programmatic entry
  // (`new Npm(); await npm.load(); await npm.exec(...)`), AWAITED inside run() so npm's async
  // work stays in the child's I/O context (the fire-and-forget bin loses it -> workerd
  // "global scope" error, same lesson as vite's cac bin).
  async npmInstall(pkg) {
    const fs = nodeFs;
    const root = "/tmp/proj";
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync("/tmp/npmcache", { recursive: true });
    const argv = ["node", "npm", "install", pkg, ...NPM_CONFIG_FLAGS];
    const probePath = "/tmp/__npm_probe.mjs";
    fs.writeFileSync(probePath, `
      import { WorkerEntrypoint } from "cloudflare:workers";
      export default class extends WorkerEntrypoint {
        async run() {
          const out = [], err = [];
          const np = await import("node:process");
          for (const p of new Set([np.default, np, globalThis.process].filter(Boolean))) {
            try { p.argv = ${JSON.stringify(argv)}.slice(); } catch {}
            try { p.cwd = () => ${JSON.stringify(root)}; } catch { try { Object.defineProperty(p, "cwd", { configurable: true, value: () => ${JSON.stringify(root)} }); } catch {} }
            try { if (p.stdin) p.stdin.isTTY = false; } catch {}
          }
          try { np.default.stdout.write = (s) => { out.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
          try { np.default.stderr.write = (s) => { err.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
          let error = null;
          try {
            const NpmMod = await import("/tmp/usr/lib/node_modules/npm/lib/npm.js");
            const Npm = NpmMod.default || NpmMod;
            const npm = new Npm();
            const { command, args } = await npm.load();
            if (command) await npm.exec(command, args);
          } catch (e) { error = String(e && e.stack || e); }
          return { stdout: out.join(""), stderr: err.join(""), error };
        }
      }`);
    const t0 = Date.now();
    const child = this.env.LOADER.get("npm-runner", () => nodeProcessChild(probePath));
    const res = await child.getEntrypoint().run();
    let installed = [];
    try { installed = fs.readdirSync(root + "/node_modules").filter((n) => !n.startsWith(".")); } catch {}
    let pkgJson = null; try { pkgJson = fs.readFileSync(root + "/package.json", "utf8"); } catch {}
    return { ms: Date.now() - t0, installed, pkgJson, run: res };
  }

  // Run the LITERAL npm bin (fire-and-forget, exactly `node npm-cli.js install <pkg>`) in a
  // drainProcess sub-isolate. This is "node <bin>" shimmed by a supervised sub-isolate — the
  // bin isn't awaited by any code; the runtime runs the process to quiescence and the parent
  // await is waitpid. No programmatic npm.exec, no userland poll loop.
  async npmInstallBin(pkg) {
    const fs = nodeFs;
    const root = "/tmp/proj";
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync("/tmp/npmcache", { recursive: true });
    // shebang-strip npm-cli.js (workerd's loader rejects a leading #!); require the stripped copy.
    const entry = shebangStripped(fs, NPM_BIN);
    const argv = ["node", "npm", "install", pkg, ...NPM_CONFIG_FLAGS];
    const outLog = "/tmp/__npm_bin_out.log";
    const probePath = "/tmp/__npm_bin_probe.mjs";
    fs.writeFileSync(probePath, drainBinProbeSrc(entry, argv, root, outLog));
    const t0 = Date.now();
    const child = this.env.LOADER.get("npm-bin-runner", () => nodeProcessChildDrain(probePath));
    const started = await child.getEntrypoint().run(); // waitpid: resolves after drainProcess drains npm
    let installed = [];
    try { installed = fs.readdirSync(root + "/node_modules").filter((n) => !n.startsWith(".")); } catch {}
    let pkgJson = null; try { pkgJson = fs.readFileSync(root + "/package.json", "utf8"); } catch {}
    let output = ""; try { output = fs.readFileSync(outLog, "utf8"); } catch {}
    return { ms: Date.now() - t0, installed, pkgJson, output, started };
  }

  // ---- `npm create vite` over the BASE IMAGE -------------------------------------------
  // `npm create vite` == `npm exec create-vite`. We drive npm's REAL `npm exec` engine
  // (libnpmexec) UNMODIFIED, loaded FROM THE VFS (/tmp/usr/...) — the same baked npm tree
  // boot laid down, NOT a host mount. libnpmexec resolves+installs create-vite into the npx
  // cache (Arborist + pacote over the VFS), then spawns the real create-vite bin.
  //
  // Isolate layout (3 levels, all sharing the DO's native /tmp via shareParentTmp):
  //   DO (this isolate)  -- holds env.LOADER + env.SELF; serves /isolate-spawn
  //     └─ libnpmexec child (vfsModuleFallback)  -- runs npm's exec engine FROM THE VFS.
  //        Its baked child_process shim calls globalThis.__ISOLATE_SPAWN, which we wire to
  //        fetch BACK to the DO's /isolate-spawn (the child has no LOADER of its own — a
  //        WorkerLoader binding can't be passed into a child, but a Fetcher can, so the
  //        child's globalOutbound = env.SELF routes its fetch back into the DO).
  //          └─ create-vite sub-isolate  -- the DO spawns the REAL create-vite bin here.
  //
  // The DO cannot itself import VFS modules (vfsModuleFallback is a child-only flag and the
  // DO has no module-fallback service), which is why libnpmexec runs one level down.
  async npmCreateVite(project = "myapp", template = "react-ts") {
    const fs = nodeFs;
    const runPath = "/tmp/proj";
    fs.mkdirSync(runPath, { recursive: true });
    fs.mkdirSync("/tmp/npxcache", { recursive: true });
    fs.mkdirSync("/tmp/npmcache", { recursive: true });
    try { fs.rmSync(runPath + "/" + project, { recursive: true, force: true }); } catch {}
    const t0 = Date.now();
    const NPM_NM = "/tmp/usr/lib/node_modules/npm/node_modules";
    const opts = {
      // `npm create vite myapp -- --template react-ts` -> exec create-vite with these argv.
      args: ["create-vite", project, "--template", template, "--no-interactive"],
      packages: ["create-vite"],
      path: runPath, runPath, yes: true,
      localBin: runPath + "/node_modules/.bin", globalBin: "", scriptShell: "sh",
      registry: "https://registry.npmjs.org/", cache: "/tmp/npmcache", npxCache: "/tmp/npxcache",
      // Accommodations a real Node provides for free (none alter npm/bin logic):
      nodeGyp: NPM_NM + "/node-gyp/bin/node-gyp.js",
      env: { PATH: "/usr/bin:/bin" },
    };
    const probePath = "/tmp/__libnpmexec_probe.mjs";
    fs.writeFileSync(probePath, libnpmexecProbeSrc(NPM_NM + "/libnpmexec/lib/index.js", opts));
    const child = this.env.LOADER.get("libnpmexec-create", () => libnpmexecChild(probePath, this.env.SELF));
    const run = await child.getEntrypoint().run();
    const target = runPath + "/" + project;
    // create-vite's files were written by the create-vite sub-isolate; re-own them from THIS
    // (DO) isolate so the later `npm install` (repin sed + reify) can write in place.
    try { this.reownTree(fs, target); } catch {}
    let files = [];
    try { files = walkDir(fs, target, target).sort(); } catch (e) { files = ["ERR " + String(e)]; }
    let pkg = null; try { pkg = JSON.parse(fs.readFileSync(target + "/package.json", "utf8")); } catch {}
    return {
      ok: fs.existsSync(target + "/package.json"),
      ms: Date.now() - t0,
      project, target, files, pkg, run,
    };
  }

  // Service handler the libnpmexec child fetches (via its globalOutbound = env.SELF) when its
  // child_process shim spawns the create-vite bin. The DO resolves the bin to a JS entry over
  // the shared VFS and runs it in a sub-isolate, returning the captured stdout/stderr/code —
  // exactly the contract @npmcli/promise-spawn expects from a spawned process.
  async isolateSpawn(payload) {
    const fs = nodeFs;
    const { file, args = [], options = {} } = payload;
    const argv = resolveArgv(file, args);
    const entry = resolveBinToJs(fs, argv[0], options);
    if (!entry) return { code: 127, signal: null, stdout: "", stderr: "isolate-spawn: cannot resolve '" + argv[0] + "' (PATH=" + (options.env?.PATH || "") + ")\n" };
    return await this.runNodeChild(entry, argv.slice(1), options);
  }

  // Re-materialize every file under dir from THIS isolate. Files created by a spawn
  // sub-isolate carry that isolate's node in the shared VFS; an in-place open-for-write
  // from the parent trips a workerd shared-VFS assertion (read is fine). read -> rm ->
  // write is the proven-safe re-own sequence (from workerd-bash/shell-do).
  reownTree(fs, dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = dir + "/" + e.name;
      if (e.isDirectory()) this.reownTree(fs, p);
      else if (e.isFile()) { const buf = fs.readFileSync(p); fs.rmSync(p); fs.writeFileSync(p, buf); }
    }
  }

  // Repin the scaffolded app's deps to the workerd-ready vite/rolldown fork, then run the
  // REAL `npm install` inside it — npm's programmatic entry, AWAITED in a child over the VFS
  // (same mechanism as npmInstall). After this the app's node_modules holds vite + rolldown.
  // Repin the scaffold's deps to the workerd-ready forks: vite -> @netanelgilad/vite, plus
  // add the rolldown fork (create-vite's react-ts template depends on a plain "vite", which
  // won't run in workerd). sed-style rewrite of the real package.json the scaffold produced.
  repinScaffold(fs, target) {
    const pkg = JSON.parse(fs.readFileSync(target + "/package.json", "utf8"));
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.dependencies = pkg.dependencies || {};
    const VITE_FORK = "npm:@netanelgilad/vite@8.0.16-workerd.0";
    const ROLLDOWN_FORK = "npm:@netanelgilad/rolldown@1.0.3-workerd.0";
    if ("vite" in pkg.devDependencies) pkg.devDependencies.vite = VITE_FORK;
    else if ("vite" in pkg.dependencies) pkg.dependencies.vite = VITE_FORK;
    else pkg.devDependencies.vite = VITE_FORK;
    pkg.devDependencies.rolldown = ROLLDOWN_FORK;
    fs.writeFileSync(target + "/package.json", JSON.stringify(pkg, null, 2) + "\n");
  }

  async npmInstallApp(project = "myapp") {
    const fs = nodeFs;
    const target = "/tmp/proj/" + project;
    if (!fs.existsSync(target + "/package.json")) throw new Error("no scaffold at " + target);
    this.repinScaffold(fs, target);

    const argv = ["node", "npm", "install", ...NPM_CONFIG_FLAGS];
    const probePath = "/tmp/__npm_install_app_probe.mjs";
    fs.writeFileSync(probePath, `
      import { WorkerEntrypoint } from "cloudflare:workers";
      export default class extends WorkerEntrypoint {
        async run() {
          const out = [], err = [];
          const np = await import("node:process");
          for (const p of new Set([np.default, np, globalThis.process].filter(Boolean))) {
            try { p.argv = ${JSON.stringify(argv)}.slice(); } catch {}
            try { p.cwd = () => ${JSON.stringify(target)}; } catch { try { Object.defineProperty(p, "cwd", { configurable: true, value: () => ${JSON.stringify(target)} }); } catch {} }
            try { if (p.stdin) p.stdin.isTTY = false; } catch {}
          }
          try { np.default.stdout.write = (s) => { out.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
          try { np.default.stderr.write = (s) => { err.push(typeof s === "string" ? s : String(s)); return true; }; } catch {}
          let error = null;
          try {
            const NpmMod = await import("/tmp/usr/lib/node_modules/npm/lib/npm.js");
            const Npm = NpmMod.default || NpmMod;
            const npm = new Npm();
            const { command, args } = await npm.load();
            if (command) await npm.exec(command, args);
          } catch (e) { error = String(e && e.stack || e); }
          return { stdout: out.join(""), stderr: err.join(""), error };
        }
      }`);
    const t0 = Date.now();
    const child = this.env.LOADER.get("npm-install-app-runner", () => nodeProcessChild(probePath));
    const run = await child.getEntrypoint().run();
    let installed = [];
    try { installed = fs.readdirSync(target + "/node_modules").filter((n) => !n.startsWith(".")); } catch {}
    const hasVite = installed.includes("vite");
    const hasRolldown = installed.includes("rolldown");
    let pkgJson = null; try { pkgJson = fs.readFileSync(target + "/package.json", "utf8"); } catch {}
    return { ms: Date.now() - t0, project, count: installed.length, hasVite, hasRolldown,
      installed: installed.sort(), pkgJson, run };
  }

  // ---- `npm create vite` via the LITERAL npm bin (recursive-process test) ---------------
  // Same result as npmCreateVite, but npm is NOT driven programmatically: the drain child
  // runs `node npm-cli.js create vite myapp -- --template react-ts --no-interactive`
  // fire-and-forget (require + drainProcess = the process model), and npm's cmd-list maps
  // create->init->libnpmexec INSIDE that process. This is the recursive-process test:
  // process 1 (npm) spawns process 2 (create-vite) via the baked child_process shim ->
  // __ISOLATE_SPAWN -> globalOutbound(SELF) -> the DO's /isolate-spawn -> LOADER sub-isolate.
  // The spawn happens DURING the drain phase (after run() returned) — drainProcess keeps
  // the IoContext bound, so the bridge fetch is expected to work there.
  async npmCreateViteBin(project = "myapp", template = "react-ts") {
    const fs = nodeFs;
    const runPath = "/tmp/proj";
    fs.mkdirSync(runPath, { recursive: true });
    fs.mkdirSync("/tmp/npmcache", { recursive: true });
    try { fs.rmSync(runPath + "/" + project, { recursive: true, force: true }); } catch {}
    const entry = shebangStripped(fs, NPM_BIN);
    // Literal CLI argv for `npm create vite myapp -- --template react-ts --no-interactive`:
    // --yes answers libnpmexec's install-confirm prompt (init.js reads config.get('yes'));
    // --script-shell=sh keeps promise-spawn on the sh -c path our spawn bridge tokenizes;
    // --node-gyp pins the config default (workerd's CJS require has no require.resolve, and
    // make-spawn-args falls back to require.resolve when the option is empty — the same
    // accommodation the awaited flow makes by passing `nodeGyp` into libexec directly);
    // args after `--` go verbatim to the create-vite bin.
    const argv = ["node", "npm", "create", "vite", project, "--yes", "--script-shell=sh",
      "--node-gyp=/tmp/usr/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js",
      ...NPM_CONFIG_FLAGS, "--", "--template", template, "--no-interactive"];
    const outLog = "/tmp/__npm_create_bin_out.log";
    const probePath = "/tmp/__npm_create_bin_probe.mjs";
    fs.writeFileSync(probePath, drainBinProbeSrc(entry, argv, runPath, outLog, true));
    const t0 = Date.now();
    const child = this.env.LOADER.get("npm-create-bin-runner", () => nodeProcessChildDrain(probePath, this.env.SELF));
    const started = await child.getEntrypoint().run(); // waitpid: drain runs npm create incl. the spawn hop
    const target = runPath + "/" + project;
    // scaffold files were written by the create-vite sub-isolate; re-own for later writes.
    try { this.reownTree(fs, target); } catch {}
    let files = [];
    try { files = walkDir(fs, target, target).sort(); } catch (e) { files = ["ERR " + String(e)]; }
    let pkg = null; try { pkg = JSON.parse(fs.readFileSync(target + "/package.json", "utf8")); } catch {}
    let output = ""; try { output = fs.readFileSync(outLog, "utf8"); } catch {}
    return { ok: fs.existsSync(target + "/package.json"), ms: Date.now() - t0,
      project, target, files, pkg, output, started };
  }

  // `npm install` inside the scaffold via the LITERAL bin (same repin as npmInstallApp, but
  // the install is a fire-and-forget drain-child process instead of awaited npm.exec).
  // No spawn bridge needed: --ignore-scripts means npm spawns nothing during install.
  async npmInstallAppBin(project = "myapp") {
    const fs = nodeFs;
    const target = "/tmp/proj/" + project;
    if (!fs.existsSync(target + "/package.json")) throw new Error("no scaffold at " + target);
    this.repinScaffold(fs, target);
    const entry = shebangStripped(fs, NPM_BIN);
    const argv = ["node", "npm", "install", ...NPM_CONFIG_FLAGS];
    const outLog = "/tmp/__npm_install_app_bin_out.log";
    const probePath = "/tmp/__npm_install_app_bin_probe.mjs";
    fs.writeFileSync(probePath, drainBinProbeSrc(entry, argv, target, outLog));
    const t0 = Date.now();
    const child = this.env.LOADER.get("npm-install-app-bin-runner", () => nodeProcessChildDrain(probePath));
    const started = await child.getEntrypoint().run(); // waitpid
    let installed = [];
    try { installed = fs.readdirSync(target + "/node_modules").filter((n) => !n.startsWith(".")); } catch {}
    const hasVite = installed.includes("vite");
    const hasRolldown = installed.includes("rolldown");
    let output = ""; try { output = fs.readFileSync(outLog, "utf8"); } catch {}
    let pkgJson = null; try { pkgJson = fs.readFileSync(target + "/package.json", "utf8"); } catch {}
    return { ms: Date.now() - t0, project, count: installed.length, hasVite, hasRolldown,
      installed: installed.sort(), pkgJson, output, started };
  }

  async fetch(request) {
    installGlobals(this.env);
    await patchProcessReport();
    const url = new URL(request.url);
    try {
      // The libnpmexec child routes ALL its outbound fetch through globalOutbound (= this
      // worker). The internal spawn hop is http://self/isolate-spawn; everything else is a
      // real npm registry request -> pass it straight through to the network so Arborist/
      // pacote can fetch create-vite + its packuments.
      if (url.hostname === "self" && url.pathname === "/isolate-spawn") {
        const payload = await request.json();
        return Response.json(await this.isolateSpawn(payload));
      }
      if (url.hostname !== "do.local" && url.hostname !== "self") return fetch(request);
      if (url.pathname === "/boot") return Response.json(await this.boot());
      if (url.pathname === "/npm-install") {
        await this.boot();
        const pkg = url.searchParams.get("pkg") || "left-pad";
        return Response.json({ op: "npm-install", pkg, result: await this.npmInstall(pkg) });
      }
      if (url.pathname === "/npm-install-bin") {
        await this.boot();
        const pkg = url.searchParams.get("pkg") || "left-pad";
        const result = await this.npmInstallBin(pkg);
        return Response.json({ ok: Array.isArray(result.installed) && result.installed.includes(pkg), op: "npm-install-bin", pkg, result });
      }
      if (url.pathname === "/npm-create") {
        await this.boot();
        const project = url.searchParams.get("project") || "myapp";
        const template = url.searchParams.get("template") || "react-ts";
        const result = await this.npmCreateVite(project, template);
        return Response.json({ ok: result.ok, op: "npm-create", result });
      }
      if (url.pathname === "/npm-install-app") {
        await this.boot();
        const project = url.searchParams.get("project") || "myapp";
        const result = await this.npmInstallApp(project);
        return Response.json({ ok: result.hasVite && result.hasRolldown, op: "npm-install-app", result });
      }
      if (url.pathname === "/npm-create-bin") {
        await this.boot();
        const project = url.searchParams.get("project") || "myapp";
        const template = url.searchParams.get("template") || "react-ts";
        const result = await this.npmCreateViteBin(project, template);
        return Response.json({ ok: result.ok, op: "npm-create-bin", result });
      }
      if (url.pathname === "/npm-install-app-bin") {
        await this.boot();
        const project = url.searchParams.get("project") || "myapp";
        const result = await this.npmInstallAppBin(project);
        return Response.json({ ok: result.hasVite && result.hasRolldown, op: "npm-install-app-bin", result });
      }
      return new Response("ops: /boot /npm-install?pkg= /npm-install-bin?pkg= /npm-create?project=&template= /npm-create-bin?project=&template= /npm-install-app?project= /npm-install-app-bin?project=", { status: 404 });
    } catch (e) {
      return Response.json({ ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 30) }, { status: 500 });
    }
  }
}

export default { async fetch(request, env) { return env.RUNNER.get(env.RUNNER.idFromName("singleton")).fetch(request); } };
