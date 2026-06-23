// STAGE 2 runner: install left-pad in a DO's /tmp, then load a Worker-Loader
// child that require()s it from the shared /tmp. Uses our forked workerd binary
// (MINIFLARE_WORKERD_PATH). Caps every dispatch with a timeout so a hang can't
// wedge the run.
//
// Reuses the proven do-native-fs host module fallback (moduleFallback) for the
// DO's OWN npm machinery. The CHILD's modules are resolved by workerd's native
// VFS fallback (the fork feature under test) -- the host fallback is never
// consulted for them.
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
  modules: [{ type: "ESModule", path: "vfs-child-mod/worker/driver-do.mjs" }],
  compatibilityDate: "2026-06-01",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  unsafeEvalBinding: "UNSAFE_EVAL",
  unsafeUseModuleFallbackService: true,
  unsafeModuleFallbackService: moduleFallback,
  durableObjects: { RUNNER: "NpmChildRunner" },
  // Worker Loader binding the DO uses to spawn the child isolate.
  workerLoaders: { LOADER: {} },
});

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms)),
  ]);
}

async function call(pathAndQuery, label, ms = 120000) {
  const t0 = Date.now();
  const res = await withTimeout(mf.dispatchFetch("http://do.local" + pathAndQuery), ms, label);
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  console.log(`\n=== ${label} === HTTP ${res.status} | wall ${Date.now() - t0}ms`);
  console.log(JSON.stringify(json, null, 2));
  return { status: res.status, json };
}

let ok = false;
try {
  console.log("# STAGE 2: child isolate require()s a REAL npm package from shared /tmp");
  await call("/install?pkg=left-pad@1.3.0", "INSTALL left-pad (Arborist -> native /tmp)", 180000);
  const run = await call("/run-child", "RUN CHILD (require('left-pad') from /tmp/node_modules)");

  ok =
    run.status === 200 &&
    run.json?.ok === true &&
    run.json?.cjsResult === "    x" &&
    run.json?.esmResult === "   y";

  console.log(
    "\nVERDICT:",
    ok
      ? "PASS — child ran a real npm-installed package (left-pad) loaded entirely from the shared /tmp via CJS require AND ESM import"
      : "FAIL"
  );
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  await mf.dispose();
}
process.exit(ok ? 0 : 1);
