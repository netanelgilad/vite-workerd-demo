import path from "node:path";
import { Log, LogLevel, Miniflare } from "miniflare";
import { moduleFallback } from "../do-native-fs/host-do.mjs";
const mf = new Miniflare({
  log: new Log(LogLevel.WARN),
  modules: [{ type: "ESModule", path: "do-shell/worker/m1b-tmp-import.mjs" }],
  modulesRoot: ".",
  compatibilityDate: "2026-06-01",
  compatibilityFlags: ["nodejs_compat", "experimental"],
  unsafeEvalBinding: "UNSAFE_EVAL",
  unsafeUseModuleFallbackService: true,
  unsafeModuleFallbackService: moduleFallback,
  durableObjects: { PARENT: "Parent" },
  workerLoaders: { LOADER: {} },
});
for (const spec of ["/tmp/mod/hello.mjs", "/tmp/mod/hello.cjs"]) {
  const res = await mf.dispatchFetch("http://do.local/probe?spec=" + encodeURIComponent(spec));
  console.log(spec, "->", JSON.stringify(await res.json()));
}
await mf.dispose();
