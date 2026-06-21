// One-shot capture harness for the BUILD flow (non-DEV). Boots the same DO/miniflare
// as run.mjs, drives /install -> /scaffold-app -> /run-vite-build, then writes the full
// JSON results to OUT (sync, single shot) and hard-exits. Bypasses run.mjs's streaming
// console output entirely so capture is deterministic.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

import { moduleFallback } from "../do-native-fs/host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const DEMO = path.resolve(HERE, "../../..");
const APP_TODO = path.join(DEMO, "app-todo");
// PID-named output so no other (ghost) process can clobber this run's file.
const OUT = (process.env.OUT || path.join(HERE, "proof/build-result.json")).replace(/\.json$/, "") + "." + process.pid + ".json";

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}
function buildAppManifest() {
  const files = {};
  const skip = (p) => p.includes("/node_modules/") || p.includes("/dist/") || p.includes("/.git/") || p.endsWith("package-lock.json");
  for (const f of walk(APP_TODO)) { if (skip(f)) continue; files[f.slice(APP_TODO.length + 1)] = readFileSync(f).toString("base64"); }
  return files;
}
function hostService(request) {
  const url = new URL(request.url);
  if (url.pathname === "/app-manifest") return new MfResponse(JSON.stringify(buildAppManifest()), { headers: { "content-type": "application/json" } });
  if (url.pathname === "/dev-probe") return new MfResponse(readFileSync(path.join(HERE, "worker/vite-dev-probe.mjs")), { headers: { "content-type": "text/javascript" } });
  return new MfResponse("not found", { status: 404 });
}

const mf = new Miniflare({
  log: new Log(LogLevel.WARN),
  modulesRoot: ROOT,
  modules: [{ type: "ESModule", path: path.join(HERE, "worker/driver-do.mjs") }],
  compatibilityDate: "2026-06-01",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  unsafeEvalBinding: "UNSAFE_EVAL",
  unsafeUseModuleFallbackService: true,
  unsafeModuleFallbackService: moduleFallback,
  serviceBindings: { HOST: hostService },
  durableObjects: { RUNNER: "NpmChildRunner" },
  workerLoaders: { LOADER: {} },
});

const results = {};
async function step(p, ms) {
  const t0 = Date.now();
  const res = await Promise.race([
    mf.dispatchFetch("http://do.local" + p),
    new Promise((_, r) => setTimeout(() => r(new Error("timeout " + p)), ms)),
  ]);
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  results[p] = { status: res.status, wall: Date.now() - t0, json };
  // persist after EVERY step (sync, full overwrite) so a hang never loses prior steps
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.error(`[capture] ${p} -> HTTP ${res.status} (${Date.now() - t0}ms)`);
  return results[p];
}

let code = 1;
try {
  await step("/install", 600000);
  await step("/scaffold-app", 60000);
  const b = await step("/run-vite-build", 300000);
  const r = b.json?.result || {};
  const ok = b.status === 200 && Array.isArray(r.dist) && r.dist.includes("index.html") &&
    Array.isArray(r.assets) && r.assets.some((f) => /\.js$/.test(f));
  results.__verdict = { buildOk: ok, rolldownReady: r.rolldownReady, viteVersion: r.viteVersion };
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.error("[capture] VERDICT buildOk=" + ok);
  code = ok ? 0 : 1;
} catch (e) {
  results.__error = String(e?.stack || e);
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.error("[capture] ERROR " + e);
} finally {
  // dispose can hang on the shared-tmp child; cap it then hard-exit.
  await Promise.race([mf.dispose(), new Promise((r) => setTimeout(r, 3000))]);
  process.exit(code);
}
