// BASE-IMAGE `npm create vite` via the LITERAL npm bin — the recursive-process test.
// Same harness as run-create.mjs, but every npm step is a fire-and-forget drainProcess
// child running `node npm-cli.js <argv>` (NOT the awaited npm.load()+npm.exec path):
//
//   1. /boot                 extract the workerd-ready rootfs (npm) into the DO's /tmp
//   2. /npm-create-bin       LITERAL `node npm-cli.js create vite myapp -- --template
//                            react-ts` in a drainProcess child. npm (process 1) spawns
//                            create-vite (process 2) DURING the drain via workerd's NATIVE
//                            child_process.spawn (allowSpawn -> recursive sub-isolate
//                            processes, no JS plumbing).
//   3. /npm-install-app-bin  repin vite->fork (+ rolldown fork), then LITERAL
//                            `node npm-cli.js install` (drainProcess child, cwd=myapp)
//                            -> node_modules has vite + rolldown.
//
//   node base-image/build.mjs   # once, to build the image
//   MINIFLARE_WORKERD_PATH=~/Development/workerd-drainproc.bin node base-image/run-create-bin.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const STAGING = path.join(HERE, ".staging");
const verbose = process.env.VERBOSE === "1";

if (!existsSync(STAGING)) { console.error("no base-image/.staging — run `node base-image/build.mjs` first"); process.exit(2); }

function buildImageManifest() {
  const files = {};
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) files[p.slice(STAGING.length + 1)] = readFileSync(p).toString("base64");
    }
  })(STAGING);
  return files;
}
let manifestCache = null;
function hostService(request) {
  const url = new URL(request.url);
  if (url.pathname === "/image-manifest") {
    manifestCache = manifestCache || JSON.stringify(buildImageManifest());
    return new MfResponse(manifestCache, { headers: { "content-type": "application/json" } });
  }
  return new MfResponse("not found", { status: 404 });
}

const mf = new Miniflare({
  log: new Log(verbose ? LogLevel.DEBUG : LogLevel.WARN),
  modulesRoot: ROOT,
  modules: [{ type: "ESModule", path: path.join(HERE, "worker/driver-do.mjs") }],
  compatibilityDate: "2026-06-01",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  unsafeEvalBinding: "UNSAFE_EVAL",
  serviceBindings: { HOST: hostService },
  durableObjects: { RUNNER: "NpmBaseImage" },
  workerLoaders: { LOADER: {} },
});

function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT ${ms}ms: ${label}`)), ms))]);
}
// Serial calls; one retry if the transport dies (e.g. workerd OOM-SIGKILLed mid-op — each
// route re-runs boot() so a fresh workerd can rebuild its /tmp state).
async function call(p, label, ms = 300000) {
  for (let attempt = 1; ; attempt++) {
    const t0 = Date.now();
    try {
      const res = await withTimeout(mf.dispatchFetch("http://do.local" + p), ms, label);
      const json = await res.json().catch(async () => ({ raw: await res.text() }));
      console.log(`\n=== ${label} === HTTP ${res.status} | wall ${Date.now() - t0}ms${attempt > 1 ? " | attempt " + attempt : ""}`);
      console.log(JSON.stringify(json, null, 2).slice(0, 4000));
      return { status: res.status, json };
    } catch (e) {
      if (attempt >= 2) throw e;
      console.error(`\n=== ${label} === attempt ${attempt} failed (${e?.message ?? e}); retrying once`);
    }
  }
}

const PROJECT = process.env.PROJECT || "myapp";
let ok = false;
try {
  console.log("# LITERAL-BIN `npm create vite`: npm-cli.js as a drainProcess child spawns create-vite as a sub-isolate process");
  await call("/boot", "BOOT: extract base image into the VFS", 120000);

  const cr = await call(`/npm-create-bin?project=${PROJECT}&template=react-ts`,
    `NPM CREATE VITE (LITERAL BIN) — \`node npm-cli.js create vite ${PROJECT} -- --template react-ts\` fire-and-forget in a drainProcess child; create-vite spawned during the drain`, 300000);
  const crr = cr.json?.result;
  const scaffoldOk = cr.json?.ok && Array.isArray(crr?.files) &&
    crr.files.includes("package.json") && crr.files.some((f) => /^src\//.test(f)) &&
    crr.files.some((f) => /^src\/App\.tsx$/.test(f)) && crr.files.some((f) => /vite\.config\.ts$/.test(f));
  console.log(scaffoldOk
    ? `\n  ->  the LITERAL npm bin scaffolded /work/${PROJECT} (${crr.files.length} files): ${crr.files.join(", ")}\n`
    : `\n  ->  npm create vite (literal bin) ran but the scaffold looks incomplete; see result above.\n`);
  if (!scaffoldOk) throw new Error("scaffold incomplete — stopping before npm install");

  const ia = await call(`/npm-install-app-bin?project=${PROJECT}`,
    `NPM INSTALL (LITERAL BIN) — repin vite->fork + rolldown fork, then \`node npm-cli.js install\` in a drainProcess child inside ${PROJECT}`, 300000);
  const iar = ia.json?.result;
  ok = ia.json?.ok && iar?.hasVite && iar?.hasRolldown;
  console.log(ok
    ? `\n  ->  the LITERAL npm bin installed ${iar.count} packages incl. vite + rolldown into ${PROJECT}/node_modules\n`
    : `\n  ->  npm install (literal bin) ran but vite/rolldown are missing; see result above.\n`);
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  await new Promise((r) => process.stdout.write("", r));
  await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  process.exit(ok ? 0 : 1);
}
