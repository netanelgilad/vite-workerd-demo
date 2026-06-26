// BASE IMAGE BUILD ("the Dockerfile"): assemble a workerd-ready rootfs containing npm and
// run it through a one-time bake so the CHILD's C++ vfsModuleFallback (which reads files
// as-is, no rewrites) can load it. Output: a staging rootfs + a base-image.tar.gz artifact.
//
//   node base-image/build.mjs
//
// Layout produced:
//   usr/lib/node_modules/npm/      seed npm 11 (+ bundled deps), baked
//   usr/lib/workerd-shims/         v8 / process / child_process / @npmcli/agent shims
//   usr/bin/npm, usr/bin/npx       launchers (import the absolute bin from the VFS)
//   etc/npmrc                      registry / cache / ignore-scripts defaults
//
// The bake is the SAME class of edit as the published @netanelgilad/vite fork — applied
// here at image-build time, not per-boot. Each fix we promote into a workerd PRIMITIVE
// later lets us drop the corresponding shim/redirect from this bake.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NPM_SRC = path.join(HERE, "..", "node_modules", "npm");
const SHIMS_SRC = path.join(HERE, "..", "do-native-fs", "shims");
const STAGING = path.join(HERE, ".staging");
const NPM_DEST = path.join(STAGING, "usr/lib/node_modules/npm");
const SHIMS_DEST = path.join(STAGING, "usr/lib/workerd-shims");

// workerd's VFS is writable only under /tmp, so the rootfs lives at /tmp/usr (which is the
// machine's writable disk). Paths baked into npm must therefore be absolute /tmp/usr/... .
const SHIM = "/tmp/usr/lib/workerd-shims";
// Specifier redirects baked into npm so the child loader resolves workerd-ready builtins.
// (import.meta.url is NOT baked — the fork supplies it natively for VFS modules.)
// Shrinking toward vanilla npm: v8 (heap_size_limit) and the pacote async-tar-write bug are
// now fixed in the workerd fork (feat/vfs-module-loading: node:v8 getHeapStatistics +
// fs async write callbacks), so those bakes are GONE. Remaining redirects map to fork
// primitives not yet promoted: process (CJS-loader segfault), child_process (spawn→isolate
// bridge), @npmcli/agent (https keepalive).
const REDIRECTS = [
  ["node:process", `${SHIM}/process.cjs`], ["process", `${SHIM}/process.cjs`],
  ["node:child_process", `${SHIM}/child_process.cjs`], ["child_process", `${SHIM}/child_process.cjs`],
  ["@npmcli/agent", `${SHIM}/npmcli-agent.cjs`],
];
const importSite = (spec) =>
  new RegExp(String.raw`(\bfrom\s*|\bimport\s*\(\s*|\b__require\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])${spec.replace(/[/\\]/g, "\\$&")}\2`, "gm");

function bake(src, virtPath) {
  for (const [spec, target] of REDIRECTS) src = src.replace(importSite(spec), (m, lead, q) => `${lead}${q}${target}${q}`);
  return src;
}

function copyAndBake(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const e of readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, e.name);
    const d = path.join(destDir, e.name);
    if (e.isDirectory()) copyAndBake(s, d);
    else if (e.isFile()) {
      if (/\.(js|cjs|mjs)$/.test(e.name)) {
        const virt = "/tmp/usr/lib/node_modules/npm" + s.slice(NPM_SRC.length);
        writeFileSync(d, bake(readFileSync(s, "utf8"), virt));
      } else {
        cpSync(s, d);
      }
    }
  }
}

console.log("# building base image (workerd-ready rootfs with npm)");
rmSync(STAGING, { recursive: true, force: true });
mkdirSync(NPM_DEST, { recursive: true });
console.log("  baking npm ->", path.relative(HERE, NPM_DEST));
copyAndBake(NPM_SRC, NPM_DEST);

mkdirSync(SHIMS_DEST, { recursive: true });
for (const f of readdirSync(SHIMS_SRC)) cpSync(path.join(SHIMS_SRC, f), path.join(SHIMS_DEST, f));

// /usr/bin launchers: import the real bin from the VFS by absolute path (the launcher's own
// location is irrelevant; the real bin's relative requires resolve from /usr/lib/...).
mkdirSync(path.join(STAGING, "usr/bin"), { recursive: true });
writeFileSync(path.join(STAGING, "usr/bin/npm"), `require("/tmp/usr/lib/node_modules/npm/bin/npm-cli.js");\n`);
writeFileSync(path.join(STAGING, "usr/bin/npx"), `require("/tmp/usr/lib/node_modules/npm/bin/npx-cli.js");\n`);

mkdirSync(path.join(STAGING, "etc"), { recursive: true });
writeFileSync(path.join(STAGING, "etc/npmrc"),
  "cache=/tmp/npmcache\nregistry=https://registry.npmjs.org/\nignore-scripts=true\naudit=false\nfund=false\nupdate-notifier=false\nlegacy-peer-deps=true\n");

let files = 0, bytes = 0;
(function count(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) count(p); else { files++; bytes += statSync(p).size; } } })(STAGING);

const TAR = path.join(HERE, "base-image.tar.gz");
try { execSync(`tar czf ${JSON.stringify(TAR)} -C ${JSON.stringify(STAGING)} .`); } catch (e) { console.error("tar failed (staging still usable):", e.message); }
console.log(`  staged ${files} files (${(bytes / 1e6).toFixed(1)} MB) -> ${path.relative(HERE, STAGING)}`);
console.log(`  artifact: ${path.relative(HERE, TAR)}`);
