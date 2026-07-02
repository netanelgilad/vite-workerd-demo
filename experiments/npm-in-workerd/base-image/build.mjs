// BASE IMAGE BUILD ("the Dockerfile"): assemble a workerd-ready rootfs containing npm.
// Output: a staging rootfs + a base-image.tar.gz artifact.
//
//   node base-image/build.mjs
//
// Layout produced:
//   usr/lib/node_modules/npm/      seed npm 11 (+ bundled deps), copied VERBATIM
//   usr/bin/npm, usr/bin/npx       launchers (import the absolute bin from the VFS)
//   etc/npmrc                      registry / cache / ignore-scripts defaults
//
// ZERO build-time rewrites, ZERO shims. Every gap that once required a bake or a shim is
// now a native workerd-fork primitive, so the CHILD's C++ vfsModuleFallback reads npm's
// sources exactly as published:
//   - v8 heap_size_limit          native
//   - pacote async tar-write      native
//   - child_process spawn         native (spawn = sub-isolate)
//   - require.resolve             native CJS resolution (relative/absolute/bare walk + main,
//                                 plus createRequire(...).resolve)
//   - import.meta.url             supplied natively for VFS modules
//   - process (ESM + CJS require) node:process / process resolve to node-internal process
//                                 on both the ESM and the CJS require path
//   - @npmcli/agent protocol      workerd's http.Agent no longer stamps own protocol/
//                                 defaultPort data props, so agent-base's prototype getters
//                                 intercept and HTTPS registry requests work
// The image is therefore vanilla npm, copied byte-for-byte. No specifier redirects, no
// shim files — the child loads it as-is.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NPM_SRC = path.join(HERE, "..", "node_modules", "npm");
const STAGING = path.join(HERE, ".staging");
const NPM_DEST = path.join(STAGING, "usr/lib/node_modules/npm");

// SPIKE (vfs-root-mount): workerd's VFS is now writable-rooted at "/", so the rootfs lives at the
// real FHS path /usr (the machine's writable disk). The launchers below reference npm by that
// absolute /usr path.

console.log("# building base image (workerd-ready rootfs with npm)");
rmSync(STAGING, { recursive: true, force: true });
mkdirSync(NPM_DEST, { recursive: true });
console.log("  copying npm (verbatim) ->", path.relative(HERE, NPM_DEST));
cpSync(NPM_SRC, NPM_DEST, { recursive: true });

// /usr/bin launchers: import the real bin from the VFS by absolute path (the launcher's own
// location is irrelevant; the real bin's relative requires resolve from /usr/lib/...).
mkdirSync(path.join(STAGING, "usr/bin"), { recursive: true });
writeFileSync(path.join(STAGING, "usr/bin/npm"), `require("/usr/lib/node_modules/npm/bin/npm-cli.js");\n`);
writeFileSync(path.join(STAGING, "usr/bin/npx"), `require("/usr/lib/node_modules/npm/bin/npx-cli.js");\n`);

mkdirSync(path.join(STAGING, "etc"), { recursive: true });
writeFileSync(path.join(STAGING, "etc/npmrc"),
  "cache=/root/.npm\nregistry=https://registry.npmjs.org/\nignore-scripts=true\naudit=false\nfund=false\nupdate-notifier=false\nlegacy-peer-deps=true\n");

let files = 0, bytes = 0;
(function count(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) count(p); else { files++; bytes += statSync(p).size; } } })(STAGING);

const TAR = path.join(HERE, "base-image.tar.gz");
try { execSync(`tar czf ${JSON.stringify(TAR)} -C ${JSON.stringify(STAGING)} .`); } catch (e) { console.error("tar failed (staging still usable):", e.message); }
console.log(`  staged ${files} files (${(bytes / 1e6).toFixed(1)} MB) -> ${path.relative(HERE, STAGING)}`);
console.log(`  artifact: ${path.relative(HERE, TAR)}`);
