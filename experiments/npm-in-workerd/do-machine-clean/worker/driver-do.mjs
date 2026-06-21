// DO-MACHINE-CLEAN driver (vfs-module-loading): install @netanelgilad/vite +
// @netanelgilad/rolldown from LOCAL TARBALLS into a DO's native /tmp via Arborist,
// scaffold the ToDo app, then load a Worker-Loader CHILD that shares the DO's /tmp
// (shareParentTmp) and resolves+RUNS the module graph from it (vfsModuleFallback).
//
// NO overlay, NO source-transform pass. The packages are pre-baked + the workerd VFS
// loader supplies import.meta.url natively. The child still installs the runtime-contract
// globals (the host/child contract): __UNSAFE_EVAL + wrappers, and the rolldown WASI boot
// globals (__ROLLDOWN_FS = the shared /tmp, __EMNAPI_SCHED, ...).
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";

const ARBORIST = "/tmp/xnm/npm/node_modules/@npmcli/arborist/lib/index.js";
const PROJ = "/tmp/proj";
const CACHE = "/tmp/npmcache";

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__wasmCompile = async (bytes) =>
    env.UNSAFE_EVAL.newWasmModule(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  globalThis.__safeEval = (code) => env.UNSAFE_EVAL.eval(String(code));
  globalThis.__newFunction = (...args) => {
    const body = args.pop();
    return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...args);
  };
}

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
    try {
      Object.defineProperty(t, "report", { configurable: true, value: stub });
    } catch {}
  }
}

const CHILD_FLAGS = ["nodejs_compat", "nodejs_compat_v2", "experimental", "enable_nodejs_fs_module"];
const CHILD_COMPAT_DATE = "2026-06-01";

