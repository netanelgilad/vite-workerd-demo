// CLEAN runner: install @netanelgilad/vite (+ its aliased @netanelgilad/rolldown
// dep) from the PUBLIC npm REGISTRY (https://registry.npmjs.org/) into a DO's /tmp
// via Arborist, scaffold the ToDo app, then load a Worker-Loader child that
// resolves+RUNS vite's module graph from the shared /tmp via the workerd fork's
// VFS module fallback. NO local tarballs.
//
// The whole point of this harness vs do-machine: there is NO runtime overlay
// (no rolldown-wasm/esbuild drop-in) and NO source-transform pass. Everything the
// child needs is already baked into the installed packages:
//   - @netanelgilad/rolldown ships the single-threaded rolldown.wasm + patched
//     emnapi/@tybys runtime + pre-baked code-gen rewrites.
//   - @netanelgilad/vite is repinned onto it, bundles a workerd esbuild-wasm shim,
//     and has its own code-gen rewrites baked.
//   - import.meta.url is supplied natively by the workerd VFS loader (fork fix).
// The child still installs the runtime-contract globals (__UNSAFE_EVAL, __wasmCompile,
// __ROLLDOWN_FS, __EMNAPI_SCHED, ...) -- that is the host/child contract, not a code rewrite.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

import { moduleFallback } from "../do-native-fs/host-do.mjs";

import { writeSync as _ws, openSync as _os } from "node:fs";
const _dbg = _os("/tmp/capstone-exit.log", "a");
const _w = (s) => { try { _ws(_dbg, `[${new Date().toISOString()}] ${s}\n`); } catch {} };
_w("=== boot pid " + process.pid + " ===");
process.on("exit", (c) => _w("EXIT code=" + c));
process.on("uncaughtException", (e) => _w("UNCAUGHT " + (e && e.stack || e)));
process.on("unhandledRejection", (e) => _w("UNHANDLED " + (e && (e.stack || e.message) || e)));
process.on("SIGTERM", () => { _w("SIGTERM"); process.exit(143); });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const DEMO = path.resolve(HERE, "../../.."); // vite-workerd-demo
const APP_TODO = path.join(DEMO, "app-todo");

const verbose = process.env.VERBOSE === "1";

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

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

function hostService(request) {
  const url = new URL(request.url);
  if (url.pathname === "/app-manifest") {
    return new MfResponse(JSON.stringify(buildAppManifest()), { headers: { "content-type": "application/json" } });
  }
  if (url.pathname === "/dev-probe") {
    return new MfResponse(readFileSync(path.join(HERE, "worker/vite-dev-probe.mjs")), { headers: { "content-type": "text/javascript" } });
  }
  return new MfResponse("not found", { status: 404 });
}

const DEV = process.env.DEV === "1";
const PORT = Number(process.env.PORT ?? 5190);

