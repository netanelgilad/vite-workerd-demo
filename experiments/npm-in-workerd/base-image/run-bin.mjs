// Run the LITERAL npm bin (fire-and-forget) as a supervised sub-isolate PROCESS via the
// fork's `drainProcess` primitive — "node npm-cli.js install <pkg>" shimmed by a sub-isolate.
//   node base-image/build.mjs   # once
//   MINIFLARE_WORKERD_PATH=~/Development/workerd-vfs.bin node base-image/run-bin.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const STAGING = path.join(HERE, ".staging");
if (!existsSync(STAGING)) { console.error("run `node base-image/build.mjs` first"); process.exit(2); }

let manifest = null;
function hostService(request) {
  if (new URL(request.url).pathname === "/image-manifest") {
    if (!manifest) {
      const files = {};
      (function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files[p.slice(STAGING.length + 1)] = readFileSync(p).toString("base64"); } })(STAGING);
      manifest = JSON.stringify(files);
    }
    return new MfResponse(manifest, { headers: { "content-type": "application/json" } });
  }
  return new MfResponse("not found", { status: 404 });
}

const mf = new Miniflare({
  log: new Log(process.env.VERBOSE === "1" ? LogLevel.DEBUG : LogLevel.WARN),
  modulesRoot: ROOT,
  modules: [{ type: "ESModule", path: path.join(HERE, "worker/driver-do.mjs") }],
  compatibilityDate: "2026-06-01",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  unsafeEvalBinding: "UNSAFE_EVAL",
  serviceBindings: { HOST: hostService },
  durableObjects: { RUNNER: "NpmBaseImage" },
  workerLoaders: { LOADER: {} },
});

let ok = false;
try {
  console.log("# LITERAL npm bin as a supervised sub-isolate process (drainProcess)");
  const res = await mf.dispatchFetch("http://do.local/npm-install-bin?pkg=left-pad");
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2).slice(0, 1800));
  const r = json.result;
  ok = !!json.ok;
  console.log(ok
    ? `\n  ->  the LITERAL fire-and-forget npm bin ran as a process in a sub-isolate and installed left-pad (${r.ms}ms). node_modules: ${r.installed.join(", ")}\n`
    : `\n  ->  did not install; see above.\n`);
} catch (e) {
  console.error("ERROR:", e?.stack ?? String(e));
} finally {
  await new Promise((r) => process.stdout.write("", r));
  await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  process.exit(ok ? 0 : 1);
}
