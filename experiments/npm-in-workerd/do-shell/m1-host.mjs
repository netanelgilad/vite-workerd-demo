// MILESTONE 1 host: miniflare + fork binary + worker_loaders binding.
// Reuses the do-native-fs moduleFallback so the PARENT can resolve modules from
// disk; the probe tests whether the CHILD can use that same fallback.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Log, LogLevel, Miniflare } from "miniflare";

import { moduleFallback } from "../do-native-fs/host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function createM1Harness({ verbose = false } = {}) {
  const mf = new Miniflare({
    log: new Log(verbose ? LogLevel.DEBUG : LogLevel.INFO),
    modules: [{ type: "ESModule", path: "do-shell/worker/m1-child-probe.mjs" }],
    modulesRoot: ".",
    compatibilityDate: "2026-06-01",
    compatibilityFlags: ["nodejs_compat", "experimental"],
    unsafeEvalBinding: "UNSAFE_EVAL",
    unsafeUseModuleFallbackService: true,
    unsafeModuleFallbackService: moduleFallback,
    durableObjects: { PARENT: "Parent" },
    workerLoaders: { LOADER: {} },
  });
  return { mf };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const verbose = process.env.VERBOSE === "1";
  const fallback = process.argv.includes("--fallback");
  const { mf } = await createM1Harness({ verbose });
  const q = fallback ? "/probe?fallback=1" : "/probe";
  console.log("# Milestone 1: shared /tmp parent<->child via Worker Loader" + (fallback ? " (+ child module fallback)" : ""));
  const res = await mf.dispatchFetch("http://do.local" + q);
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  console.log("HTTP", res.status);
  console.log(JSON.stringify(json, null, 2));
  await mf.dispose();
}
