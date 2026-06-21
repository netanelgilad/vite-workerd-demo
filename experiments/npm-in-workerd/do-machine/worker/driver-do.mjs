// DO-MACHINE driver (vfs-module-loading): install REAL vite@^8 + @vitejs/plugin-react
// into a DO's native /tmp via Arborist, run a POST-INSTALL TRANSFORM PASS over /tmp
// to make the code workerd-ready (import.meta.url baking, wasm/eval -> UnsafeEval,
// require().resolve helper), then load a Worker-Loader CHILD that shares the DO's
// /tmp (shareParentTmp) and resolves+RUNS modules from it (vfsModuleFallback).
//
// Rungs proven here:
//   1. node: builtins in the child (compat date >= 2026-03-17).
//   2. child has UnsafeEval (passed via env); transform pass makes /tmp code eval;
//      import("vite") executes past the createRequire(import.meta.url) failure.
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";

import { rewriteSource, transformTree } from "../transform-tmp.mjs";

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
// RUNG 1 FIX: node:readline + node:worker_threads (and the other node: stubs vite
// and rolldown import) are gated behind compat flags that are $impliedByAfterDate
// nodeJsCompat = 2026-03-17. With the child pinned to 2025-01-01 they were OFF, so
// workerd's native builtins reported "No such module node:readline". Bumping the
// child's compatibilityDate past that date enables them natively -- no VFS/loader
// change needed; the node: specifiers flow straight to workerd's own builtins.
const CHILD_COMPAT_DATE = "2026-06-01";

