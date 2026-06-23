// VITE-SERVE SPIKE driver: prove the REAL vite bin serves in a workerd child.
// Reuses the proven do-machine-clean install + app scaffold, then instead of calling
// vite.createServer ourselves, it (1) writes the node:http primitive shim to native /tmp,
// (2) redirects the installed vite's `import "node:http"` onto that shim, and (3) runs
// vite's REAL bin in a Worker-Loader child. vite's own createServer+listen run; the shim
// records the listening server; the DO dispatches browser requests into vite's connect app.
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";

const ARBORIST = "/tmp/xnm/npm/node_modules/@npmcli/arborist/lib/index.js";
const PROJ = "/tmp/proj";
const CACHE = "/tmp/npmcache";
const SHIM_DIR = "/tmp/_vshims";
const HTTP_SHIM = SHIM_DIR + "/node-http.mjs";

const CHILD_FLAGS = ["nodejs_compat", "nodejs_compat_v2", "experimental", "enable_nodejs_fs_module"];
const CHILD_COMPAT_DATE = "2026-06-01";

async function patchProcessReport() {
  const stub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };
  const targets = new Set([process, globalThis.process]);
  try { const m = await import("node:process"); targets.add(m.default); targets.add(m); } catch {}
  for (const t of targets) { if (!t) continue; try { Object.defineProperty(t, "report", { configurable: true, value: stub }); } catch {} }
}

