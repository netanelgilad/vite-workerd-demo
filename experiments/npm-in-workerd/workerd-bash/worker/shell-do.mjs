// workerd-bash Durable Object: ONE v8 isolate that owns a shared NATIVE /tmp and
// runs just-bash as an interactive shell over it. The user types commands in the
// REPL (repl.mjs); each line is POSTed to /exec and run here. The shell exposes:
//
//   - just-bash builtins over the DO's native /tmp: ls, cat, echo, mkdir, pwd, rm,
//     pipes, redirects (via the NativeFsAdapter, shared with do-shell).
//   - `npm install [pkgs...]` -> Arborist install into /tmp/proj/node_modules from
//     the PUBLIC registry. Default (no args) installs @netanelgilad/vite + the ToDo
//     app's deps (the exact set do-machine-clean proved buildable/serveable).
//   - `npm create` / `scaffold`         -> write the app-todo source into /tmp/proj.
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

export class Shell {
  constructor(state, env) { this.state = state; this.env = env; }

  // ---- toolchain ops (called by the shell `npm`/`scaffold`/`vite` commands) ----

  // Public-registry install via Arborist into the DO's /tmp/proj/node_modules.
  // Faithful to `npm install <pkgs>`: Arborist resolves+fetches from
  // https://registry.npmjs.org/ over workerd native fs (the tar sync-extract
  // workaround in the module-fallback host makes this work).
  async npmInstall(extraDeps) {
    await patchProcessReport();
    const fs = nodeFs;
    fs.mkdirSync(PROJ, { recursive: true });
    fs.mkdirSync(CACHE, { recursive: true });
    let pkg = { name: "scratch", version: "1.0.0", private: true, dependencies: {} };
    try { pkg = JSON.parse(fs.readFileSync(PROJ + "/package.json", "utf8")); pkg.dependencies ??= {}; } catch {}
    // No explicit pkgs -> install the default vite + ToDo set; else merge requested.
    const deps = extraDeps && Object.keys(extraDeps).length ? extraDeps : DEFAULT_DEPS;
    Object.assign(pkg.dependencies, deps);
    fs.writeFileSync(PROJ + "/package.json", JSON.stringify(pkg, null, 2));
    const t0 = Date.now();
    const { default: Arborist } = await import(ARBORIST);
    const arb = new Arborist({
      path: PROJ, cache: CACHE, registry: "https://registry.npmjs.org/",
      ignoreScripts: true, audit: false, fund: false, progress: false,
      packumentCache: new Map(),
      // @vitejs/plugin-react@6 wants vite ^8.0.0; the fork's 8.0.16-workerd.0 is a
      // prerelease that strict semver rejects — the canonical --legacy-peer-deps case.
      legacyPeerDeps: true,
    });
    await arb.reify({ ignoreScripts: true, audit: false, legacyPeerDeps: true });
    let installed = [];
    try { installed = fs.readdirSync(PROJ + "/node_modules").filter((n) => !n.startsWith(".")); } catch {}
    return { ms: Date.now() - t0, installed, deps: Object.keys(deps) };
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

  async devWarmup() {
    const child = this.env.LOADER.get("workerd-bash-vite-dev", () => viteDevChild(this.env.DEV_PORT));
    const result = await child.getEntrypoint().warmup();
    if (result?.ok) this.devReady = true;
    return result;
  }

  // Self-heal: install (if missing) + scaffold app + dev probe + warm vite. Runs on
  // the serve path too, because miniflare can route a port request to a DO instance
  // whose /tmp didn't get the dispatchFetch-driven setup.
  async ensureDevReady() {
    if (this.devReady) return;
    if (this._ensuring) return this._ensuring;
    const fs = nodeFs;
    this._ensuring = (async () => {
      const rolldownBinding = PROJ + "/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js";
      if (!fs.existsSync(rolldownBinding)) await this.npmInstall();
      if (!fs.existsSync(PROJ + "/src/main.tsx")) await this.scaffoldApp();
      if (!fs.existsSync(PROJ + "/vite-dev-probe.mjs")) await this.scaffoldDevProbe();
      await this.devWarmup();
    })();
    try { await this._ensuring; } finally { this._ensuring = null; }
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
      if (sub === "install" || sub === "i" || sub === "add") {
        const specs = args.slice(1).filter((a) => !a.startsWith("-"));
        let extra = null;
        if (specs.length) { extra = {}; for (const s of specs) { const name = s.replace(/@[^@]*$/, "") || s; extra[name] = s.slice(name.length + 1) || "*"; } }
        try {
          const banner = extra
            ? `npm install ${specs.join(" ")}  (Arborist -> /tmp/proj/node_modules, public registry)\n`
            : `npm install  (default: @netanelgilad/vite + ToDo app deps from public registry; this can take a few minutes)\n`;
          const r = await self.npmInstall(extra);
          return { stdout: banner + `+ installed ${r.installed.length} packages in ${(r.ms / 1000).toFixed(1)}s\n` +
            `node_modules: ${r.installed.join(", ")}\n`, stderr: "", exitCode: 0 };
        } catch (e) {
          return { stdout: "", stderr: `npm install failed: ${e?.stack ?? e}\n`, exitCode: 1 };
        }
      }
      if (sub === "ls") {
        try {
          const ns = nodeFs.readdirSync(PROJ + "/node_modules").filter((n) => !n.startsWith("."));
          return { stdout: ns.join("\n") + "\n", stderr: "", exitCode: 0 };
        } catch { return { stdout: "(no node_modules — run `npm install`)\n", stderr: "", exitCode: 0 }; }
      }
      if (sub === "run" && args[1] === "dev") return runViteDev();
      if (sub === "create") return doScaffold();
      return { stdout: "", stderr: `npm: supported here — install [pkgs], ls, run dev, create (got: ${args.join(" ")})\n`, exitCode: 2 };
    });

