import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createHarness } from "./host.mjs";

const { mf } = await createHarness();
const json = await (await mf.dispatchFetch("http://localhost/build")).json();
if (!json.ok) { console.log(JSON.stringify(json, null, 2)); process.exit(1); }

const outDir = "workerd-dist";
rmSync(outDir, { recursive: true, force: true });
for (const [f, b64] of Object.entries(json.dist)) {
  const p = path.join(outDir, f);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, Buffer.from(b64, "base64"));
}

// byte-compare against the host-node build of the same app
const hostDir = path.join(process.env.SPIKE_APP_DIR ?? "../app", "dist");
const walk = (d, base) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name))]);
const hostFiles = walk(hostDir, hostDir).sort();
const wdFiles = walk(outDir, outDir).sort();
console.log("host files:", hostFiles.length, "| workerd files:", wdFiles.length);
let identical = 0, different = [];
for (const f of hostFiles) {
  try {
    if (readFileSync(path.join(hostDir, f)).equals(readFileSync(path.join(outDir, f)))) identical++;
    else different.push(f);
  } catch { different.push(f + " (missing)"); }
}
console.log("byte-identical:", identical, "/", hostFiles.length, different.length ? "| different: " + different.join(", ") : "");

const mem = await (await mf.dispatchFetch("http://localhost/mem")).json();
console.log("worker process.memoryUsage:", JSON.stringify(mem));

// second build in the same isolate (warm) to measure steady-state
const t0 = Date.now();
const json2 = await (await mf.dispatchFetch("http://localhost/build")).json();
console.log("warm rebuild ok:", json2.ok, "| vite ms:", json2.ms, "| total ms:", Date.now() - t0);
await mf.dispose();
