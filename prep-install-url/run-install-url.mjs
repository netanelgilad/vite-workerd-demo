// Prove `npm install` from a LOCAL HTTP URL inside the in-DO npm engine.
//
// 1. Stand up a tiny local HTTP server serving an npm tarball at
//    http://127.0.0.1:<port>/pkg.tgz  (the .tgz was produced with `npm pack`).
// 2. Seed package.json with a URL specifier:  dependencies: { thepkg: <that URL> }.
// 3. Run Arborist reify() inside the Durable Object over workerd's native node:fs.
// 4. ls /tmp/proj/node_modules — proving the package downloaded + extracted from
//    the local URL into the DO's persistent /tmp.
//
// Each DO call is a SEPARATE dispatchFetch, so a populated /ls also re-proves the
// DO's native /tmp persists across requests.
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createHarness } from "./host-do.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARBALL = path.join(HERE, "served-tarball", "pkg.tgz");
const PKG_NAME = process.argv[2] ?? "is-odd"; // logical dep name in package.json
const verbose = process.env.VERBOSE === "1";

// --- 1. local HTTP tarball server ---------------------------------------
const tgz = readFileSync(TARBALL);
let served = 0;
const server = createServer((req, res) => {
  if (req.url === "/pkg.tgz") {
    served++;
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": tgz.length });
    res.end(tgz);
  } else {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const TARBALL_URL = `http://127.0.0.1:${port}/pkg.tgz`;
console.log(`# Serving ${TARBALL} (${statSync(TARBALL).size} bytes) at ${TARBALL_URL}`);

// --- 2. boot the DO harness --------------------------------------------
const { mf, stats } = await createHarness({ verboseLog: verbose });

async function call(pathAndQuery, label) {
  const t0 = Date.now();
  const res = await mf.dispatchFetch("http://do.local" + pathAndQuery);
  const json = await res.json().catch(async () => ({ raw: await res.text() }));
  console.log(`\n=== ${label} === HTTP ${res.status} | wall ${Date.now() - t0}ms`);
  console.log(JSON.stringify(json, null, 2));
  return { status: res.status, json };
}

console.log(`\n# Install-from-local-URL test: dependency "${PKG_NAME}" => ${TARBALL_URL}`);

// clean any state left by a previous run on the singleton DO
await call("/reset", "RESET");
// 3) seed package.json with a URL specifier
await call(`/seed?name=${encodeURIComponent(PKG_NAME)}&url=${encodeURIComponent(TARBALL_URL)}`,
  "SEED (package.json dependency = local HTTP tarball URL)");
// 4) install — Arborist/pacote fetch the URL, extract over native fs
const inst = await call("/install", "INSTALL (Arborist reify — fetch + extract from local URL)");
// 5) ls — prove node_modules persisted across requests
const ls = await call("/ls", "LS (list node_modules in DO's persistent /tmp)");

console.log("\ntarball HTTP hits:", served, "| fallback stats:", JSON.stringify(stats()));

const installedRoot = inst.json?.installed ?? [];
const ok =
  inst.status === 200 &&
  inst.json?.ok &&
  installedRoot.includes(PKG_NAME) &&
  served >= 1 &&
  (ls.json?.tree ?? []).some((p) => p.includes("/" + PKG_NAME + "/"));
console.log("\nVERDICT:", ok
  ? `PASS — "${PKG_NAME}" installed from local HTTP URL into the DO's /tmp/node_modules`
  : "FAIL");

await mf.dispose();
server.close();
process.exit(ok ? 0 : 1);
