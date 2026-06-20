// SCRATCH runner: install real vite@^8 + @vitejs/plugin-react in a DO's /tmp,
// then load a Worker-Loader child that resolves vite's module graph from the
// shared /tmp via the fork's VFS module fallback (exports/imports support).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

import { moduleFallback } from "../do-native-fs/host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const HARNESS = path.resolve(HERE, "../../../harness"); // vite-workerd-demo/harness

const verbose = process.env.VERBOSE === "1";

// ---- ROLLDOWN FORK OVERLAY (rung 3) ----
// The native rolldown installed by npm ships a .node binding workerd can't load. We
// overlay the proven single-threaded WASM fork from the harness over /tmp's rolldown,
// plus its patched emnapi/napi runtime deps, mirroring harness/host.mjs ALIASES +
// patch-emnapi-wasi. The DO fetches these from this host service and writes them into
// the shared /tmp via native fs, so the child loads the fork through the VFS fallback.
const OVERLAY = [
  { virt: "node_modules/rolldown", host: path.join(HARNESS, "rolldown-shim") },
  { virt: "node_modules/@napi-rs/wasm-runtime", host: path.join(HARNESS, "node_modules/@napi-rs/wasm-runtime") },
  { virt: "node_modules/@emnapi/core", host: path.join(HARNESS, "node_modules/@emnapi/core") },
  { virt: "node_modules/@emnapi/runtime", host: path.join(HARNESS, "node_modules/@emnapi/runtime") },
  { virt: "node_modules/@emnapi/wasi-threads", host: path.join(HARNESS, "node_modules/@emnapi/wasi-threads") },
  { virt: "node_modules/@tybys/wasm-util", host: path.join(HARNESS, "node_modules/@tybys/wasm-util") },
];

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

function buildOverlayManifest() {
  const files = {};
  for (const o of OVERLAY) {
    if (!existsSync(o.host)) { console.warn("[overlay] missing:", o.host); continue; }
    for (const f of walk(o.host)) {
      if (/\.(ts|map|tsbuildinfo)$/.test(f)) continue; // skip types/maps
      const rel = f.slice(o.host.length);
      files[o.virt + rel] = readFileSync(f).toString("base64");
    }
  }
  return files;
}

const ROLLDOWN_WASM = process.env.ROLLDOWN_WASM ?? path.join(HARNESS, "worker/rolldown.wasm");
const APP_TODO = path.resolve(HERE, "../../../app-todo");
const ESBUILD_WASM = path.join(HARNESS, "node_modules/esbuild-wasm/esbuild.wasm");

// app-todo source (no node_modules / dist) -> scaffolded into /tmp/proj as the build root.
function buildAppManifest() {
  const files = {};
  const skip = (p) =>
    p.includes("/node_modules/") || p.includes("/dist/") || p.includes("/.git/") ||
    p.includes("/proof-screenshots/") || p.endsWith("package-lock.json");
  for (const f of walk(APP_TODO)) {
    if (skip(f)) continue;
    files[f.slice(APP_TODO.length + 1)] = readFileSync(f).toString("base64");
  }
  return files;
}

// esbuild-wasm fork shim (harness/shims/esbuild.mjs) + the esm browser build, overlaid as the
// `esbuild` package so vite's dep optimizer runs single-threaded on wasm via UnsafeEval.
const ESBUILD_OVERLAY = [
  { virt: "node_modules/esbuild-wasm", host: path.join(HARNESS, "node_modules/esbuild-wasm") },
];
function buildEsbuildManifest() {
  const files = {};
  for (const o of ESBUILD_OVERLAY) {
    if (!existsSync(o.host)) { console.warn("[esbuild] missing", o.host); continue; }
    for (const f of walk(o.host)) {
      if (/\.(map)$/.test(f)) continue;
      files[o.virt + f.slice(o.host.length)] = readFileSync(f).toString("base64");
    }
  }
  // the harness esbuild shim file, dropped at /tmp/proj/esbuild-shim.mjs
  files["esbuild-shim.mjs"] = readFileSync(path.join(HARNESS, "shims/esbuild.mjs")).toString("base64");
  return files;
}

