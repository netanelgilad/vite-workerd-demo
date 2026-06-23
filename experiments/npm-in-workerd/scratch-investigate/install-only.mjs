// Lean install-only repro harness for the INVESTIGATION.
// Spins up miniflare on the fork workerd, runs ONE /install against a SINGLE
// DO instance, captures the instrumented summary (phases / connections / mem),
// and exits. Designed to be run serially N times to characterize flakiness.
//
//   MINIFLARE_WORKERD_PATH=/Users/netanelg/Development/workerd-vfs.bin \
//     node install-only.mjs            # full vite tree
//   SMALL=1 ... node install-only.mjs  # tiny tree (lodash)
//
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFileSync, appendFileSync } from "node:fs";
import childProcess from "node:child_process";

// Intercept the workerd subprocess spawn so we can observe its EXACT exit
// code/signal (miniflare swallows it; a runtime death surfaces only as
// "fetch failed"). This tells SIGKILL(9)/SIGSEGV(11)/SIGABRT(6)/OOM apart.
const _spawn = childProcess.spawn.bind(childProcess);
childProcess.spawn = function (cmd, args, opts) {
  const child = _spawn(cmd, args, opts);
  if (typeof cmd === "string" && /workerd/.test(cmd)) {
    console.error(`[spawn] workerd pid=${child.pid}`);
    child.on("exit", (code, signal) => console.error(`[workerd-exit] pid=${child.pid} code=${code} signal=${signal}`));
    child.on("error", (e) => console.error(`[workerd-spawn-error] ${e.message}`));
  }
  return child;
};

import { Log, LogLevel, Miniflare } from "miniflare";
import { moduleFallback } from "../do-native-fs/host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const SMALL = process.env.SMALL === "1";
const TIMEOUT = Number(process.env.TIMEOUT ?? 600000);
const RUN_ID = process.env.RUN_ID ?? String(Date.now());
const OUT = process.env.OUT ?? path.join(HERE, `result.${RUN_ID}.json`);

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
  serviceBindings: { HOST: (req) => new Response("not found", { status: 404 }) },
  durableObjects: { RUNNER: "NpmChildRunner" },
  workerLoaders: { LOADER: {} },
  // Capture workerd's RAW stdout/stderr so a runtime crash (SIGSEGV / abort /
  // V8 fatal / OOM) is visible instead of being swallowed and surfacing only
  // as "fetch failed" on the host side.
  handleRuntimeStdio(stdout, stderr) {
    const tag = (p) => (l) => { for (const line of l.toString().split("\n")) if (line.trim()) console.error(`[workerd:${p}] ${line}`); };
    stdout.on("data", tag("out"));
    stderr.on("data", tag("err"));
  },
});

function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT ${ms}ms: ${label}`)), ms))]);
}

const t0 = Date.now();
let outcome = { runId: RUN_ID, small: SMALL, startedAt: new Date().toISOString() };
const INSTR_LOG = OUT.replace(/\.json$/, ".instr.log");
// Poll the DO's durable /tmp/instr.log so we capture progress even if the
// install HANGS or the isolate is SIGKILLed (the dispatchFetch never resolves).
let lastInstr = "";
const poller = setInterval(async () => {
  try {
    const r = await mf.dispatchFetch("http://do.local/instr");
    const txt = await r.text();
    if (txt && txt !== lastInstr) { lastInstr = txt; try { writeFileSync(INSTR_LOG, txt); } catch {} }
  } catch {}
}, 3000);
try {
  await mf.ready;
  const params = new URLSearchParams();
  if (SMALL) params.set("small", "1");
  if (process.env.MAXCONC) params.set("maxConc", process.env.MAXCONC);
  if (process.env.FETCH_TIMEOUT) params.set("fetchTimeout", process.env.FETCH_TIMEOUT);
  if (process.env.FETCH_RETRIES) params.set("fetchRetries", process.env.FETCH_RETRIES);
  const q = params.toString() ? "?" + params.toString() : "";
  const res = await withTimeout(mf.dispatchFetch("http://do.local/install" + q), TIMEOUT, "install");
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  const wall = Date.now() - t0;
  outcome = { ...outcome, result: "completed", status: res.status, wall, ok: json.ok, ms: json.ms, instr: json.instr, installedCount: json.installed?.length, error: json.error };
  // console-summary
  const i = json.instr || {};
  console.log(`\n=== RUN ${RUN_ID} ${SMALL ? "[SMALL]" : "[FULL]"} === status=${res.status} ok=${json.ok} wall=${wall}ms installed=${json.installed?.length}`);
  console.log(`  http: req=${i.http?.reqDone}/${i.http?.reqStart} inflightMax=${i.http?.inflightMax}`);
  console.log(`  phases:`, JSON.stringify(i.phases));
  if (i.mem?.length) { const last = i.mem[i.mem.length - 1]; console.log(`  mem(last): rss=${Math.round(last.rss/1e6)}M heap=${Math.round(last.heapUsed/1e6)}M ext=${Math.round(last.external/1e6)}M`); }
  if (json.error) console.log(`  ERROR: ${json.error}`);
} catch (e) {
  const wall = Date.now() - t0;
  outcome = { ...outcome, result: "harness-error", wall, error: String(e?.stack ?? e) };
  console.error(`\n=== RUN ${RUN_ID} HARNESS ERROR after ${wall}ms ===\n`, e?.stack ?? e);
} finally {
  clearInterval(poller);
  // final scrape of the durable instr log
  try {
    const r = await Promise.race([mf.dispatchFetch("http://do.local/instr").then(x => x.text()), new Promise((res) => setTimeout(() => res(null), 4000))]);
    if (r) { writeFileSync(INSTR_LOG, r); outcome.instrLogTail = r.split("\n").slice(-25).join("\n"); }
  } catch {}
  try { writeFileSync(OUT, JSON.stringify(outcome, null, 2)); console.log("[out] " + OUT); console.log("[instr] " + INSTR_LOG); } catch {}
  const disposed = await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  if (!disposed) console.error("(dispose timed out; forcing exit)");
  process.exit(outcome.ok ? 0 : 1);
}