// The probe module lives UNDER /tmp/proj so bare specifiers resolve against
// /tmp/proj/node_modules (where vite was installed). main.js installs the
// UnsafeEval-backed globals BEFORE re-exporting the probe (whose deep imports
// compile wasm at module-eval time and need globalThis.__UNSAFE_EVAL ready).
//
// RUNG 2: the child gets its OWN UnsafeEval injected implicitly as env.UNSAFE_EVAL
// by the workerd fork (vfsModuleFallback children -- see server.c++ compileBindings).
// UnsafeEval is a native jsg type and is NOT RPC-serializable, so it canNOT be passed
// down through the child's `env` from the parent (DataCloneError). main.js wires the
// globals the transform pass's rewrites reference from that implicit binding.
// The probe (and later, the real vite runner) MUST live UNDER /tmp/proj so its bare
// specifiers ("vite", "@vitejs/plugin-react") resolve against /tmp/proj/node_modules
// through the VFS module fallback (the resolver roots resolution at the referrer's
// path). main.js is a virtual module (not under /tmp), so bare imports from it fail
// with "No such module vite". So main.js only installs the UnsafeEval-backed globals,
// then re-exports the default WorkerEntrypoint from the on-disk /tmp probe.
const CHILD_GLOBALS_PRELUDE = `
  function installGlobals(env) {
    globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
    globalThis.__wasmCompile = async (b) =>
      env.UNSAFE_EVAL.newWasmModule(b instanceof Uint8Array ? b : new Uint8Array(b));
    globalThis.__safeEval = (c) => env.UNSAFE_EVAL.eval(String(c));
    globalThis.__newFunction = (...a) => {
      const body = a.pop();
      return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...a);
    };
    globalThis.__requireResolve = (base, spec) => {
      if (typeof spec === "string" && spec.startsWith("file://")) spec = spec.slice(7);
      return spec;
    };
    // workerd blocks runtime wasm code-generation: WebAssembly.compile(bytes) and
    // WebAssembly.instantiate(bytes,...) throw "Wasm code generation disallowed by embedder".
    // Only UnsafeEval.newWasmModule(bytes) may compile a module, and instantiate(Module,...) (a
    // PRE-compiled Module) is allowed. emnapi/napi instantiate rolldown's wasm via
    // WebAssembly.instantiate(bytes, imports) at runtime, so route byte-input through UnsafeEval.
    const _WA = globalThis.WebAssembly;
    if (!_WA.__patchedForUnsafeEval) {
      const origInstantiate = _WA.instantiate.bind(_WA);
      const origCompile = _WA.compile.bind(_WA);
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
        // WebAssembly.instantiate(bytes,...) resolves to {module, instance};
        // instantiate(Module,...) resolves to an Instance. Normalize to the bytes-form result.
        return { module: mod, instance };
      };
      _WA.__patchedForUnsafeEval = true;
    }
  }
  // BLOCKER FIX (native node:fs over workerd): openSync(missing, O_RDONLY) does NOT
  // throw ENOENT in the child's native fs -- it returns a valid fd and fd_read yields
  // 0 bytes, so rolldown's oxc_resolver reads a missing package.json as "" -> JSONError
  // "File is empty" while walking dirs for resolution. rolldown's WASI fs (the @tybys
  // preview1 shim) drives path_open/fd_read over globalThis.__ROLLDOWN_FS; its handleError
  // maps a thrown {code:'ENOENT'} to WasiErrno.ENOENT. So surface ENOENT here for
  // read-only opens (and stat/read) of non-existent paths -- the (a) "purer" fix: make the
  // WASI fd/path ops signal ENOENT over native fs. Skip when O_CREAT is set so genuine
  // create opens still work. (memfs would also give ENOENT; this keeps the bundler I/O on
  // the real native /tmp the rest of the toolchain reads from.)
  function makeEnoentFs(base) {
    const O_CREAT = 0o100; // linux value used by @tybys FileControlFlag.O_CREAT
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

function viteChild() {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    mainModule: "main.js",
    modules: {
      // main.js can't reach UNSAFE_EVAL at module-eval (env is per-request), so we
      // can't install globals at top level. Instead the on-disk probe installs them
      // inside its handler before any wasm-compiling import runs.
      "main.js": `export { default } from "/tmp/proj/probe.mjs";`,
    },
  };
}

function rolldownChild() {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    mainModule: "main.js",
    modules: {
      "main.js": `export { default } from "/tmp/proj/rolldown-probe.mjs";`,
    },
  };
}

function viteBuildChild() {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    mainModule: "main.js",
    modules: {
      "main.js": `export { default } from "/tmp/proj/vite-build-probe.mjs";`,
    },
  };
}

function viteDevChild(devPort) {
  return {
    compatibilityDate: CHILD_COMPAT_DATE,
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    // DEV_PORT lets the in-child vite tell the browser's HMR client which port to dial
    // (the browser is on the miniflare port, not vite's default 5173).
    env: { DEV_PORT: String(devPort ?? "") },
    mainModule: "main.js",
    modules: {
      "main.js": `export { default } from "/tmp/proj/vite-dev-probe.mjs";`,
    },
  };
}

export class NpmChildRunner {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    installGlobals(this.env);
    await patchProcessReport();
    const fs = nodeFs;
    const url = new URL(request.url);
    try {
      if (url.pathname === "/install") {
        // Install vite + the full ToDo app dependency set so `vite build` has a real
        // graph to bundle (react + plugin-react + tailwind/postcss).
        const deps = {
          vite: url.searchParams.get("vite") ?? "^8",
          "@vitejs/plugin-react": url.searchParams.get("pr") ?? "^6",
          react: "^19",
          "react-dom": "^19",
          tailwindcss: "^3",
          autoprefixer: "^10",
          postcss: "^8",
        };
        fs.mkdirSync(PROJ, { recursive: true });
        fs.mkdirSync(CACHE, { recursive: true });
        fs.writeFileSync(
          PROJ + "/package.json",
          JSON.stringify(
            { name: "scratch", version: "1.0.0", private: true, dependencies: deps },
            null,
            2
          )
        );
        const t0 = Date.now();
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
        });
        await arb.reify({ ignoreScripts: true, audit: false });
        let installed = [];
        try {
          installed = fs.readdirSync(PROJ + "/node_modules").filter((n) => !n.startsWith("."));
        } catch {}
        return Response.json({ ok: true, op: "install", ms: Date.now() - t0, installed });
      }

      if (url.pathname === "/overlay-rolldown") {
        // Replace npm's native rolldown with the single-threaded WASM fork (+ its
        // patched emnapi/napi runtime deps) served by the host. Write into /tmp via
        // native fs; the child then loads the fork through the VFS fallback.
        const t0 = Date.now();
        const rd = PROJ + "/node_modules/rolldown";
        // wipe the native rolldown so its .node binding loader is gone
        try { fs.rmSync(rd, { recursive: true, force: true }); } catch {}
        const res = await this.env.HOST.fetch("http://host/overlay-manifest");
        const manifest = await res.json();
        let files = 0;
        for (const [rel, b64] of Object.entries(manifest)) {
          const p = PROJ + "/" + rel;
          fs.mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
          fs.writeFileSync(p, Buffer.from(b64, "base64"));
          files++;
        }
        // Some rolldown ESM chunks import the node WASI binding directly
        // (rolldown-binding.wasi.cjs), which pulls in the worker_threads / native-thread path.
        // Rewrite every reference in the overlaid rolldown dist to the single-threaded browser
        // binding (mirrors the harness host-fallback 301 for /rolldown-binding.wasi.cjs).
        let rebound = 0;
        const reboundWalk = (dir) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = dir + "/" + e.name;
            if (e.isDirectory()) { reboundWalk(p); continue; }
            if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
            if (e.name === "rolldown-binding.wasi-browser.js") continue;
            let s = fs.readFileSync(p, "utf8");
            if (s.includes("rolldown-binding.wasi.cjs")) {
              s = s.split("rolldown-binding.wasi.cjs").join("rolldown-binding.wasi-browser.js");
              fs.writeFileSync(p, s);
              rebound++;
            }
          }
        };
        try { reboundWalk(rd + "/dist"); } catch {}
        // drop the wasm bytes into /tmp so the child can read+compile them
        const wasmRes = await this.env.HOST.fetch("http://host/rolldown.wasm");
        const wasmBytes = Buffer.from(await wasmRes.arrayBuffer());
        fs.writeFileSync(PROJ + "/rolldown.wasm", wasmBytes);
        return Response.json({ ok: true, op: "overlay-rolldown", ms: Date.now() - t0, files, rebound, wasmBytes: wasmBytes.length });
      }

      if (url.pathname === "/overlay-esbuild") {
        // Replace native esbuild with esbuild-wasm + the harness shim so vite's dep
        // optimizer runs single-threaded wasm via UnsafeEval. Mirrors harness ALIASES.
        const t0 = Date.now();
        const res = await this.env.HOST.fetch("http://host/esbuild-manifest");
        const manifest = await res.json();
        let files = 0;
        for (const [rel, b64] of Object.entries(manifest)) {
          const p = PROJ + "/" + rel;
          fs.mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
          fs.writeFileSync(p, Buffer.from(b64, "base64"));
          files++;
        }
        // Alias the `esbuild` package dir to re-export the shim (vite imports "esbuild").
        const esbDir = PROJ + "/node_modules/esbuild";
        fs.rmSync(esbDir, { recursive: true, force: true });
        fs.mkdirSync(esbDir, { recursive: true });
        fs.writeFileSync(esbDir + "/package.json", JSON.stringify({ name: "esbuild", version: "0.25.0", type: "module", main: "index.mjs", exports: { ".": "./index.mjs", "./package.json": "./package.json" } }));
        fs.writeFileSync(esbDir + "/index.mjs", `export * from "/tmp/proj/esbuild-shim.mjs";\nimport __d from "/tmp/proj/esbuild-shim.mjs";\nexport default __d;\n`);
        // esbuild wasm bytes for the shim's host fetch fallback.
        const wasmRes = await this.env.HOST.fetch("http://host/esbuild.wasm");
        fs.writeFileSync(PROJ + "/esbuild.wasm", Buffer.from(await wasmRes.arrayBuffer()));
        return Response.json({ ok: true, op: "overlay-esbuild", ms: Date.now() - t0, files });
      }

      if (url.pathname === "/scaffold-app") {
        // Write the ToDo app source into /tmp/proj (the vite build root).
        const t0 = Date.now();
        const res = await this.env.HOST.fetch("http://host/app-manifest");
        const manifest = await res.json();
        let files = 0;
        for (const [rel, b64] of Object.entries(manifest)) {
          if (rel === "package.json") continue; // keep our install package.json (deps + node_modules)
          const p = PROJ + "/" + rel;
          fs.mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
          fs.writeFileSync(p, Buffer.from(b64, "base64"));
          files++;
        }
        // rolldown's wasm resolver interprets the html script src "/src/main.tsx" as
        // filesystem-absolute (no such file) rather than root-relative. Make it a relative
        // specifier so resolution is unambiguous against /tmp/proj.
        try {
          let html = fs.readFileSync(PROJ + "/index.html", "utf8");
          html = html.replace('src="/src/main.tsx"', 'src="./src/main.tsx"');
          fs.writeFileSync(PROJ + "/index.html", html);
        } catch {}
        return Response.json({ ok: true, op: "scaffold-app", ms: Date.now() - t0, files });
      }

      if (url.pathname === "/transform") {
        // POST-INSTALL TRANSFORM PASS over /tmp/proj/node_modules.
        const t0 = Date.now();
        const stats = transformTree(PROJ + "/node_modules", { fs });
        // Also bake import.meta.* in the app's OWN root config files (postcss.config.js,
        // tailwind.config.js, vite.config.*). They live in /tmp/proj (not node_modules)
        // and are loaded by vite/postcss in the WASI bundler context where workerd gives
        // import.meta.url === undefined -> fileURLToPath(undefined) throws. transformTree
        // skips them (it only walks node_modules), so rewrite the root configs by hand.
        const rootConfigs = [];
        for (const name of fs.readdirSync(PROJ)) {
          if (!/\.(js|mjs|cjs|ts|mts|cts)$/.test(name)) continue;
          if (!/config/.test(name)) continue;
          const p = PROJ + "/" + name;
          let src;
          try { src = fs.readFileSync(p, "utf8"); } catch { continue; }
          if (!/import\.meta\.(url|dirname|filename)/.test(src)) continue;
          const fmt = name.endsWith(".cjs") ? "cjs" : "esm";
          const out = rewriteSource(src, p, fmt);
          if (out !== src) { fs.writeFileSync(p, out); rootConfigs.push(name); }
        }
        return Response.json({ ok: true, op: "transform", ms: Date.now() - t0, ...stats, rootConfigs });
      }

      if (url.pathname === "/run-child") {
        const viteMain = PROJ + "/node_modules/vite/package.json";
        if (!fs.existsSync(viteMain)) {
          return Response.json(
            { ok: false, error: "vite not installed; run /install first (did /tmp persist?)" },
            { status: 500 }
          );
        }
        // Write the probe UNDER /tmp/proj so bare specifiers resolve against
        // /tmp/proj/node_modules. It installs the UnsafeEval-backed globals (from the
        // implicit child binding) before any wasm-compiling import runs.
        fs.writeFileSync(
          PROJ + "/probe.mjs",
          `
          import { WorkerEntrypoint } from "cloudflare:workers";
          import * as nodeFs from "node:fs";
          ${CHILD_GLOBALS_PRELUDE}
          export default class extends WorkerEntrypoint {
            async probe() {
              installGlobals(this.env);
              const out = {};
              // vite@8 imports the (overlaid) rolldown binding at load, which constructs WASI and
              // reads /tmp -- so give it the rolldown boot globals (native fs IS the shared /tmp).
              globalThis.__WASI_NO_BUSY_SLEEP = true;
              globalThis.__EMNAPI_SCHED = (cb) => queueMicrotask(cb);
              globalThis.__RD_ENV = { RD_LOG: "", RD_LOG_OUTPUT: "readable" };
              globalThis.__ROLLDOWN_FS = nodeFs;
              globalThis.__WAIT_UNTIL = (p) => { try { this.ctx.waitUntil(p); } catch {} };
              try { globalThis.__ROLLDOWN_WASM_BYTES = nodeFs.readFileSync("/tmp/proj/rolldown.wasm"); } catch {}
              // RUNG 2 proof: the implicit UnsafeEval binding is reachable in the child.
              try { out.unsafeEval = "OK eval(1+1)=" + this.env.UNSAFE_EVAL.eval("1+1"); }
              catch (e) { out.unsafeEval = "ERR " + String(e); }
              // vite@8's FULL JS module graph loads AND evaluates from /tmp (incl. logger.js's
              // module-eval-time fs.readFileSync of vite/package.json -> needs the shared-/tmp
              // module-eval fallback in the workerd fork). Reaches the rolldown native-binding
              // boundary, which the rolldown WASM fork overlay (run-rolldown) replaces.
              try {
                const vite = await import("vite");
                out.viteImport = "OK keys=" + Object.keys(vite).slice(0, 8).join(",") + " version=" + vite.version;
              } catch (e) { out.viteImport = "ERR " + (e && e.stack ? e.stack : String(e)); }
              try {
                const pr = await import("@vitejs/plugin-react");
                out.pluginReact = "OK keys=" + Object.keys(pr).slice(0, 8).join(",");
              } catch (e) { out.pluginReact = "ERR " + (e && e.stack ? e.stack : String(e)); }
              return out;
            }
          }
          `
        );
        const child = this.env.LOADER.get("vite-child", () => viteChild());
        const ep = child.getEntrypoint();
        const result = await ep.probe();
        return Response.json({ ok: true, op: "run-child", result });
      }

      if (url.pathname === "/run-rolldown") {
        // Write a rolldown-boot probe under /tmp/proj (so bare specifiers resolve),
        // load the child, boot the single-threaded WASM rolldown fork, and run a real
        // bundle entirely from /tmp.
        fs.mkdirSync(PROJ + "/rdsrc", { recursive: true });
        fs.writeFileSync(PROJ + "/rdsrc/package.json", JSON.stringify({ name: "rdsrc", type: "module" }));
        fs.writeFileSync(PROJ + "/rdsrc/in.js", "export const x = 41 + 1; globalThis.__rd_x = x;\n");
        fs.writeFileSync(
          PROJ + "/rolldown-probe.mjs",
          `
          import { WorkerEntrypoint } from "cloudflare:workers";
          import * as nodeFs from "node:fs";
          ${CHILD_GLOBALS_PRELUDE}
          export default class extends WorkerEntrypoint {
            async run() {
              installGlobals(this.env);
              const out = {};
              // rolldown WASM fork boot globals (mirror harness/worker/driver.mjs ensureVfs)
              globalThis.__WASI_NO_BUSY_SLEEP = true;
              globalThis.__TSFN_LOG = false;
              globalThis.__EMNAPI_SCHED = (cb) => queueMicrotask(cb);
              globalThis.__RD_ENV = { RD_LOG: "", RD_LOG_OUTPUT: "readable" };
              globalThis.__ROLLDOWN_FS = nodeFs;                  // native fs IS the shared /tmp
              globalThis.__WAIT_UNTIL = (p) => { try { this.ctx.waitUntil(p); } catch {} };
              try {
                globalThis.__ROLLDOWN_WASM_BYTES = nodeFs.readFileSync("/tmp/proj/rolldown.wasm");
                out.wasmBytes = globalThis.__ROLLDOWN_WASM_BYTES.length;
              } catch (e) { out.wasmRead = "ERR " + String(e); return out; }
              try {
                const binding = await import("/tmp/proj/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js");
                out.bindingImported = true;
                if (globalThis.__ROLLDOWN_ENSURE_READY) { await globalThis.__ROLLDOWN_ENSURE_READY(); out.ready = true; }
              } catch (e) { out.binding = "ERR " + (e && e.stack ? String(e.stack).split("\\n").slice(0,8).join(" | ") : String(e)); return out; }
              try {
                const rd = await import("rolldown");
                out.rolldownImport = "OK keys=" + Object.keys(rd).slice(0, 6).join(",") + " version=" + (rd.VERSION || rd.version || "?");
                const bundle = await rd.rolldown({ input: "/tmp/proj/rdsrc/in.js", cwd: "/tmp/proj/rdsrc" });
                const { output } = await bundle.generate({ format: "esm" });
                out.build = "OK chunks=" + output.length + " firstLen=" + (output[0] && output[0].code ? output[0].code.length : 0);
                out.firstCodeHead = output[0] && output[0].code ? output[0].code.slice(0, 80) : null;
              } catch (e) { out.rolldown = "ERR " + (e && e.stack ? e.stack : String(e)); }
              return out;
            }
          }
          `
        );
        const child = this.env.LOADER.get("rolldown-child", () => rolldownChild());
        const ep = child.getEntrypoint();
        const result = await ep.run();
        return Response.json({ ok: true, op: "run-rolldown", result });
      }

      if (url.pathname === "/run-vite-build") {
        // RUNG 3-full: vite build of the ToDo app from /tmp in a child, using the
        // single-threaded rolldown wasm fork + esbuild-wasm. The child installs the
        // UnsafeEval + rolldown-boot globals (mirroring harness driver), boots the
        // rolldown binding, then runs vite.build().
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
              // rolldown's wasm WASI resolver walks up directories statting package.json. Over the
              // native /tmp fs the WASI layer maps a MISSING file to an empty read ("File is empty"
              // JSONError) instead of ENOENT (memfs, which the harness uses, returns ENOENT). Wrap
              // node:fs so stat/read of a non-existent path throws an ENOENT-coded error, giving the
              // WASI shim the not-found signal it expects.
              // BLOCKER FIX (native node:fs over workerd): openSync(missing, O_RDONLY)
              // does NOT throw ENOENT in the child's native fs -- it returns a valid fd
              // and fd_read yields 0 bytes, so rolldown's oxc_resolver reads a missing
              // package.json as "" -> JSONError "File is empty" while walking dirs. WASI's
              // path_open (@tybys preview1) calls fs.openSync with low-level O_* flags; the
              // shim's handleError maps a thrown {code:'ENOENT'} to WasiErrno.ENOENT. So
              // surface ENOENT here for read-only opens of non-existent paths (skip when
              // O_CREAT is set so genuine create opens still work). This is the (a) "purer"
              // fix from the task: make the WASI fd/path op signal ENOENT over native fs.
              globalThis.__ROLLDOWN_FS = makeEnoentFs(nodeFs);
              globalThis.__WAIT_UNTIL = (p) => { try { this.ctx.waitUntil(p); } catch {} };
              try { globalThis.__ROLLDOWN_WASM_BYTES = nodeFs.readFileSync("/tmp/proj/rolldown.wasm"); }
              catch (e) { out.wasmRead = "ERR " + String(e); return out; }
              // boot rolldown binding first (same sequence as harness)
              try {
                await import("/tmp/proj/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js");
                if (globalThis.__ROLLDOWN_ENSURE_READY) await globalThis.__ROLLDOWN_ENSURE_READY();
                await import("rolldown");
                out.rolldownReady = true;
              } catch (e) { out.rolldownBoot = "ERR " + (e && e.stack ? String(e.stack).split("\\n").slice(0,6).join(" | ") : String(e)); return out; }
              out.fsCheck = {
                mainTsx: nodeFs.existsSync("/tmp/proj/src/main.tsx"),
                indexHtml: nodeFs.existsSync("/tmp/proj/index.html"),
                srcLs: (() => { try { return nodeFs.readdirSync("/tmp/proj/src"); } catch (e) { return String(e); } })(),
              };
              try {
                const vite = await import("vite");
                const { default: react } = await import("@vitejs/plugin-react");
                out.viteVersion = vite.version;
                const t0 = Date.now();
                await vite.build({
                  root: "/tmp/proj",
                  configFile: false,
                  envFile: false,
                  logLevel: "warn",
                  plugins: [react()],
                  build: { outDir: "/tmp/proj/dist", emptyOutDir: true, minify: false },
                });
                out.buildMs = Date.now() - t0;
                out.dist = nodeFs.readdirSync("/tmp/proj/dist");
                try { out.assets = nodeFs.readdirSync("/tmp/proj/dist/assets"); } catch {}
                try {
                  const html = nodeFs.readFileSync("/tmp/proj/dist/index.html", "utf8");
                  out.indexHtmlLen = html.length;
                  out.indexHtmlHead = html.slice(0, 200);
                } catch (e) { out.indexHtml = "ERR " + String(e); }
              } catch (e) { out.viteBuild = "ERR " + (e && e.stack ? String(e.stack).split("\\n").slice(0,16).join(" | ") : String(e)); }
              return out;
            }
          }
          `
        );
        const child = this.env.LOADER.get("vite-build-child", () => viteBuildChild());
        const ep = child.getEntrypoint();
        const result = await ep.run();
        return Response.json({ ok: true, op: "run-vite-build", result });
      }

      if (url.pathname === "/scaffold-dev-probe") {
        // Write the dev-server probe into /tmp/proj (so bare specifiers resolve against
        // /tmp/proj/node_modules), fetched from the host service.
        const t0 = Date.now();
        const res = await this.env.HOST.fetch("http://host/dev-probe");
        const src = await res.text();
        fs.writeFileSync(PROJ + "/vite-dev-probe.mjs", src);
        return Response.json({ ok: true, op: "scaffold-dev-probe", ms: Date.now() - t0, bytes: src.length });
      }

      if (url.pathname === "/dev-warmup") {
        // Boot the persistent vite-dev child + warm the dep optimizer to completion.
        const t0 = Date.now();
        const child = this.env.LOADER.get("vite-dev-child", () => viteDevChild(this.env.DEV_PORT));
        const ep = child.getEntrypoint();
        const result = await ep.warmup();
        if (result?.ok) this.devReady = true;
        return Response.json({ ok: true, op: "dev-warmup", ms: Date.now() - t0, result });
      }


      if (url.pathname === "/fs-caps") {
        // Probe the exact native-fs ops vite's dep-optimizer commit relies on.
        const out = {};
        const base = "/tmp/fscap";
        try { fs.rmSync(base, { recursive: true, force: true }); } catch {}
        // rm of a missing path with force:true
        try { fs.rmSync(base + "/missing", { recursive: true, force: true }); out.rmMissingForce = "ok (no throw)"; }
        catch (e) { out.rmMissingForce = "THROW " + e.code; }
        // rm of a missing path WITHOUT force (vite loadCachedDepOptimizationMetadata)
        try { fs.rmSync(base + "/missing2", { recursive: true }); out.rmMissingNoForce = "ok (no throw)"; }
        catch (e) { out.rmMissingNoForce = "THROW " + e.code; }
        // directory rename (the optimizer commit: processing -> deps)
        try {
          fs.mkdirSync(base + "/src/sub", { recursive: true });
          fs.writeFileSync(base + "/src/a.js", "export const x=1;");
          fs.renameSync(base + "/src", base + "/dst");
          out.dirRename = fs.existsSync(base + "/dst/a.js") ? "ok" : "moved-but-missing-file";
        } catch (e) { out.dirRename = "THROW " + e.code + " " + e.message.slice(0, 80); }
        // rename when destination already exists (rename deps -> temp, then processing -> deps)
        try {
          fs.mkdirSync(base + "/d1", { recursive: true });
          fs.mkdirSync(base + "/d2", { recursive: true });
          fs.writeFileSync(base + "/d2/b.js", "1");
          fs.renameSync(base + "/d1", base + "/d1_tmp");
          fs.renameSync(base + "/d2", base + "/d1");
          out.renameSwap = fs.existsSync(base + "/d1/b.js") ? "ok" : "swapped-but-missing";
        } catch (e) { out.renameSwap = "THROW " + e.code + " " + e.message.slice(0, 80); }
        try { fs.rmSync(base, { recursive: true, force: true }); } catch {}
        return Response.json(out);
      }

      if (url.pathname === "/dev-deps-state") {
        const viteDir = PROJ + "/node_modules/.vite";
        const out = {};
        const ls = (p) => { try { return fs.readdirSync(p); } catch (e) { return "ERR " + String(e); } };
        out.viteDir = ls(viteDir);
        out.deps = ls(viteDir + "/deps");
        try { out.metadata = JSON.parse(fs.readFileSync(viteDir + "/deps/_metadata.json", "utf8")); } catch (e) { out.metadata = "ERR " + String(e); }
        return Response.json(out);
      }

      if (url.pathname === "/diag") {
        const read = (p) => {
          try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return { error: String(e) }; }
        };
        const prRoot = PROJ + "/node_modules/@vitejs/plugin-react";
        const pr = read(prRoot + "/package.json");
        const rdPkg = read(PROJ + "/node_modules/rolldown/package.json");
        let bindingHead = null;
        try { bindingHead = fs.readFileSync(PROJ + "/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js","utf8").slice(0,120); } catch (e) { bindingHead = "ERR " + String(e); }
        return Response.json({
          pluginReact: { type: pr.type, exports: pr.exports },
          rolldown: { type: rdPkg.type, main: rdPkg.main, exportsDot: rdPkg.exports && rdPkg.exports["."] },
          bindingHead,
        });
      }

      // BROWSER-FACING dev server (catch-all). Once the vite-dev child is warmed, any path
      // that isn't a control op above is the browser using the app: "/", "/src/main.tsx",
      // "/node_modules/.vite/deps/*", "/@vite/client", the "/__hmr" WebSocket, etc. Forward
      // it verbatim to the persistent vite-dev child's fetch over RPC; the child runs vite
      // (loaded from /tmp) in middleware mode + the WebSocketPair-backed HMR transport.
      if (this.devReady) {
        const child = this.env.LOADER.get("vite-dev-child", () => viteDevChild(this.env.DEV_PORT));
        const ep = child.getEntrypoint();
        const fwd = new Request(new URL(url.pathname + url.search, "http://vite.local"), request);
        return await ep.fetch(fwd);
      }

      return new Response("ops: /install /transform /run-vite-build /scaffold-dev-probe /dev-warmup /diag", { status: 404 });
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