const mf = new Miniflare({
  log: new Log(verbose ? LogLevel.DEBUG : LogLevel.WARN),
  ...(DEV ? { host: "127.0.0.1", port: PORT } : {}),
  modulesRoot: ROOT,
  modules: [{ type: "ESModule", path: path.join(HERE, "worker/driver-do.mjs") }],
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

// Optional durable sink: RESULTS_FILE=path makes each step append its result as a
// JSON line (capture is then independent of stdout buffering / dispose hangs).
// Per-PID results file so two accidental concurrent runs never truncate each other.
const RESULTS_FILE = process.env.RESULTS_FILE
  ? process.env.RESULTS_FILE.replace(/\.jsonl$/, "") + "." + process.pid + ".jsonl"
  : null;
if (RESULTS_FILE) { try { (await import("node:fs")).writeFileSync(RESULTS_FILE, ""); console.log("[results] " + RESULTS_FILE); } catch {} }
async function call(pathAndQuery, label, ms = 300000) {
  const t0 = Date.now();
  const res = await withTimeout(mf.dispatchFetch("http://do.local" + pathAndQuery), ms, label);
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  const wall = Date.now() - t0;
  console.log(`\n=== ${label} === HTTP ${res.status} | wall ${wall}ms`);
  console.log(JSON.stringify(json, null, 2));
  if (RESULTS_FILE) {
    try {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(RESULTS_FILE, JSON.stringify({ label, path: pathAndQuery, status: res.status, wall, json }) + "\n");
    } catch {}
  }
  return { status: res.status, json };
}

let ok = false;
try {
  console.log("# DO-MACHINE-CLEAN: npm install @netanelgilad/vite from PUBLIC npm + run it from /tmp in a child (NO transform, NO overlay, NO local tarball)");

  if (DEV) {
    // DEV: serve the in-isolate vite dev server on the bound HTTP port. miniflare hands a
    // port request to a DO instance whose /tmp is independent from the dispatchFetch DO, so
    // we WARM the SERVING DO by hitting the port itself. The driver's /dev-warmup op (and
    // the serve path's self-heal) install from the public registry, scaffold, and boot vite
    // on whichever DO answers the port -- the same one the browser will reach.
    await mf.ready;
    const devUrl = `http://127.0.0.1:${PORT}/`;
    const warm = await withTimeout(
      fetch(`http://127.0.0.1:${PORT}/dev-warmup`).then((r) => r.json()),
      600000,
      "dev-warmup (port)"
    );
    console.log(`\n=== DEV WARMUP (public-registry install + scaffold + vite boot on the serving DO) ===`);
    console.log(JSON.stringify(warm, null, 2));
    // Probe the port serves real HTML (the self-heal completes on first serve if needed).
    let probe = { status: 0 };
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(devUrl, { headers: { "sec-fetch-dest": "document" } });
        const ct = res.headers.get("content-type") || "";
        const body = await res.text();
        probe = { status: res.status, ct, isHtml: ct.includes("text/html") && /<!doctype html|<html/i.test(body), len: body.length };
        if (probe.isHtml) break;
      } catch (e) { probe = { status: 0, err: String(e) }; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`\n=== DEV SERVE PROBE === ${JSON.stringify(probe)}`);
    if (warm?.result?.ok && probe.isHtml) {
      console.log(`\n  ->  vite dev server (PUBLIC-REGISTRY install, running from /tmp in a DO child) is live:`);
      console.log(`  ->  Local:   ${devUrl}\n`);
      ok = true;
    } else {
      console.error("dev not serving HTML; see probe above.");
    }
    if (process.env.READY_FILE) {
      try { (await import("node:fs")).writeFileSync(process.env.READY_FILE, JSON.stringify({ ok, url: devUrl, warm: warm?.result, probe }) + "\n"); } catch {}
    }
    if (ok) {
      // Keep the serving DO + its vite-dev child warm. miniflare can evict an idle DO
      // (dropping the in-memory devReady flag + the booted vite singleton) AND can spread
      // concurrent port requests across multiple DO instances, so a cold browser request
      // (the browser fires ~10 parallel sub-resource fetches) would otherwise pay the
      // scaffold+vite-boot cost on each cold instance and time out. We fire a small burst
      // of concurrent pings so several instances stay warm for the browser session.
      const ping = () => { for (let i = 0; i < 6; i++) fetch(devUrl, { headers: { "sec-fetch-dest": "document" } }).catch(() => {}); };
      ping();
      setInterval(ping, 1000);
      await new Promise(() => {}); // hold the port open for the browser
    }
  } else {
    await call("/install", "INSTALL @netanelgilad/vite (+rolldown fork) from PUBLIC REGISTRY (Arborist -> /tmp)", 600000);
    await call("/scaffold-app", "SCAFFOLD ToDo app source into /tmp/proj", 60000);
    const build = await call("/run-vite-build", "RUN CHILD: vite build ToDo app from /tmp (clean install, no transform)", 300000);
    ok = build.status === 200 && Array.isArray(build.json?.result?.dist) &&
      build.json.result.dist.includes("index.html") && Array.isArray(build.json?.result?.assets) &&
      build.json.result.assets.some((f) => /\.js$/.test(f));
  }
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  // Tearing down the shared-tmp Worker-Loader child can hang miniflare's dispose(),
  // so cap it: flush stdout, then hard-exit. Without the cap the process lingers,
  // buffered output never flushes, and the outer `timeout` SIGKILLs it (losing the
  // JSON results). Run only ONE instance at a time — concurrent runs race on the
  // DO's shared /tmp/proj and corrupt each other's install.
  if (!DEV) {
    await new Promise((r) => process.stdout.write("", r)); // drain stdout
    const disposed = await Promise.race([
      mf.dispose().then(() => true),
      new Promise((r) => setTimeout(() => r(false), 3000)),
    ]);
    if (!disposed) console.error("(dispose timed out; forcing exit)");
    process.exit(ok ? 0 : 1);
  }
}
