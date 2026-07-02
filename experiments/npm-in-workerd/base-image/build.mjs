// BASE IMAGE BUILD ("the Dockerfile"): assemble a workerd-ready rootfs containing npm and
// run it through a one-time bake so the CHILD's C++ vfsModuleFallback (which reads files
// as-is, no rewrites) can load it. Output: a staging rootfs + a base-image.tar.gz artifact.
//
//   node base-image/build.mjs
//
// Layout produced:
//   usr/lib/node_modules/npm/      seed npm 11 (+ bundled deps), baked
//   usr/lib/workerd-shims/         process / @npmcli/agent shims (still-baked redirects)
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
// Shrinking toward vanilla npm: v8 (heap_size_limit), the pacote async-tar-write bug,
// child_process (native spawn = sub-isolate, fork commits b5ec2a0/b20ee30), and
// require.resolve (native CJS resolution — relative/absolute/bare via the VFS node_modules
// walk + package.json main, plus createRequire(...).resolve) are now fork primitives, so
// those bakes are GONE. Each remaining redirect = a named fork gap, re-verified empirically
// on the fork binary (delete the bake, rebake, run all flows):
//
// - process: CJS `require('node:process')` from a VFS module throws
//   `No such module "node:process".` (first hit: npm-install-checks/lib/current-env.js:1,
//   killing every npm install). The legacy registry's ESM resolveCallback special-cases
//   node:process -> node-internal:{public,legacy}_process (jsg/modules.c++), but the CJS
//   require path (api/commonjs.c++ CommonJsModuleContext::require) has no such redirect and
//   node:process is not a registered builtin -> resolve fails. Fork follow-up: mirror the
//   redirect in the CJS require path. (The bake's original motivation was a HOST-fallback
//   CJS-loader segfault; that's gone — this resolution gap is what remains.)
//
// - @npmcli/agent: every registry request dies with
//   `TypeError: Protocol "https:" not supported. Expected "http:"` (ERR_INVALID_PROTOCOL
//   at node-internal:internal_http_client, via node:https:26 <- minipass-fetch <-
//   make-fetch-happen). Root cause (probe-verified): workerd's internal_http_agent.ts
//   declares `protocol` as a TS CLASS FIELD, so the constructor installs an OWN data
//   property `protocol: 'http:'` on every Agent instance ([[Define]] semantics). That own
//   property shadows agent-base's prototype get/set protocol pair — in real Node the
//   constructor's `this.protocol = ...` is a [[Set]] that agent-base's setter deliberately
//   swallows (this[INTERNAL] is still undefined during super()), keeping its stack-sniffing
//   getter live. Under workerd `agent.protocol` is therefore always 'http:', and
//   ClientRequest trusts agent.protocol over the https default -> throws. Fork follow-up:
//   drop the class-field declarations for protocol/defaultPort in internal_http_agent.ts
//   (assign via [[Set]] like Node) so subclass accessors intercept.
const REDIRECTS = [
  ["node:process", `${SHIM}/process.cjs`], ["process", `${SHIM}/process.cjs`],
  ["@npmcli/agent", `${SHIM}/npmcli-agent.cjs`],
];
const importSite = (spec) =>
  new RegExp(String.raw`(\bfrom\s*|\bimport\s*\(\s*|\b__require\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])${spec.replace(/[/\\]/g, "\\$&")}\2`, "gm");

function bake(src) {
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
        writeFileSync(d, bake(readFileSync(s, "utf8")));
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

// Ship only the shims a REDIRECT actually points at (do-native-fs keeps the full set for
// its own experiment; the image carries no vestigial files).
mkdirSync(SHIMS_DEST, { recursive: true });
const shimFiles = new Set(REDIRECTS.map(([, target]) => path.posix.basename(target)));
for (const f of shimFiles) cpSync(path.join(SHIMS_SRC, f), path.join(SHIMS_DEST, f));

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