    const doScaffold = async () => {
      try {
        const files = await self.scaffoldApp();
        return { stdout: `scaffolded ToDo app -> /tmp/proj (${files} files: index.html, src/, tailwind/postcss config)\n`, stderr: "", exitCode: 0 };
      } catch (e) { return { stdout: "", stderr: `scaffold failed: ${e}\n`, exitCode: 1 }; }
    };
    const scaffold = defineCommand("scaffold", doScaffold);

    const runViteDev = async () => {
      if (!self.env.DEV_PORT) return { stdout: "", stderr: "vite dev needs a bound port (launch the REPL normally, not in --no-port mode)\n", exitCode: 1 };
      const url = `http://127.0.0.1:${self.env.DEV_PORT}/`;
      try {
        const fs = nodeFs;
        if (!fs.existsSync(PROJ + "/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js"))
          return { stdout: "", stderr: "no vite installed — run `npm install` first\n", exitCode: 1 };
        if (!fs.existsSync(PROJ + "/src/main.tsx")) await self.scaffoldApp();
        if (!fs.existsSync(PROJ + "/vite-dev-probe.mjs")) await self.scaffoldDevProbe();
        const t0 = Date.now();
        const warm = await self.devWarmup();
        if (!warm?.ok) return { stdout: "", stderr: `vite dev failed to warm up: ${warm?.error ?? "unknown"}\n`, exitCode: 1 };
        return { stdout:
          `vite dev server is LIVE (vite running from /tmp inside a workerd child isolate)\n` +
          `  warmed in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${warm.deps} deps prebundled\n\n` +
          `  ->  open in your browser:  ${url}\n\n` +
          `  (HMR over WebSocket at ${url}__hmr; the server keeps serving while this REPL is open)\n`,
          stderr: "", exitCode: 0 };
      } catch (e) { return { stdout: "", stderr: `vite dev failed: ${e?.stack ?? e}\n`, exitCode: 1 }; }
    };

    // vite build | vite dev
    const vite = defineCommand("vite", async (args) => {
      if (args[0] === "dev" || args[0] === "serve") return runViteDev();
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

    for (const c of [npm, scaffold, vite]) bash.registerCommand(c);
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

    // Browser serve path: forward HTTP (and the /__hmr WebSocket upgrade) to the
    // in-isolate vite dev child. Self-heal if this DO instance is cold.
    if (this.env.DEV_PORT && url.pathname !== "/exec" && url.pathname !== "/init") {
      if (!this.devReady) await this.ensureDevReady();
      const child = this.env.LOADER.get("workerd-bash-vite-dev", () => viteDevChild(this.env.DEV_PORT));
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
