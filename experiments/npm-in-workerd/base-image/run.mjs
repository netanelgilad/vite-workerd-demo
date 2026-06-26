// BASE-IMAGE SPIKE runner. Serves the built rootfs (base-image/.staging) as a manifest,
// boots it into the DO's native /tmp, then runs the REAL npm bin from /usr in a child over
// the VFS. There is NO /tmp/xnm host-npm mount here — if npm runs, it ran from the VFS.
//   node base-image/build.mjs   # once, to build the image
//   MINIFLARE_WORKERD_PATH=~/Development/workerd-vfs.bin node base-image/run.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, ".."); // experiments/npm-in-workerd
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
  console.log(JSON.stringify(json, null, 2).slice(0, 2500));
  return { status: res.status, json };
}

let ok = false;
try {
  console.log("# BASE-IMAGE SPIKE: boot a workerd-ready rootfs (npm in /usr) + run npm from the VFS in a child");
  await call("/boot", "BOOT: extract base image into the VFS", 120000);
  const r = await call("/npm-install?pkg=left-pad", "NPM INSTALL left-pad — REAL npm bin from /usr, in a child over the VFS", 240000);
  const res = r.json?.result;
  ok = Array.isArray(res?.installed) && res.installed.includes("left-pad");
  console.log(ok
    ? `\n  ->  REAL npm (from /usr in the VFS, in a child) installed left-pad. node_modules: ${res.installed.join(", ")}\n`
    : `\n  ->  npm did not install left-pad; see result above.\n`);
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  await new Promise((r) => process.stdout.write("", r));
  await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  process.exit(ok ? 0 : 1);
}
