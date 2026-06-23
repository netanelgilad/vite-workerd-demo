// CREATE-VITE SPIKE runner: install the real create-vite from the public npm
// registry into a DO's /tmp, then run its real bin in a Worker-Loader child over
// the shared /tmp. De-risks "real npm create vite" before wiring the spawn bridge.
//
//   MINIFLARE_WORKERD_PATH=~/Development/workerd-vfs.bin node run.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Log, LogLevel, Miniflare } from "miniflare";

import { moduleFallback } from "../do-native-fs/host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, ".."); // experiments/npm-in-workerd (mounts node_modules at /tmp/xnm)
const verbose = process.env.VERBOSE === "1";

const mf = new Miniflare({
  log: new Log(verbose ? LogLevel.DEBUG : LogLevel.WARN),
  modulesRoot: ROOT,
  modules: [{ type: "ESModule", path: path.join(HERE, "worker/driver-do.mjs") }],
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

async function call(p, label, ms = 120000) {
  const t0 = Date.now();
  const res = await withTimeout(mf.dispatchFetch("http://do.local" + p), ms, label);
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  console.log(`\n=== ${label} === HTTP ${res.status} | wall ${Date.now() - t0}ms`);
  console.log(JSON.stringify(json, null, 2));
  return { status: res.status, json };
}

const MODE = process.env.MODE || "exec"; // "exec" = real libnpmexec path; "direct" = install+run bin directly
let ok = false;
try {
  if (MODE === "exec") {
    console.log("# CREATE-VITE SPIKE (exec): the LITERAL `npm create vite` path — real libnpmexec installs create-vite then spawns it via the child_process->isolate bridge");
    const run = await call("/exec-cv", "EXEC real libnpmexec: `create-vite todo --template react-ts --no-interactive`", 240000);
    const r = run.json?.result;
    ok = run.json?.ok && Array.isArray(r?.files) &&
      r.files.includes("package.json") && r.files.some((f) => /^src\//.test(f)) &&
      r.files.some((f) => /vite\.config\./.test(f));
    console.log(ok
      ? `\n  ->  REAL \`npm create vite\` (libnpmexec + spawn bridge) scaffolded /tmp/proj/${r.project} (${r.files.length} files)\n`
      : `\n  ->  exec ran but the scaffold looks incomplete; see result above.\n`);
  } else {
    console.log("# CREATE-VITE SPIKE (direct): real `create-vite` install + real bin run in a workerd child over shared /tmp");
    const inst = await call("/install-cv", "INSTALL real create-vite (Arborist -> /tmp/cvnpx, public registry)", 180000);
    if (inst.json?.distExists && inst.json?.templateReactTs) {
      const run = await call("/run-cv", "RUN real create-vite bin (scaffold react-ts -> /tmp/cvout)", 60000);
      const r = run.json?.result;
      ok = run.json?.ok && Array.isArray(r?.files) &&
        r.files.includes("package.json") && r.files.some((f) => /^src\//.test(f)) &&
        r.files.some((f) => /vite\.config\./.test(f));
      console.log(ok
        ? `\n  ->  REAL create-vite scaffolded a react-ts project in /tmp/cvout (${r.files.length} files)\n`
        : `\n  ->  create-vite ran but the scaffold looks incomplete; see result above.\n`);
    } else {
      console.error("create-vite install incomplete (no dist or template-react-ts); see install result.");
    }
  }
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  await new Promise((r) => process.stdout.write("", r));
  await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  process.exit(ok ? 0 : 1);
}
