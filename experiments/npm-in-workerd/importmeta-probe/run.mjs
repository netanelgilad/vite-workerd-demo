// FAST probe (no npm install): write an ESM module to the DO's /tmp, then import
// it in a VFS child and read back import.meta.url + fileURLToPath + new URL(rel) +
// createRequire(import.meta.url). Validates the workerd loader fix (legacy-registry
// import.meta initializer) end to end -- without it, import.meta.url is undefined.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Log, LogLevel, Miniflare } from "miniflare";
import { moduleFallback } from "../do-native-fs/host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const mf = new Miniflare({
  log: new Log(process.env.VERBOSE === "1" ? LogLevel.DEBUG : LogLevel.WARN),
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
const res = await mf.dispatchFetch("http://do.local/probe");
console.log(JSON.stringify(await res.json(), null, 2));
await mf.dispose();
