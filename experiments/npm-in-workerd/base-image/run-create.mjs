// BASE-IMAGE `npm create vite` runner. Same boot-the-rootfs harness as run.mjs, but it
// drives the full real-npm scaffold flow over the BOOTED base image (npm in /usr):
//
//   1. /boot               extract the workerd-ready rootfs (npm) into the VFS root (/usr, /etc)
//   2. /npm-create         REAL `npm create vite myapp -- --template react-ts` — npm's own
//                          libnpmexec (from the VFS) installs create-vite into the npx cache
//                          and runs the genuine create-vite bin in a sub-isolate via
//                          workerd's NATIVE child_process.spawn -> a real react-ts scaffold.
//   3. /npm-install-app    repin vite->@netanelgilad/vite fork (+ add rolldown fork), then
//                          REAL `npm install` inside myapp -> node_modules has vite+rolldown.
//
// There is NO host npm mount — if npm runs, it ran from the image in /usr.
//   node base-image/build.mjs   # once, to build the image
//   MINIFLARE_WORKERD_PATH=~/Development/workerd-stable.bin node base-image/run-create.mjs
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
async function call(p, label, ms = 240000) {
  const t0 = Date.now();
  const res = await withTimeout(mf.dispatchFetch("http://do.local" + p), ms, label);
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  console.log(`\n=== ${label} === HTTP ${res.status} | wall ${Date.now() - t0}ms`);
  console.log(JSON.stringify(json, null, 2).slice(0, 4000));
  return { status: res.status, json };
}

const PROJECT = process.env.PROJECT || "myapp";
let ok = false;
try {
  console.log("# BASE-IMAGE `npm create vite`: boot npm-in-/usr, then REAL npm create vite + npm install over it");
  await call("/boot", "BOOT: extract base image into the VFS", 120000);

  const cr = await call(`/npm-create?project=${PROJECT}&template=react-ts`,
    `NPM CREATE VITE — REAL \`npm create vite ${PROJECT} -- --template react-ts\` (libnpmexec from the VFS + create-vite in a sub-isolate)`, 240000);
  const crr = cr.json?.result;
  const scaffoldOk = cr.json?.ok && Array.isArray(crr?.files) &&
    crr.files.includes("package.json") && crr.files.some((f) => /^src\//.test(f)) &&
    crr.files.some((f) => /^src\/App\.tsx$/.test(f)) && crr.files.some((f) => /vite\.config\.ts$/.test(f));
  console.log(scaffoldOk
    ? `\n  ->  REAL \`npm create vite\` scaffolded /work/${PROJECT} (${crr.files.length} files): ${crr.files.join(", ")}\n`
    : `\n  ->  npm create vite ran but the scaffold looks incomplete; see result above.\n`);
  if (!scaffoldOk) throw new Error("scaffold incomplete — stopping before npm install");

  const ia = await call(`/npm-install-app?project=${PROJECT}`,
    `NPM INSTALL — repin vite->fork + add rolldown fork, then REAL \`npm install\` inside ${PROJECT}`, 300000);
  const iar = ia.json?.result;
  ok = ia.json?.ok && iar?.hasVite && iar?.hasRolldown;
  console.log(ok
    ? `\n  ->  REAL \`npm install\` over the base image installed ${iar.count} packages incl. vite + rolldown into ${PROJECT}/node_modules\n`
    : `\n  ->  npm install ran but vite/rolldown are missing; see result above.\n`);
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  await new Promise((r) => process.stdout.write("", r));
  await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  process.exit(ok ? 0 : 1);
}
