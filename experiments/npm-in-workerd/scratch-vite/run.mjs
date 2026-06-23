// SCRATCH runner: install real vite@^8 + @vitejs/plugin-react in a DO's /tmp,
// then load a Worker-Loader child that resolves vite's module graph from the
// shared /tmp via the fork's VFS module fallback (exports/imports support).
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Log, LogLevel, Miniflare } from "miniflare";

import { moduleFallback } from "../do-native-fs/host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

const verbose = process.env.VERBOSE === "1";

const mf = new Miniflare({
  log: new Log(verbose ? LogLevel.DEBUG : LogLevel.WARN),
  modulesRoot: ROOT,
  modules: [{ type: "ESModule", path: "scratch-vite/worker/driver-do.mjs" }],
  compatibilityDate: "2026-06-01",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  unsafeEvalBinding: "UNSAFE_EVAL",
  unsafeUseModuleFallbackService: true,
  unsafeModuleFallbackService: moduleFallback,
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
  console.log("# SCRATCH: resolve real vite's module graph from shared /tmp in a child isolate");
  await call("/install", "INSTALL vite@^8 + @vitejs/plugin-react (Arborist -> native /tmp)", 600000);
  await call("/diag", "DIAG plugin-react package.json");
  const run = await call("/run-child", "RUN CHILD (import('vite') from /tmp/node_modules)");
  ok = run.status === 200;
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  await mf.dispose();
}
process.exit(ok ? 0 : 1);
