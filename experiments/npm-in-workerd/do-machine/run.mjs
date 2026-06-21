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
  // do-machine esbuild shim (native fs + native wasm read; no __HOST/memfs), dropped at
  // /tmp/proj/esbuild-shim.mjs. The harness shim depends on __HOST.fetch + /tmp/shims/fs.mjs
  // (memfs), neither of which exists in the do-machine child; this one uses native /tmp.
  files["esbuild-shim.mjs"] = readFileSync(path.join(HERE, "worker/esbuild-shim-native.mjs")).toString("base64");
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
  if (url.pathname === "/dev-probe") {
    return new MfResponse(readFileSync(path.join(HERE, "worker/vite-dev-probe.mjs")), { headers: { "content-type": "text/javascript" } });
  }
  return new MfResponse("not found", { status: 404 });
}

const DEV = process.env.DEV === "1";
const PORT = Number(process.env.PORT ?? 5180);

const mf = new Miniflare({
  log: new Log(verbose ? LogLevel.DEBUG : LogLevel.WARN),
  // In DEV mode bind a real port so a browser can reach the in-isolate vite dev server.
  ...(DEV ? { host: "127.0.0.1", port: PORT } : {}),
  modulesRoot: ROOT,
  modules: [
    { type: "ESModule", path: path.join(HERE, "worker/driver-do.mjs") },
    { type: "ESModule", path: path.join(HERE, "transform-tmp.mjs") },
  ],
  compatibilityDate: "2026-06-01",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  unsafeEvalBinding: "UNSAFE_EVAL",
  unsafeUseModuleFallbackService: true,
  unsafeModuleFallbackService: moduleFallback,
  bindings: { DEV_PORT: String(PORT) },
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
  if (process.env.FSCAPS === "1") {
    // Quick native-fs capability probe (no install) -- diagnose optimizer-commit fs ops.
    await call("/fs-caps", "FS CAPABILITY PROBE (dir rename / rm-missing)", 30000);
    await mf.dispose();
    process.exit(0);
  }
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
  // RUNG 3-full: vite build of the ToDo app from /tmp.
  const build = await call("/run-vite-build", "RUN CHILD: vite build ToDo app from /tmp", 300000);
  const buildOk = build.status === 200 && Array.isArray(build.json?.result?.dist) &&
    build.json.result.dist.includes("index.html") && Array.isArray(build.json?.result?.assets) &&
    build.json.result.assets.some((f) => /\.js$/.test(f));

  if (DEV) {
    // RUNG 3 (dev server) + RUNG 4 (browser proof): scaffold the dev probe, boot the
    // persistent vite-dev child + warm the optimizer, then leave miniflare listening on a
    // real port so a browser (Playwright) can use the in-isolate vite dev server.
    await call("/scaffold-dev-probe", "SCAFFOLD vite-dev probe into /tmp/proj", 60000);
    const warm = await call("/dev-warmup", "DEV WARMUP: boot vite dev server in child + prebundle deps", 300000);
    const devUrl = `http://127.0.0.1:${PORT}/`;
    if (warm.json?.result?.ok) {
      console.log(`\n  ➜  vite dev server (running from /tmp in a DO child) is live:`);
      console.log(`  ➜  Local:   ${devUrl}`);
      console.log(`\n  Open the URL above in a browser. The process stays up; Ctrl-C to stop.\n`);
      ok = true;
      // Keep the process alive for the browser.
      await new Promise(() => {});
    } else {
      console.error("dev warmup failed; not serving.");
    }
  } else {
    ok = rd.status === 200 && /OK chunks=/.test(JSON.stringify(rd.json?.result?.build ?? "")) && buildOk;
  }
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  if (!DEV) await mf.dispose();
}
process.exit(ok ? 0 : 1);
