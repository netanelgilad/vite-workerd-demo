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
// UNIQUE scratch paths so this probe never races a concurrently-running install
// that uses /tmp/proj + /tmp/npmcache.
const PROJ = "/tmp/install-probe-proj";
const CACHE = "/tmp/install-probe-cache";
const INSTR_PATH = "/tmp/install-probe-instr.log";

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
  async installFromRegistry(fs, opts = {}) {
    fs.mkdirSync(PROJ, { recursive: true });
    fs.mkdirSync(CACHE, { recursive: true });
    const t0 = Date.now();

    // ---- INSTRUMENTATION: phase + true connection tracking ----------------
    // Durable log: write to native /tmp so milestones survive even if the
    // isolate is SIGKILLed / hangs (host reads it back). process.memoryUsage()
    // returns zeros in workerd, so we count connections by hooking node:https
    // directly (proc-log http events resolve to a DIFFERENT module instance
    // through the VFS loader, so they don't reach a listener registered here).
    const LOG = INSTR_PATH;
    try { fs.writeFileSync(LOG, ""); } catch {}
    const INSTR = { phases: {}, http: { reqStart: 0, reqDone: 0, reqErr: 0, inflightMax: 0, ended: 0, byEvent: {} }, events: [] };
    let inflight = 0;
    const phaseStack = [];
    const log2 = (s) => {
      const line = `[+${Date.now() - t0}ms] ${s}`;
      INSTR.events.push(line);
      try { fs.appendFileSync(LOG, line + "\n"); } catch {}
    };
    // ---- Connection accounting + optional SEMAPHORE on node:https.request --
    // The agent shim returns getAgent()->undefined, so npm's maxSockets:12 is
    // bypassed and ALL packument+tarball fetches fire with zero throttle. When
    // MAXCONC > 0 we gate req.end() (which is what kicks off the underlying
    // fetch() in the fork's http client) behind a semaphore so at most MAXCONC
    // outbound fetches run at once -- this restores the throttle npm relies on.
    const MAXCONC = Number(opts.maxConc || globalThis.__INSTALL_MAXCONC || 0);
    let active = 0; const waiters = [];
    const acquire = () => MAXCONC <= 0 ? Promise.resolve() : new Promise((res) => {
      if (active < MAXCONC) { active++; res(); } else waiters.push(res);
    });
    const release = () => { if (MAXCONC <= 0) return; active = Math.max(0, active - 1); const w = waiters.shift(); if (w) { active++; w(); } };
    if (MAXCONC > 0) log2("SEMAPHORE enabled MAXCONC=" + MAXCONC);

    // Per-request lifecycle map: id -> { tStart, phase, host }. Lets a stall show
    // EXACTLY which request(s) are stuck and in what state (req-sent / responded /
    // body-reading) and for how long.
    const liveReqs = new Map();
    globalThis.__LIVE_REQS = liveReqs;
    const reqDigest = () => {
      const now = Date.now();
      const parts = [];
      for (const [id, r] of liveReqs) parts.push(`#${id}:${r.phase}:${now - r.tStart}ms:${r.host}`);
      return parts.length ? parts.join(",") : "(none-live)";
    };
    let httpsMod, httpMod;
    try { httpsMod = await import("node:https"); } catch (e) { log2("https import fail " + e.message); }
    try { httpMod = await import("node:http"); } catch {}
    const wrapRequest = (mod, name) => {
      if (!mod) return;
      const orig = mod.request?.bind(mod);
      const origDef = mod.default?.request?.bind(mod.default);
      const make = (origFn) => function (...args) {
        const id = ++INSTR.http.reqStart;
        inflight++; if (inflight > INSTR.http.inflightMax) INSTR.http.inflightMax = inflight;
        const tReq = Date.now();
        // derive a host/path label for the digest
        let label = "?";
        try {
          const a0 = args[0];
          if (typeof a0 === "string") label = a0.slice(0, 60);
          else if (a0 && typeof a0 === "object") label = (a0.hostname || a0.host || "") + (a0.path || "");
          else if (a0 instanceof URL) label = a0.host + a0.pathname;
        } catch {}
        liveReqs.set(id, { tStart: tReq, phase: "opening", host: label.slice(0, 40) });
        let released = false;
        const finish = (tag) => {
          inflight = Math.max(0, inflight - 1);
          INSTR.http.byEvent[tag] = (INSTR.http.byEvent[tag] || 0) + 1;
          liveReqs.delete(id);
          if (!released) { released = true; release(); }
        };
        let req;
        try { req = origFn(...args); } catch (e) { finish("throw"); INSTR.http.reqErr++; throw e; }
        try {
          const lr = liveReqs.get(id); if (lr) lr.phase = "req-sent";
          req.on("response", (res) => {
            INSTR.http.reqDone++;
            const r2 = liveReqs.get(id); if (r2) r2.phase = `responded(${res.statusCode})`;
            res.on("data", () => { const r3 = liveReqs.get(id); if (r3) r3.phase = `body-reading(${res.statusCode})`; });
            res.on("end", () => { INSTR.http.ended++; const r4 = liveReqs.get(id); if (r4) r4.phase = `body-ended(${res.statusCode})`; });
            res.on("close", () => { finish("res-close"); });
            res.on("aborted", () => { finish("res-aborted"); INSTR.http.reqErr++; });
          });
          req.on("error", (e) => { finish("req-error"); INSTR.http.reqErr++; });
          req.on("timeout", () => { log2(`req#${id} TIMEOUT after ${Date.now()-tReq}ms inflight=${inflight} host=${label.slice(0,40)}`); });
          // SEMAPHORE: gate the actual end() (-> fetch kickoff) behind a slot.
          if (MAXCONC > 0) {
            const origEnd = req.end.bind(req);
            req.end = (...endArgs) => {
              const r5 = liveReqs.get(id); if (r5) r5.phase = "waiting-slot";
              acquire().then(() => { const r6 = liveReqs.get(id); if (r6) r6.phase = "req-sent"; try { origEnd(...endArgs); } catch (e) { finish("end-throw"); } });
              return req;
            };
          }
        } catch {}
        return req;
      };
      try { if (orig) mod.request = make(orig); } catch {}
      try { if (origDef && mod.default) mod.default.request = make(origDef); } catch {}
    };
    wrapRequest(httpsMod, "https");
    wrapRequest(httpMod, "http");
    // proc-log phase timing (time.start/end may resolve to our instance for the
    // arborist we import here since it's the same VFS graph; try anyway).
    let procLog;
    try { procLog = await import("/tmp/xnm/npm/node_modules/proc-log/lib/index.js"); } catch (e) { log2("proc-log import failed: " + e.message); }
    const onTimeStart = (name) => { phaseStack.push([name, Date.now()]); log2("PHASE START " + name + " (inflight=" + inflight + " req=" + INSTR.http.reqDone + "/" + INSTR.http.reqStart + ")"); };
    const onTimeEnd = (name) => {
      for (let i = phaseStack.length - 1; i >= 0; i--) {
        if (phaseStack[i][0] === name) { const ms = Date.now() - phaseStack[i][1]; INSTR.phases[name] = (INSTR.phases[name] || 0) + ms; phaseStack.splice(i, 1); log2("PHASE END   " + name + " " + ms + "ms"); break; }
      }
    };
    if (procLog?.time?.on) { procLog.time.on("start", onTimeStart); procLog.time.on("end", onTimeEnd); }
    if (procLog?.log?.on) {
      procLog.log.on("warn", (...a) => log2("WARN " + a.join(" ").slice(0, 200)));
      procLog.log.on("error", (...a) => log2("ERR " + a.join(" ").slice(0, 200)));
    }
    // periodic inflight/connection sampler (memoryUsage is unreliable in workerd).
    // 500ms cadence; only emit when state changed OR every 4s heartbeat, with the
    // live-request digest so a stall pinpoints the stuck request + its phase.
    let lastSampleKey = "";
    let sampleTick = 0;
    const sampler = setInterval(() => {
      sampleTick++;
      const key = `${inflight}/${INSTR.http.reqStart}/${INSTR.http.reqDone}/${INSTR.http.ended}/${INSTR.http.reqErr}`;
      if (key !== lastSampleKey || sampleTick % 8 === 0) {
        lastSampleKey = key;
        log2(`SAMPLE inflight=${inflight} reqStart=${INSTR.http.reqStart} reqDone=${INSTR.http.reqDone} ended=${INSTR.http.ended} err=${INSTR.http.reqErr} maxInflight=${INSTR.http.inflightMax} byEvent=${JSON.stringify(INSTR.http.byEvent)} live=${reqDigest()}`);
      }
    }, 500);
    // -----------------------------------------------------------------------

    const SMALL = opts.small || globalThis.__INSTALL_SMALL;
    const deps = SMALL
      ? { "lodash": "^4.17.21" }
      : {
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
    fs.writeFileSync(
      PROJ + "/package.json",
      JSON.stringify(
        {
          name: "scratch",
          version: "1.0.0",
          private: true,
          dependencies: deps,
        },
        null,
        2
      )
    );
    log2("package.json written (small=" + !!SMALL + ", deps=" + Object.keys(deps).length + ")");
    const { default: Arborist } = await import(ARBORIST);
    log2("Arborist imported");
    // Hardening knobs (Arborist spreads these straight into pacote /
    // npm-registry-fetch / make-fetch-happen). With the agent shimmed away,
    // maxSockets is dead, so a stalled fetch never times out by default ->
    // infinite hang. An explicit per-request timeout + retries converts a
    // stalled outbound fetch into a bounded failure + retry instead of a hang.
    const TIMEOUT_MS = Number(opts.fetchTimeout || globalThis.__INSTALL_FETCH_TIMEOUT || 0);
    const RETRIES = Number(opts.fetchRetries ?? globalThis.__INSTALL_FETCH_RETRIES ?? 0);
    if (TIMEOUT_MS) log2("HARDEN fetch timeout=" + TIMEOUT_MS + "ms retries=" + RETRIES);
    const arb = new Arborist({
      path: PROJ,
      cache: CACHE,
      registry: "https://registry.npmjs.org/",
      ignoreScripts: true,
      audit: false,
      fund: false,
      progress: false,
      packumentCache: new Map(),
      ...(TIMEOUT_MS ? { timeout: TIMEOUT_MS, fetchRetries: RETRIES, fetchRetryMintimeout: 1000, fetchRetryMaxtimeout: 10000 } : {}),
      // `@vitejs/plugin-react@6` has a REQUIRED peer `vite: "^8.0.0"`. The fork's version
      // `8.0.16-workerd.0` is a PRERELEASE, which by semver does NOT satisfy `^8.0.0`, so a
      // strict resolve fails with a peer conflict. This is exactly the case
      // `npm install --legacy-peer-deps` exists for; a real user installing the fork +
      // plugin-react would pass the same flag. (The local-tarball path dodged this only
      // because vite wasn't in Arborist's tree during its pass.) This is an npm-side
      // resolution accommodation, NOT a package defect or a patch-around.
      legacyPeerDeps: true,
    });
    log2("reify START");
    try {
      await arb.reify({ ignoreScripts: true, audit: false, legacyPeerDeps: true });
      log2("reify DONE");
    } catch (e) {
      log2("reify ERROR " + (e && e.stack ? String(e.stack).split("\n").slice(0,6).join(" | ") : String(e)));
      clearInterval(sampler);
      return { ok: false, op: "install", error: String(e), instr: INSTR };
    } finally {
      clearInterval(sampler);
    }
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
      instr: INSTR,
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
      if (url.pathname === "/instr") {
        let log = "";
        try { log = fs.readFileSync(INSTR_PATH, "utf8"); } catch (e) { log = "ERR " + e.message; }
        return new Response(log, { headers: { "content-type": "text/plain" } });
      }
      if (url.pathname === "/install") {
        const q = url.searchParams;
        if (q.get("small") === "1") globalThis.__INSTALL_SMALL = true;
        globalThis.__INSTR_LOG = (s) => { try { console.log("[INSTR] " + s); } catch {} };
        const summary = await this.installFromRegistry(fs, {
          small: q.get("small") === "1",
          maxConc: Number(q.get("maxConc") || 0),
          fetchTimeout: Number(q.get("fetchTimeout") || 0),
          fetchRetries: Number(q.get("fetchRetries") || 0),
        });
        return Response.json(summary);
      }
      // DETACHED install: start the install in the background (retained on the DO
      // instance) and return immediately, so the long CPU/IO work never holds a
      // single fragile dispatchFetch connection open (which resets under load/
      // contention and shows up as a false "fetch failed"). Poll /install-status.
      if (url.pathname === "/install-start") {
        const q = url.searchParams;
        if (this._installState && this._installState.status === "running") {
          return Response.json({ ok: true, started: false, already: "running" });
        }
        this._installState = { status: "running", startedAt: Date.now() };
        const opts = {
          small: q.get("small") === "1",
          maxConc: Number(q.get("maxConc") || 0),
          fetchTimeout: Number(q.get("fetchTimeout") || 0),
          fetchRetries: Number(q.get("fetchRetries") || 0),
        };
        const p = (async () => {
          try {
            const summary = await this.installFromRegistry(fs, opts);
            this._installState = { status: "done", summary, finishedAt: Date.now() };
          } catch (e) {
            this._installState = { status: "error", error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 12), finishedAt: Date.now() };
          }
        })();
        // Retain the work beyond this request so workerd doesn't cancel it.
        try { this.state?.waitUntil?.(p); } catch {}
        this._installPromise = p;
        return Response.json({ ok: true, started: true });
      }
      if (url.pathname === "/install-status") {
        const s = this._installState || { status: "idle" };
        return Response.json(s);
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
