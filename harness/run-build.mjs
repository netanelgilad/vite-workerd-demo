// Real vite build — but running inside workerd. Writes the bundle to <app>/dist
// on disk, exactly where `vite build` would put it.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createHarness } from "./host.mjs";

const APP_DIR = process.env.SPIKE_APP_DIR ?? "../app";
const OUT_DIR = path.resolve(APP_DIR, "dist");

const { mf, stats } = await createHarness();
const t0 = Date.now();
const res = await mf.dispatchFetch("http://localhost/build");
const json = await res.json().catch(async () => ({ raw: await res.text() }));
if (!json.ok) {
  console.error("build failed:", JSON.stringify(json, null, 2).slice(0, 4000));
  await mf.dispose();
  process.exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });
let bytes = 0;
for (const [f, b64] of Object.entries(json.dist)) {
  const p = path.join(OUT_DIR, f);
  mkdirSync(path.dirname(p), { recursive: true });
  const buf = Buffer.from(b64, "base64");
  writeFileSync(p, buf);
  bytes += buf.length;
}

console.log(`vite v${json.viteVersion} build (inside workerd) → ${OUT_DIR}`);
for (const f of Object.keys(json.dist).sort()) console.log("  dist/" + f);
console.log(`\n✓ ${Object.keys(json.dist).length} files, ${(bytes / 1024).toFixed(1)} kB | build ${json.ms}ms | total ${Date.now() - t0}ms`);
console.log("fallback stats:", JSON.stringify(stats()));
await mf.dispose();