// Runtime-contract prelude installed in the child before any wasm-compiling import.
// This is the SAME contract do-machine uses (UnsafeEval-backed globals + a WebAssembly
// method patch + the native-fs ENOENT shim for the WASI resolver). It is NOT a source
// rewrite of the packages -- the packages ship pre-baked; this only wires the globals
// the baked code (and the rolldown WASI binding) reference at runtime.
const CHILD_GLOBALS_PRELUDE = `
  function installGlobals(env) {
    globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
    globalThis.__wasmCompile = async (b) =>
      env.UNSAFE_EVAL.newWasmModule(b instanceof Uint8Array ? b : new Uint8Array(b));
    globalThis.__safeEval = (c) => { try { return env.UNSAFE_EVAL.eval(String(c)); } catch (e) { globalThis.__LAST_EVAL_FAIL = { kind: "safeEval", input: String(c).slice(0, 200), err: String(e) }; throw e; } };
    globalThis.__newFunction = (...a) => {
      const body = a.pop();
      try { return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...a); }
      catch (e) { globalThis.__LAST_EVAL_FAIL = { kind: "newFunction", args: a.map(String), body: String(body).slice(0, 200), err: String(e) }; throw e; }
    };
    // createRequire(x).resolve(name): workerd's require() has no .resolve; the baked
    // packages route createRequire().resolve through this helper. The resolved spec is
    // imported directly by the VFS loader, so returning the spec (file:// -> path) suffices.
    globalThis.__requireResolve = (base, spec) => {
      if (typeof spec === "string" && spec.startsWith("file://")) spec = spec.slice(7);
      return spec;
    };
    // workerd blocks runtime wasm code-generation: route byte-input WebAssembly.compile/
    // instantiate through UnsafeEval (a method override, not a global-Function replacement).
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
  // workerd's native openSync(missing, O_RDONLY) returns a valid fd (then 0-byte reads)
  // instead of throwing ENOENT, so rolldown's oxc_resolver reads a missing package.json
  // as "" -> JSONError. Surface ENOENT for read-only opens/stats of non-existent paths
  // (skip O_CREAT so genuine writes work).
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

// The dev child's mainModule must construct even when the loader recreates the child
// (its Worker-Loader instance can be evicted between requests). A STATIC re-export of a
// VFS path (`export {default} from "/tmp/proj/..."`) is resolved at module-graph build
// time, so a recreated child whose first touch is a browser request fails to construct
// ("No such module /tmp/proj/vite-dev-probe.mjs"). Instead we ship a tiny WorkerEntrypoint
// that DYNAMICALLY imports the probe on first use and caches it — construction never
// touches the VFS, and the shared /tmp probe loads at request time when it's available.
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
          // Build the probe entrypoint and explicitly wire ctx/env. The wrapper's own
          // this.ctx can be undefined on the RPC fetch path, and the probe reads
          // this.ctx.waitUntil, so supply a ctx with a safe waitUntil fallback.
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
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  // --- reusable setup steps (callable from explicit ops AND the self-healing serve path) ---

  // SINGLE-PASS PUBLIC-REGISTRY install, faithful to `npm install @netanelgilad/vite`:
  // Arborist resolves+fetches EVERYTHING from https://registry.npmjs.org/ into the DO's
  // native /tmp/node_modules over workerd fs -- no local tarballs, no manual extraction.
  //
  //   - `@netanelgilad/vite@8.0.16-workerd.0` is pinned as a dependency; we ALSO alias it
  //     to the bare `vite` name (`"vite": "npm:@netanelgilad/vite@..."`) so the app's
  //     `import "vite"` resolves at the project root, matching what a real
  //     `npm i @netanelgilad/vite` user does plus a one-line alias.
  //   - The vite manifest declares `rolldown: npm:@netanelgilad/rolldown@1.0.3-workerd.0`,
  //     so Arborist transitively resolves+fetches the @netanelgilad/rolldown FORK from the
  //     registry. We also pin the same alias at the root (`"rolldown": "npm:..."`) so the
  //     fork dedupes to the bare `node_modules/rolldown` dir the probes import directly.
  //   - Both published tarballs carry `bundleDependencies` (vite -> esbuild-wasm shim;
  //     rolldown -> the patched @emnapi/@napi-rs/@tybys WASI runtime), so Arborist lays
  //     those down INSIDE each package straight from the registry tarball -- the patched
  //     runtime + esbuild-wasm are NOT re-resolved from stock npm.
  //
  // This proves the WHOLE loop from public npm: install-and-run is clean -- the packages
  // alone (no transform pass, no overlay, no local tarball) make vite build/run from /tmp.
  async installFromRegistry(fs) {
    fs.mkdirSync(PROJ, { recursive: true });
    fs.mkdirSync(CACHE, { recursive: true });
    const t0 = Date.now();
    fs.writeFileSync(
      PROJ + "/package.json",
      JSON.stringify(
        {
          name: "scratch",
          version: "1.0.0",
          private: true,
          dependencies: {
            "@netanelgilad/vite": "8.0.16-workerd.0",
            vite: "npm:@netanelgilad/vite@8.0.16-workerd.0",
            rolldown: "npm:@netanelgilad/rolldown@1.0.3-workerd.0",
            "@vitejs/plugin-react": "^6",
            react: "^19",
            "react-dom": "^19",
            tailwindcss: "^3",
            autoprefixer: "^10",
            postcss: "^8",
          },
        },
        null,
        2
      )
    );
    const { default: Arborist } = await import(ARBORIST);
    const arb = new Arborist({
      path: PROJ,
      cache: CACHE,
      registry: "https://registry.npmjs.org/",
      ignoreScripts: true,
      audit: false,
      fund: false,
      progress: false,
      packumentCache: new Map(),
      // `@vitejs/plugin-react@6` has a REQUIRED peer `vite: "^8.0.0"`. The fork's version
      // `8.0.16-workerd.0` is a PRERELEASE, which by semver does NOT satisfy `^8.0.0`, so a
      // strict resolve fails with a peer conflict. This is exactly the case
      // `npm install --legacy-peer-deps` exists for; a real user installing the fork +
      // plugin-react would pass the same flag. (The local-tarball path dodged this only
      // because vite wasn't in Arborist's tree during its pass.) This is an npm-side
      // resolution accommodation, NOT a package defect or a patch-around.
      legacyPeerDeps: true,
    });
    await arb.reify({ ignoreScripts: true, audit: false, legacyPeerDeps: true });
    const registryMs = Date.now() - t0;

    const nm = PROJ + "/node_modules";
    let installed = [];
    try { installed = fs.readdirSync(nm).filter((n) => !n.startsWith(".")); } catch {}
    const readPkg = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
    const viteRootPkg = readPkg(nm + "/vite/package.json");
    const scopedVitePkg = readPkg(nm + "/@netanelgilad/vite/package.json");
    const rolldownPkg = readPkg(nm + "/rolldown/package.json");
    const childNm = (dir) => { try { return fs.readdirSync(dir).filter((n) => !n.startsWith(".")); } catch { return []; } };
    const resolvedTree = {
      "node_modules/vite": viteRootPkg && { name: viteRootPkg.name, version: viteRootPkg.version, _resolved: viteRootPkg._resolved, dep_rolldown: viteRootPkg.dependencies?.rolldown },
      "node_modules/rolldown": rolldownPkg && { name: rolldownPkg.name, version: rolldownPkg.version, _resolved: rolldownPkg._resolved, bundled: childNm(nm + "/rolldown/node_modules") },
      "node_modules/@netanelgilad/vite": scopedVitePkg && { name: scopedVitePkg.name, version: scopedVitePkg.version, _resolved: scopedVitePkg._resolved },
      "node_modules/@netanelgilad": childNm(nm + "/@netanelgilad"),
    };
    let viteRolldownDep = null, esbuildShim = false, viteWasm = false, rolldownNewFnBaked = false;
    try { viteRolldownDep = viteRootPkg?.dependencies?.rolldown; } catch {}
    try { esbuildShim = fs.existsSync(nm + "/vite/node_modules/esbuild-wasm/esm/workerd-shim.mjs"); } catch {}
    try { viteWasm = fs.existsSync(nm + "/rolldown/dist/rolldown.wasm"); } catch {}
    try { rolldownNewFnBaked = fs.readFileSync(nm + "/rolldown/dist/utils-index.mjs", "utf8").includes("globalThis.__newFunction"); } catch {}
    return {
      ok: true,
      op: "install",
      source: "public-registry (https://registry.npmjs.org/)",
      ms: Date.now() - t0,
      registryMs,
      installed,
      resolvedTree,
      viteRolldownDep,
      esbuildShim,
      viteWasm,
      rolldownNewFnBaked,
      rolldownResolved: rolldownPkg && { name: rolldownPkg.name, version: rolldownPkg.version, _resolved: rolldownPkg._resolved },
    };
  }

  async scaffoldApp(fs) {
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
    // root-relative html src is interpreted as fs-absolute by rolldown's wasm resolver
    try {
      let html = fs.readFileSync(PROJ + "/index.html", "utf8");
      html = html.replace('src="/src/main.tsx"', 'src="./src/main.tsx"');
      fs.writeFileSync(PROJ + "/index.html", html);
    } catch {}
    return files;
  }

  async scaffoldDevProbe(fs) {
    const res = await this.env.HOST.fetch("http://host/dev-probe");
    const src = await res.text();
    fs.writeFileSync(PROJ + "/vite-dev-probe.mjs", src);
    return src.length;
  }

  async devWarmup() {
    const child = this.env.LOADER.get("vite-dev-clean", () => viteDevChild(this.env.DEV_PORT));
    const result = await child.getEntrypoint().warmup();
    if (result?.ok) this.devReady = true;
    return result;
  }

  // Self-heal a cold DO instance: miniflare can route a port request to a DO instance
  // whose /tmp did NOT receive the dispatchFetch-driven setup (separate isolate /tmp). So
  // on the serve path we make THIS DO fully ready: run the public-registry install if the
  // rolldown fork binding is missing, (re)scaffold the app + dev probe, then warm the dev
  // server. The first cold request pays the install+warmup cost once; later requests hit
  // the warmed child. This is what makes the browser-facing DO reliably serve.
  async ensureDevReady(fs) {
    if (this.devReady) return;
    if (this._ensuring) return this._ensuring;
    this._ensuring = (async () => {
      const rolldownBinding = PROJ + "/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js";
      if (!fs.existsSync(rolldownBinding)) await this.installFromRegistry(fs);
      if (!fs.existsSync(PROJ + "/src/main.tsx")) await this.scaffoldApp(fs);
      if (!fs.existsSync(PROJ + "/vite-dev-probe.mjs")) await this.scaffoldDevProbe(fs);
      await this.devWarmup();
    })();
    try { await this._ensuring; } finally { this._ensuring = null; }
  }

  async fetch(request) {
    installGlobals(this.env);
    await patchProcessReport();
    const fs = nodeFs;
    const url = new URL(request.url);
    try {
      if (url.pathname === "/diag") {
        const ex = (p) => { try { return fs.existsSync(p); } catch { return "ERR"; } };
        let projList = []; try { projList = fs.readdirSync(PROJ); } catch (e) { projList = ["ERR:" + e.message]; }
        return Response.json({
          op: "diag", devReady: !!this.devReady,
          devProbe: ex(PROJ + "/vite-dev-probe.mjs"),
          nmVite: ex(PROJ + "/node_modules/vite"),
          nmRolldown: ex(PROJ + "/node_modules/rolldown"),
          projList,
        });
      }
      if (url.pathname === "/install") {
        const summary = await this.installFromRegistry(fs);
        return Response.json(summary);
      }

      if (url.pathname === "/scaffold-app") {
        const t0 = Date.now();
        const files = await this.scaffoldApp(fs);
        return Response.json({ ok: true, op: "scaffold-app", ms: Date.now() - t0, files });
      }

      if (url.pathname === "/run-vite-build") {
        fs.writeFileSync(
          PROJ + "/vite-build-probe.mjs",
          `
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
              // boot the rolldown binding from the INSTALLED package (no /tmp/proj/rolldown.wasm
              // overlay; the package ships its own dist/rolldown.wasm, found via import.meta.url).
              try {
                await import("rolldown/dist/rolldown-binding.wasi-browser.js").catch(async () => {
                  // exports map doesn't expose the binding subpath; import via the resolved file path
                  await import("/tmp/proj/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js");
                });
                if (globalThis.__ROLLDOWN_ENSURE_READY) await globalThis.__ROLLDOWN_ENSURE_READY();
                await import("rolldown");
                out.rolldownReady = true;
              } catch (e) { out.rolldownBoot = "ERR " + (e && e.stack ? String(e.stack).split("\\n").slice(0,8).join(" | ") : String(e)); return out; }
              out.fsCheck = {
                mainTsx: nodeFs.existsSync("/tmp/proj/src/main.tsx"),
                indexHtml: nodeFs.existsSync("/tmp/proj/index.html"),
                viteWasm: nodeFs.existsSync("/tmp/proj/node_modules/rolldown/dist/rolldown.wasm"),
              };
              // BISECT: localize the "the" SyntaxError. Compare bare-specifier vs absolute-path
              // resolution of rolldown/filter, and capture full stack + the resolved file.
              out.bisect = {};
              for (const spec of ["rolldown/filter", "/tmp/proj/node_modules/rolldown/dist/filter-index.mjs", "/tmp/proj/node_modules/rolldown/dist/shared/composable-filters-BcLvc0mh.mjs", "/tmp/proj/node_modules/vite/dist/node/chunks/node.js"]) {
                try { await import(spec); out.bisect[spec] = "ok"; }
                catch (e) { out.bisect[spec] = "ERR " + String(e) + " :: " + (e?.stack ? String(e.stack).split("\\n").slice(0,5).join(" / ") : "nostack"); }
              }
              // also read the two files' first bytes to confirm what's actually on disk
              try { out.filterHead = nodeFs.readFileSync("/tmp/proj/node_modules/rolldown/dist/filter-index.mjs","utf8").slice(0,80); } catch (e) { out.filterHead = "ERR "+String(e); }
              try {
                out.stage = "import-vite";
                const vite = await import("vite");
                out.stage = "import-plugin-react";
                const { default: react } = await import("@vitejs/plugin-react");
                out.stage = "react-plugin-call";
                const reactPlugin = react();
                out.viteVersion = vite.version;
                const t0 = Date.now();
                out.stage = "vite.build";
                await vite.build({
                  root: "/tmp/proj",
                  configFile: false,
                  envFile: false,
                  logLevel: "warn",
                  plugins: [reactPlugin],
                  build: { outDir: "/tmp/proj/dist", emptyOutDir: true, minify: false },
                });
                out.stage = "build-done";
                out.buildMs = Date.now() - t0;
                out.dist = nodeFs.readdirSync("/tmp/proj/dist");
                try { out.assets = nodeFs.readdirSync("/tmp/proj/dist/assets"); } catch {}
                try {
                  const html = nodeFs.readFileSync("/tmp/proj/dist/index.html", "utf8");
                  out.indexHtmlLen = html.length;
                  out.indexHtmlHead = html.slice(0, 200);
                } catch (e) { out.indexHtml = "ERR " + String(e); }
              } catch (e) {
                out.viteBuild = "ERR " + String(e);
                out.viteBuildStack = (e && e.stack ? String(e.stack).split("\\n").slice(0,30) : []);
                out.viteBuildExtra = { id: e?.id, loc: e?.loc, frame: e?.frame, plugin: e?.plugin, code: e?.code, cause: e?.cause ? String(e.cause) : undefined };
                out.lastEvalFail = globalThis.__LAST_EVAL_FAIL;
              }
              return out;
            }
          }
          `
        );
        const child = this.env.LOADER.get("vite-build-clean", () => viteBuildChild());
        const result = await child.getEntrypoint().run();
        return Response.json({ ok: true, op: "run-vite-build", result });
      }

      if (url.pathname === "/scaffold-dev-probe") {
        const t0 = Date.now();
        const bytes = await this.scaffoldDevProbe(fs);
        return Response.json({ ok: true, op: "scaffold-dev-probe", ms: Date.now() - t0, bytes });
      }

      if (url.pathname === "/dev-warmup") {
        const t0 = Date.now();
        // Full self-heal on THIS DO: install-from-registry (if needed) + scaffold + boot vite.
        await this.ensureDevReady(fs);
        return Response.json({ ok: true, op: "dev-warmup", ms: Date.now() - t0, result: { ok: !!this.devReady, devReady: !!this.devReady } });
      }

      // Serve path: forward every browser request (and the /__hmr upgrade) to the
      // in-isolate vite dev server child. miniflare can hand a port request to a DO
      // instance that did NOT run the dispatchFetch-driven setup, so we SELF-HEAL here:
      // if this DO isn't dev-ready, run scaffold + warmup on it now (the npm install is
      // already on the shared /tmp). This makes serving work no matter which DO instance
      // handles the request. The first request that triggers a cold warmup waits for it;
      // subsequent requests hit the warmed child directly.
      if (this.env.DEV_PORT) {
        if (!this.devReady) await this.ensureDevReady(fs);
        const child = this.env.LOADER.get("vite-dev-clean", () => viteDevChild(this.env.DEV_PORT));
        const ep = child.getEntrypoint();
        const fwd = new Request(new URL(url.pathname + url.search, "http://vite.local"), request);
        return await ep.fetch(fwd);
      }

      return new Response("ops: /install /scaffold-app /run-vite-build /scaffold-dev-probe /dev-warmup /diag", { status: 404 });
    } catch (e) {
      return Response.json(
        { ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 50) },
        { status: 500 }
      );
    }
  }
}

export default {
  async fetch(request, env) {
    const id = env.RUNNER.idFromName("singleton");
    return env.RUNNER.get(id).fetch(request);
  },
};
