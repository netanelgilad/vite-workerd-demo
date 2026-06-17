// Proof check: build the app on host Node AND inside workerd, then byte-compare
// the two dist trees. Self-contained — it produces its own host baseline (in a
// temp dir) so it never depends on or collides with `npm run build`.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { createHarness } from "./host.mjs";

const APP_DIR = path.resolve(process.env.SPIKE_APP_DIR ?? "../app");
const hostDir = path.resolve("baseline-dist");
const workerdDir = path.resolve("workerd-dist");

// 1. host-Node baseline build into baseline-dist/
console.log("building on host Node →", hostDir);
rmSync(hostDir, { recursive: true, force: true });
execFileSync("npx", ["vite", "build", "--outDir", hostDir, "--emptyOutDir"], { cwd: APP_DIR, stdio: "inherit" });

// 2. build inside workerd into workerd-dist/
console.log("\nbuilding inside workerd →", workerdDir);
const { mf } = await createHarness();
const json = await (await mf.dispatchFetch("http://localhost/build")).json();
if (!json.ok) { console.log(JSON.stringify(json, null, 2)); process.exit(1); }
rmSync(workerdDir, { recursive: true, force: true });
for (const [f, b64] of Object.entries(json.dist)) {
  const p = path.join(workerdDir, f);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, Buffer.from(b64, "base64"));
}

// 3. byte-compare
const walk = (d, base) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name))]);
const hostFiles = walk(hostDir, hostDir).sort();
const wdFiles = walk(workerdDir, workerdDir).sort();
console.log("\nhost files:", hostFiles.length, "| workerd files:", wdFiles.length);
let identical = 0, different = [];
for (const f of hostFiles) {
  try {
    if (readFileSync(path.join(hostDir, f)).equals(readFileSync(path.join(workerdDir, f)))) identical++;
    else different.push(f);
  } catch { different.push(f + " (missing)"); }
}
console.log("byte-identical:", identical, "/", hostFiles.length, different.length ? "| different: " + different.join(", ") : "");

// warm rebuild in the same isolate (steady state)
const t0 = Date.now();
const json2 = await (await mf.dispatchFetch("http://localhost/build")).json();
console.log("warm rebuild ok:", json2.ok, "| vite ms:", json2.ms, "| total ms:", Date.now() - t0);
await mf.dispose();
process.exit(identical === hostFiles.length && hostFiles.length === wdFiles.length ? 0 : 1);