function hostService(request) {
  const url = new URL(request.url);
  if (url.pathname === "/app-manifest") {
    return new MfResponse(JSON.stringify(buildAppManifest()), { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/esbuild-manifest") {
    return new MfResponse(JSON.stringify(buildEsbuildManifest()), { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/esbuild.wasm") {
    return new MfResponse(readFileSync(ESBUILD_WASM), { headers: { "content-type": "application/wasm" } });
  }
  if (url.pathname === "/overlay-manifest") {
    const m = buildOverlayManifest();
    const bytes = Object.values(m).reduce((a, b) => a + b.length, 0);
    console.log(`[host] overlay: ${Object.keys(m).length} files ~${(bytes * 0.75 / 1024 / 1024).toFixed(1)}MB`);
    return new MfResponse(JSON.stringify(m), { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/rolldown.wasm") {
    return new MfResponse(readFileSync(ROLLDOWN_WASM), { headers: { "content-type": "application/wasm" } });
  }
  return new MfResponse("not found", { status: 404 });
}

const mf = new Miniflare({
  log: new Log(verbose ? LogLevel.DEBUG : LogLevel.WARN),
  modulesRoot: ROOT,
  modules: [
    { type: "ESModule", path: "do-machine/worker/driver-do.mjs" },
    { type: "ESModule", path: "do-machine/transform-tmp.mjs" },
  ],
  compatibilityDate: "2026-06-01",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  unsafeEvalBinding: "UNSAFE_EVAL",
  unsafeUseModuleFallbackService: true,
  unsafeModuleFallbackService: moduleFallback,
  serviceBindings: { HOST: hostService },
  durableObjects: { RUNNER: "NpmChildRunner" },
  workerLoaders: { LOADER: {} },
});

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms)),
  ]);
}

async function call(pathAndQuery, label, ms = 300000) {
  const t0 = Date.now();
  const res = await withTimeout(mf.dispatchFetch("http://do.local" + pathAndQuery), ms, label);
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  console.log(`\n=== ${label} === HTTP ${res.status} | wall ${Date.now() - t0}ms`);
  console.log(JSON.stringify(json, null, 2));
  return { status: res.status, json };
}

let ok = false;
try {
  console.log("# DO-MACHINE: run a real Vite/Rolldown toolchain from a DO's shared /tmp in child isolates");
  await call("/install", "INSTALL vite + react + plugin-react + tailwind (Arborist -> /tmp)", 600000);
  await call("/overlay-rolldown", "OVERLAY rolldown WASM fork into /tmp", 120000);
  await call("/overlay-esbuild", "OVERLAY esbuild-wasm + shim into /tmp", 120000);
  await call("/scaffold-app", "SCAFFOLD ToDo app source into /tmp/proj", 60000);
  await call("/transform", "TRANSFORM PASS over /tmp (workerd-ready rewrites)", 120000);
  // RUNG 1+2: import('vite') loads + EVALUATES vite@8's full JS graph from /tmp in a child
  // (UnsafeEval injected by the fork + shared-/tmp module-eval fallback). Pre-overlay, this
  // reached the rolldown native-.node boundary; see git history / report for that milestone.
  // RUNG 1+2+3 together: the single-threaded rolldown WASM fork boots from /tmp -- which requires
  // UnsafeEval (wasm compile), node: builtins, the shared-/tmp module-eval fallback (emnapi/napi
  // glue + wasm bytes read at eval time), and the exports-condition fix -- then bundles real code.
  const rd = await call("/run-rolldown", "RUN CHILD: boot rolldown WASM fork + bundle from /tmp");
  // RUNG 3-full (in progress): vite build of the ToDo app from /tmp.
  await call("/run-vite-build", "RUN CHILD: vite build ToDo app from /tmp", 300000);
  ok = rd.status === 200 && /OK chunks=/.test(JSON.stringify(rd.json?.result?.build ?? ""));
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  await mf.dispose();
}
process.exit(ok ? 0 : 1);
