// BASE-IMAGE DO: boot a workerd-ready rootfs into the DO's native /tmp, then run the REAL
// npm bin from /usr in a Worker-Loader CHILD over the shared VFS — npm is no longer special,
// it's just another bin on the rootfs (like create-vite / vite). No host-mounted /tmp/xnm
// for npm: after boot, the child loads npm's code from the VFS via vfsModuleFallback.
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";

const CHILD_FLAGS = ["nodejs_compat", "nodejs_compat_v2", "experimental", "enable_nodejs_fs_module"];
const CHILD_COMPAT_DATE = "2026-06-01";

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
    const NPM_BIN = "/tmp/usr/lib/node_modules/npm/bin/npm-cli.js";
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

  installIsolateSpawn() {
    const self = this, fs = nodeFs;
    globalThis.__ISOLATE_SPAWN = async (file, args, options = {}) => {
      const argv = resolveArgv(file, args);
      const entry = resolveBinToJs(fs, argv[0], options);
      if (!entry) throw new Error("isolate-spawn: cannot resolve '" + argv[0] + "' (PATH=" + (options.env?.PATH || "") + ")");
      return self.runNodeChild(entry, argv.slice(1), options);
    };
  }
  async runNodeChild(entry, args, options) {
    const fs = nodeFs;
    let realEntry = entry;
    try {
      const head = fs.readFileSync(entry, "utf8");
      if (head.startsWith("#!")) { const s = entry.lastIndexOf("/"); realEntry = entry.slice(0, s + 1) + "__nosheb_" + entry.slice(s + 1); fs.writeFileSync(realEntry, head.replace(/^#![^\n]*\n/, "//\n")); }
    } catch {}
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
    const argv = ["node", "npm", "install", pkg, "--ignore-scripts", "--no-audit", "--no-fund",
      "--no-update-notifier", "--legacy-peer-deps", "--cache=/tmp/npmcache",
      "--registry=https://registry.npmjs.org/", "--userconfig=/tmp/.npmrc-u", "--globalconfig=/tmp/.npmrc-g"];
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

  async fetch(request) {
    installGlobals(this.env);
    await patchProcessReport();
    const url = new URL(request.url);
    try {
      if (url.pathname === "/boot") return Response.json(await this.boot());
      if (url.pathname === "/npm-install") {
        await this.boot();
        const pkg = url.searchParams.get("pkg") || "left-pad";
        return Response.json({ op: "npm-install", pkg, result: await this.npmInstall(pkg) });
      }
      return new Response("ops: /boot /npm-install?pkg=", { status: 404 });
    } catch (e) {
      return Response.json({ ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 30) }, { status: 500 });
    }
  }
}

export default { async fetch(request, env) { return env.RUNNER.get(env.RUNNER.idFromName("singleton")).fetch(request); } };