function viteRealBinChild(devPort, binEntry, root) {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    env: { DEV_PORT: String(devPort ?? ""), VITE_BIN: binEntry, VITE_ROOT: root },
    mainModule: "main.js",
    modules: {
      "main.js": `
        import { WorkerEntrypoint } from "cloudflare:workers";
        let _impl;
        async function impl() { if (!_impl) _impl = (await import("/tmp/proj/vite-realbin-probe.mjs")).default; return _impl; }
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

export class NpmChildRunner {
  constructor(state, env) { this.state = state; this.env = env; }

  // --- proven do-machine-clean install (fork vite + app deps from public registry) ---
  async installFromRegistry(fs) {
    fs.mkdirSync(PROJ, { recursive: true });
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(PROJ + "/package.json", JSON.stringify({
      name: "scratch", version: "1.0.0", private: true, type: "module",
      dependencies: {
        "@netanelgilad/vite": "8.0.16-workerd.0",
        vite: "npm:@netanelgilad/vite@8.0.16-workerd.0",
        rolldown: "npm:@netanelgilad/rolldown@1.0.3-workerd.0",
        "@vitejs/plugin-react": "^6", react: "^19", "react-dom": "^19",
        tailwindcss: "^3", autoprefixer: "^10", postcss: "^8",
      },
    }, null, 2));
    const { default: Arborist } = await import(ARBORIST);
    const arb = new Arborist({
      path: PROJ, cache: CACHE, registry: "https://registry.npmjs.org/",
      ignoreScripts: true, audit: false, fund: false, progress: false,
      packumentCache: new Map(), legacyPeerDeps: true,
    });
    await arb.reify({ ignoreScripts: true, audit: false, legacyPeerDeps: true });
    let installed = [];
    try { installed = fs.readdirSync(PROJ + "/node_modules").filter((n) => !n.startsWith(".")); } catch {}
    return { ok: true, installed: installed.length };
  }

  async scaffoldApp(fs) {
    const res = await this.env.HOST.fetch("http://host/app-manifest");
    const manifest = await res.json();
    let files = 0;
    for (const [rel, b64] of Object.entries(manifest)) {
      if (rel === "package.json") continue;
      const p = PROJ + "/" + rel;
      fs.mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
      fs.writeFileSync(p, Buffer.from(b64, "base64"));
      files++;
    }
    try {
      let html = fs.readFileSync(PROJ + "/index.html", "utf8");
      html = html.replace('src="/src/main.tsx"', 'src="./src/main.tsx"');
      fs.writeFileSync(PROJ + "/index.html", html);
    } catch {}
    return files;
  }

  // Write the node:http primitive shim to native /tmp (child-visible via vfsModuleFallback).
  async writeHttpShim(fs) {
    fs.mkdirSync(SHIM_DIR, { recursive: true });
    const res = await this.env.HOST.fetch("http://host/vite-http-shim");
    fs.writeFileSync(HTTP_SHIM, await res.text());
    return fs.existsSync(HTTP_SHIM);
  }

  // Redirect the installed vite's `import "node:http"` onto our shim. This supplies the
  // missing primitive (a listening http server) WITHOUT altering vite's logic — same class
  // of targeted specifier redirect we use for npm's node:process / child_process.
  patchViteHttp(fs) {
    const out = [];
    const candidates = [
      PROJ + "/node_modules/vite/dist/node/chunks/node.js",
      PROJ + "/node_modules/vite/dist/node/cli.js",
    ];
    for (const f of candidates) {
      try {
        let src = fs.readFileSync(f, "utf8");
        if (!/["']node:http["']/.test(src)) continue;
        // exact "node:http" only (leaves "node:http2" untouched)
        const before = src;
        src = src.replace(/(["'])node:http\1/g, JSON.stringify(HTTP_SHIM));
        if (src !== before) { fs.writeFileSync(f, src); out.push(f.slice(PROJ.length + 1)); }
      } catch {}
    }
    return out;
  }

  resolveViteBin(fs) {
    const pkg = JSON.parse(fs.readFileSync(PROJ + "/node_modules/vite/package.json", "utf8"));
    const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.vite;
    const binPath = PROJ + "/node_modules/vite/" + rel.replace(/^\.\//, "");
    // shebang-strip (Node does this; workerd's loader treats leading #! as a syntax error)
    const head = fs.readFileSync(binPath, "utf8");
    if (head.startsWith("#!")) {
      const slash = binPath.lastIndexOf("/");
      const stripped = binPath.slice(0, slash + 1) + "__nosheb_" + binPath.slice(slash + 1);
      fs.writeFileSync(stripped, head.replace(/^#![^\n]*\n/, "//\n"));
      return stripped;
    }
    return binPath;
  }

  async setup(fs) {
    await this.installFromRegistry(fs);
    await this.scaffoldApp(fs);
    await this.writeHttpShim(fs);
    const patched = this.patchViteHttp(fs);
    // probe lives under /tmp/proj so its bare imports resolve against the project tree.
    const probeRes = await this.env.HOST.fetch("http://host/realbin-probe");
    fs.writeFileSync(PROJ + "/vite-realbin-probe.mjs", await probeRes.text());
    const bin = this.resolveViteBin(fs);
    return { patched, bin };
  }

  async warmup(fs) {
    const { bin } = await this.ensureSetup(fs);
    const child = this.env.LOADER.get("vite-realbin", () => viteRealBinChild(this.env.DEV_PORT, bin, PROJ));
    const result = await child.getEntrypoint().warmup();
    if (result?.ok) this.devReady = true;
    return result;
  }

  async ensureSetup(fs) {
    if (this._setup) return this._setup;
    if (this._setupP) return this._setupP;
    this._setupP = (async () => {
      const rolldownBinding = PROJ + "/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js";
      const fresh = !fs.existsSync(rolldownBinding);
      let bin;
      if (fresh) {
        const s = await this.setup(fs);
        bin = s.bin;
      } else {
        // already installed (warm DO) — just (re)write shim+probe+patch+bin
        await this.writeHttpShim(fs);
        this.patchViteHttp(fs);
        const probeRes = await this.env.HOST.fetch("http://host/realbin-probe");
        fs.writeFileSync(PROJ + "/vite-realbin-probe.mjs", await probeRes.text());
        bin = this.resolveViteBin(fs);
      }
      this._setup = { bin };
      return this._setup;
    })();
    try { return await this._setupP; } finally { this._setupP = null; }
  }

  async fetch(request) {
    installGlobals(this.env);
    await patchProcessReport();
    const fs = nodeFs;
    const url = new URL(request.url);
    try {
      if (url.pathname === "/setup") {
        const s = await this.setup(fs);
        return Response.json({ ok: true, op: "setup", ...s });
      }
      if (url.pathname === "/serve") {
        const result = await this.warmup(fs);
        return Response.json({ ok: !!result?.ok, op: "serve", result });
      }
      // browser serve path: forward any other path to the real-bin vite child.
      if (!this.devReady) await this.warmup(fs);
      const { bin } = await this.ensureSetup(fs);
      const child = this.env.LOADER.get("vite-realbin", () => viteRealBinChild(this.env.DEV_PORT, bin, PROJ));
      const fwd = new Request(new URL(url.pathname + url.search, "http://vite.local"), request);
      return await child.getEntrypoint().fetch(fwd);
    } catch (e) {
      return Response.json({ ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 40) }, { status: 500 });
    }
  }
}

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__wasmCompile = async (b) => env.UNSAFE_EVAL.newWasmModule(b instanceof Uint8Array ? b : new Uint8Array(b));
  globalThis.__safeEval = (c) => env.UNSAFE_EVAL.eval(String(c));
  globalThis.__newFunction = (...a) => { const body = a.pop(); return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...a); };
}

export default {
  async fetch(request, env) {
    return env.RUNNER.get(env.RUNNER.idFromName("singleton")).fetch(request);
  },
};
