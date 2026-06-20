// Drive the DO over SEPARATE dispatchFetch calls: seed -> install -> ls.
// Each call is its own request; if node_modules shows up in /ls it proves both
// (a) the DO's /tmp persists across requests and (b) npm wrote it via native fs.
import { createHarness } from "./host-do.mjs";

const pkg = process.argv[2] ?? "left-pad@1.3.0";
const verbose = process.env.VERBOSE === "1";
const { mf, stats } = await createHarness({ verboseLog: verbose });

async function call(pathAndQuery, label) {
  const t0 = Date.now();
  const res = await mf.dispatchFetch("http://do.local" + pathAndQuery);
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  console.log(`\n=== ${label} === HTTP ${res.status} | wall ${Date.now() - t0}ms`);
  console.log(JSON.stringify(json, null, 2));
  return { status: res.status, json };
}

console.log(`# Native-fs-in-DO npm install test for: ${pkg}`);

// 1) seed in one request
await call("/seed?pkg=" + encodeURIComponent(pkg), "SEED (write package.json via native fs)");
// 2) install in a SEPARATE request — must find the seeded package.json
const inst = await call("/install", "INSTALL (Arborist reify into native /tmp)");
// 3) ls in a SEPARATE request — must find node_modules written by the prior request
await call("/ls", "LS (list node_modules — proves cross-request persistence)");

console.log("\nfallback stats:", JSON.stringify(stats()));

const ok = inst.status === 200 && inst.json?.ok && (inst.json.installed?.length > 0);
console.log("\nVERDICT:", ok ? "PASS — native fs in DO installed packages" : "FAIL");
await mf.dispose();
process.exit(ok ? 0 : 1);
