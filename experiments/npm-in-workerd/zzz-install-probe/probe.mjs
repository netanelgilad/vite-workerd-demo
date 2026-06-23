// Uniquely-named scratch probe runner for the npm-install-in-workerd hang investigation.
// Runs ONE /install against a single DO instance, polls the durable /tmp/instr.log
// frequently so we capture the LAST phase before any hang, and exits.
//
//   MINIFLARE_WORKERD_PATH=/Users/netanelg/Development/workerd-vfs.bin \
//     RUN_ID=base-1 node /tmp/install-probe/probe.mjs
//   SMALL=1 ...   # tiny tree (lodash)
//   MAXCONC=4 ... # cap outbound concurrency
//   FETCH_TIMEOUT=30000 FETCH_RETRIES=3 ... # per-request timeout + retry
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFileSync } from "node:fs";

import { Log, LogLevel, Miniflare } from "miniflare";
import { moduleFallback } from "./host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// modulesRoot must CONTAIN the driver module; the module-fallback mounts
// (/tmp/xnm -> the experiment's node_modules) use absolute host paths, so they
// resolve regardless of modulesRoot.
const ROOT = HERE;
const SMALL = process.env.SMALL === "1";
const TIMEOUT = Number(process.env.TIMEOUT ?? 300000);
const RUN_ID = process.env.RUN_ID ?? String(Date.now());
const OUT = process.env.OUT ?? path.join(HERE, `result.${RUN_ID}.json`);
const INSTR_LOG = OUT.replace(/\.json$/, ".instr.log");

const mf = new Miniflare({
  log: new Log(process.env.VERBOSE === "1" ? LogLevel.DEBUG : LogLevel.WARN),
  modulesRoot: ROOT,
  modules: [{ type: "ESModule", path: path.join(HERE, "worker/driver-do.mjs") }],
  compatibilityDate: "2026-06-01",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  unsafeEvalBinding: "UNSAFE_EVAL",
  unsafeUseModuleFallbackService: true,
  unsafeModuleFallbackService: moduleFallback,
  bindings: { DEV_PORT: "" },
  serviceBindings: { HOST: () => new Response("not found", { status: 404 }) },
  durableObjects: { RUNNER: "NpmChildRunner" },
  workerLoaders: { LOADER: {} },
});

function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT ${ms}ms: ${label}`)), ms))]);
}

const t0 = Date.now();
let outcome = { runId: RUN_ID, small: SMALL, startedAt: new Date().toISOString() };
let lastInstr = "";
const poller = setInterval(async () => {
  try {
    const r = await mf.dispatchFetch("http://do.local/instr");
    const txt = await r.text();
    if (txt && txt !== lastInstr) { lastInstr = txt; try { writeFileSync(INSTR_LOG, txt); } catch {} }
  } catch {}
}, 1000);

// DETACHED-install poll: start the install, then poll /install-status with SHORT
// requests. A single 90s+ dispatchFetch resets under CPU/registry contention and
// surfaces as a false "fetch failed"; short polls are resilient. Each poll is
// retried so a transient reset doesn't abort the whole run.
async function pollFetch(pathQ, ms = 8000) {
  return withTimeout(mf.dispatchFetch("http://do.local" + pathQ).then((r) => r.json()), ms, pathQ);
}
try {
  await mf.ready;
  const params = new URLSearchParams();
  if (SMALL) params.set("small", "1");
  if (process.env.MAXCONC) params.set("maxConc", process.env.MAXCONC);
  if (process.env.FETCH_TIMEOUT) params.set("fetchTimeout", process.env.FETCH_TIMEOUT);
  if (process.env.FETCH_RETRIES) params.set("fetchRetries", process.env.FETCH_RETRIES);
  const q = params.toString() ? "?" + params.toString() : "";
  let json = null;
  if (process.env.DETACHED === "1") {
    // DETACHED: start the install, poll /install-status with short requests.
    await withTimeout(mf.dispatchFetch("http://do.local/install-start" + q).then((r) => r.json()), 15000, "install-start");
    const deadline = Date.now() + TIMEOUT;
    let consecutiveErr = 0;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      let st;
      try { st = await pollFetch("/install-status", 8000); consecutiveErr = 0; }
      catch (e) { consecutiveErr++; if (consecutiveErr >= 20) throw new Error("status poll lost worker (" + consecutiveErr + "x): " + e.message); continue; }
      if (st.status === "done") { json = st.summary; break; }
      if (st.status === "error") { json = { ok: false, error: st.error, stack: st.stack }; break; }
    }
    if (!json) throw new Error(`TIMEOUT ${TIMEOUT}ms: install did not finish`);
  } else {
    // SYNCHRONOUS (default): hold ONE /install dispatchFetch open for the whole
    // install. This keeps the isolate's request context alive the entire time —
    // workerd cancels detached/background work when no request is in flight, so a
    // detached install gets the isolate evicted mid-run (intermittent crash). The
    // held request is the prior proven-stable pattern.
    const res = await withTimeout(mf.dispatchFetch("http://do.local/install" + q), TIMEOUT, "install");
    json = await res.json().catch(async () => ({ raw: await res.text() }));
  }
  const wall = Date.now() - t0;
  outcome = { ...outcome, result: "completed", status: 200, wall, ok: json.ok, ms: json.ms, instr: json.instr, installedCount: json.installed?.length, error: json.error };
  const i = json.instr || {};
  console.log(`\n=== RUN ${RUN_ID} ${SMALL ? "[SMALL]" : "[FULL]"} === ok=${json.ok} wall=${wall}ms installed=${json.installed?.length}`);
  console.log(`  http: reqDone=${i.http?.reqDone}/${i.http?.reqStart} inflightMax=${i.http?.inflightMax} err=${i.http?.reqErr} ended=${i.http?.ended} byEvent=${JSON.stringify(i.http?.byEvent)}`);
  console.log(`  phases:`, JSON.stringify(i.phases));
  if (json.error) console.log(`  ERROR: ${json.error}`);
} catch (e) {
  const wall = Date.now() - t0;
  outcome = { ...outcome, result: "harness-error", wall, error: String(e?.stack ?? e) };
  console.error(`\n=== RUN ${RUN_ID} HARNESS ERROR after ${wall}ms ===\n`, e?.stack ?? e);
} finally {
  clearInterval(poller);
  try {
    const r = await Promise.race([mf.dispatchFetch("http://do.local/instr").then(x => x.text()), new Promise((res) => setTimeout(() => res(null), 4000))]);
    if (r) { writeFileSync(INSTR_LOG, r); outcome.instrLogTail = r.split("\n").slice(-40).join("\n"); }
  } catch {}
  try { writeFileSync(OUT, JSON.stringify(outcome, null, 2)); console.log("[out] " + OUT); console.log("[instr] " + INSTR_LOG); } catch {}
  const disposed = await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  if (!disposed) console.error("(dispose timed out; forcing exit)");
  console.log(`\n--- LAST 40 INSTR LINES ---\n${outcome.instrLogTail || "(none)"}`);
  process.exit(outcome.ok ? 0 : 1);
}
