import { createHarness } from "./host.mjs";

const { mf, stats } = await createHarness();
const t0 = Date.now();
const res = await mf.dispatchFetch("http://localhost/build");
const json = await res.json().catch(async () => ({ raw: await res.text() }));
console.log("status:", res.status, "| total ms:", Date.now() - t0);
if (json.dist) {
  console.log("populate:", JSON.stringify(json.populate), "| vite:", json.viteVersion, "| build ms:", json.ms);
  for (const [f, b64] of Object.entries(json.dist)) console.log("  dist/" + f, Math.round(b64.length * 0.75), "bytes");
} else {
  console.log(JSON.stringify(json, null, 2).slice(0, 4000));
}
console.log("fallback stats:", JSON.stringify(stats()));
await mf.dispose();
