// VITE-SERVE SPIKE runner. Proves the REAL vite bin serves the app in a workerd child.
//   build/serve once:  MINIFLARE_WORKERD_PATH=~/Development/workerd-vfs.bin node run.mjs
//   browser dev:        DEV=1 PORT=5191 MINIFLARE_WORKERD_PATH=~/Development/workerd-vfs.bin node run.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Log, LogLevel, Miniflare, Response as MfResponse } from "miniflare";

import { moduleFallback } from "../do-native-fs/host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, ".."); // experiments/npm-in-workerd
const DEMO = path.resolve(HERE, "../../.."); // vite-workerd-demo
const APP_TODO = path.join(DEMO, "app-todo");
const HTTP_SHIM = path.join(ROOT, "shims-vite/node-http.mjs");
const PROBE = path.join(HERE, "worker/vite-realbin-probe.mjs");
const verbose = process.env.VERBOSE === "1";

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}
function buildAppManifest() {
  const files = {};
  const skip = (p) => p.includes("/node_modules/") || p.includes("/dist/") || p.includes("/.git/") || p.includes("/proof-screenshots/") || p.endsWith("package-lock.json");
  for (const f of walk(APP_TODO)) { if (skip(f)) continue; files[f.slice(APP_TODO.length + 1)] = readFileSync(f).toString("base64"); }
  return files;
}

function hostService(request) {
  const url = new URL(request.url);
  if (url.pathname === "/app-manifest") return new MfResponse(JSON.stringify(buildAppManifest()), { headers: { "content-type": "application/json" } });
  if (url.pathname === "/vite-http-shim") return new MfResponse(readFileSync(HTTP_SHIM), { headers: { "content-type": "text/javascript" } });
  if (url.pathname === "/realbin-probe") return new MfResponse(readFileSync(PROBE), { headers: { "content-type": "text/javascript" } });
  return new MfResponse("not found", { status: 404 });
}

const DEV = process.env.DEV === "1";
const PORT = Number(process.env.PORT ?? 5191);

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
  bindings: { DEV_PORT: String(DEV ? PORT : "") },
  serviceBindings: { HOST: hostService },
  durableObjects: { RUNNER: "NpmChildRunner" },
  workerLoaders: { LOADER: {} },
});

function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT ${ms}ms: ${label}`)), ms))]);
}
async function call(p, label, ms = 240000) {
  const t0 = Date.now();
  const res = await withTimeout(mf.dispatchFetch("http://do.local" + p), ms, label);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  console.log(`\n=== ${label} === HTTP ${res.status} | wall ${Date.now() - t0}ms`);
  console.log(json.raw ? json.raw.slice(0, 600) : JSON.stringify(json, null, 2));
  return { status: res.status, json };
}

let ok = false;
try {
  if (DEV) {
    await mf.ready;
    const devUrl = `http://127.0.0.1:${PORT}/`;
    const warm = await withTimeout(fetch(`http://127.0.0.1:${PORT}/serve`).then((r) => r.json()), 240000, "serve");
    console.log("=== SERVE (real vite bin) ===\n" + JSON.stringify(warm, null, 2));
    let probe = { status: 0 };
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(devUrl, { headers: { "sec-fetch-dest": "document" } });
        const body = await res.text();
        probe = { status: res.status, isHtml: /<!doctype html|<html|<div id="root"/i.test(body), len: body.length };
        if (probe.isHtml) break;
      } catch (e) { probe = { status: 0, err: String(e) }; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log("=== DEV PROBE === " + JSON.stringify(probe));
    if (warm?.result?.ok && probe.isHtml) { console.log(`\n  ->  REAL vite bin serving at ${devUrl}\n`); ok = true; const ping = () => { for (let i = 0; i < 4; i++) fetch(devUrl).catch(() => {}); }; ping(); setInterval(ping, 1500); await new Promise(() => {}); }
    else console.error("not serving HTML; see probe.");
  } else {
    console.log("# VITE-SERVE SPIKE: run the REAL vite bin in a workerd child + serve via node:http shim");
    await call("/setup", "SETUP install fork vite + scaffold + write http shim + redirect vite node:http", 240000);
    const serve = await call("/serve", "SERVE warm: run real vite bin to 'listening'", 180000);
    if (serve.json?.result?.ok) {
      const home = await call("/", "GET / through vite's connect app", 60000);
      const htmlOk = home.json?.raw ? /<div id="root"|@vite\/client/i.test(home.json.raw) : false;
      // Exercise the real transform pipeline (TSX + react plugin + dep optimizer).
      const main = await call("/src/main.tsx", "GET /src/main.tsx (transformed module)", 60000);
      const client = await call("/@vite/client", "GET /@vite/client (vite HMR client)", 60000);
      const mainOk = main.json?.raw ? /import|jsxDEV|createRoot|react/i.test(main.json.raw) : false;
      const clientOk = client.status === 200 && (client.json?.raw || "").length > 100;
      ok = htmlOk && mainOk && clientOk;
      console.log(`\n  checks: html=${htmlOk} main.tsx=${mainOk} viteClient=${clientOk}`);
      console.log(ok ? "  -> REAL vite bin served + transformed the app (renders)\n" : "  -> partial; see bodies above\n");
    }
  }
} catch (e) {
  console.error("\nERROR:", e?.stack ?? String(e));
} finally {
  if (!DEV) {
    await new Promise((r) => process.stdout.write("", r));
    await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
    process.exit(ok ? 0 : 1);
  }
}
