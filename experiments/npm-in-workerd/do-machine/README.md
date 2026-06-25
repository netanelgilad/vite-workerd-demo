# do-machine — a real Vite/Rolldown toolchain running from a DO's shared `/tmp` in child isolates

This is the "DO as a JS machine" climax: a Durable Object installs npm packages into its
own native, writable `/tmp`, then loads **Worker-Loader child isolates** that resolve AND
**execute** that code from the shared `/tmp` via the workerd fork's VFS module fallback
(`shareParentTmp:true` + `vfsModuleFallback:true`). No RPC, no socket, no extra thread —
the VFS is in-memory and synchronous on the parent's thread.

## Run it

```bash
# Fork binary built from a checkout of github.com/netanelgilad/workerd @ feat/vfs-module-loading.
# (Rebuild: `bazel build //src/workerd/server:workerd` then copy bazel-bin/.../workerd to
#  /tmp/workerd-vfsmod-bin.)

# RUNG 2 — vite BUILD of the ToDo app from /tmp in a child (writes real dist; process exits 0):
MINIFLARE_WORKERD_PATH=/tmp/workerd-vfsmod-bin \
  node experiments/npm-in-workerd/do-machine/run.mjs

# RUNG 3+4 — vite DEV server from /tmp in a child, on a real browser-reachable port:
DEV=1 PORT=5185 MINIFLARE_WORKERD_PATH=/tmp/workerd-vfsmod-bin \
  node experiments/npm-in-workerd/do-machine/run.mjs
# -> "vite dev server (running from /tmp in a DO child) is live: http://127.0.0.1:5185/"
# Open it in a browser; the ToDo app renders and works. The process stays up (Ctrl-C to stop).

# Quick native-fs capability probe (no install) — diagnoses the optimizer-commit fs ops:
FSCAPS=1 MINIFLARE_WORKERD_PATH=/tmp/workerd-vfsmod-bin \
  node experiments/npm-in-workerd/do-machine/run.mjs
```

Each `node run.mjs` is one miniflare process; the DO's `/tmp` (workerd's in-isolate fs,
shared into children via `shareParentTmp`) persists across the dispatches **within** the
process but NOT across process restarts, so every run re-installs (~90s).

Flow:
1. `/install` — Arborist installs vite@8 + react@19 + @vitejs/plugin-react + tailwind/postcss into `/tmp/proj` (~90s, real registry).
2. `/overlay-rolldown` — replaces npm's native rolldown (.node binding) with the single-threaded WASM fork from `harness/rolldown-shim` + its patched emnapi/napi runtime deps, drops `rolldown.wasm` (12.5 MB) into `/tmp`, and rebinds every `rolldown-binding.wasi.cjs` reference to the browser binding.
3. `/overlay-esbuild` — replaces native esbuild with esbuild-wasm + a **native-fs** shim (`worker/esbuild-shim-native.mjs`: reads the wasm from `/tmp/proj/esbuild.wasm` and resolves over native `/tmp`; the harness's `__HOST`/memfs shim does not apply in a do-machine child).
4. `/scaffold-app` — writes the ToDo app source into `/tmp/proj` (the vite root).
5. `/transform` — POST-INSTALL TRANSFORM PASS over `/tmp` (`transform-tmp.mjs`): bakes `import.meta.url/dirname/filename`, routes `WebAssembly.Module/compile` + `eval`/`new Function` + `createRequire().resolve` through UnsafeEval helpers. Also bakes `import.meta.*` in the app's **own** root configs (`postcss.config.js`, `tailwind.config.js`) — they live in `/tmp/proj` and are loaded in the WASI bundler context where workerd gives `import.meta.url === undefined`.
6. `/run-rolldown` — a child boots the rolldown WASM fork and bundles real code from `/tmp`.
7. `/run-vite-build` — **RUNG 2**: vite build of the ToDo app from `/tmp` in a child.
8. (DEV) `/scaffold-dev-probe` + `/dev-warmup` — **RUNG 3**: boot the persistent vite-dev child, drive the dep optimizer to a committed `.vite/deps`, then the DO proxies browser HTTP + the `/__hmr` WebSocket to the child's `fetch` over RPC.

## Highest rung reached: RUNG 4 — the ToDo app renders + works in a real browser

`/run-vite-build` (RUNG 2, real output):
```
"buildMs": 492,
"dist":   ["assets", "favicon.svg", "index.html"],
"assets": ["index-DrYyJoa5.js", "index-Dor6Z3g0.css"],   // hashed JS + tailwind-compiled CSS
"indexHtmlHead": "<!doctype html>\n<html lang=\"en\">..."
```

`/dev-warmup` (RUNG 3, real output): deps prebundled + committed to disk:
```
"depStatuses": { ".../deps/react.js": 200, ".../react-dom_client.js": 200, ".../react_jsx-dev-runtime.js": 200 }
# /tmp/proj/node_modules/.vite/deps now holds react.js, react-dom_client.js, _metadata.json, ...
```

**RUNG 4 — Playwright against `http://127.0.0.1:5185/`** (screenshots in `proof/`, zero console errors):
```
STEP1_INITIAL   {"title":"ToDo — Vite in workerd","h1":"ToDo","remaining":"0 items left","h1Color":"rgb(29, 79, 196)"}  # tailwind brand-700 applied
STEP2_ADDED     {"items":["Buy milk","Write report"],"remaining":"2 items left"}
STEP3_TOGGLED   {"completedAttrs":["true","false"],"remaining":"1 item left"}
STEP4_FILTER_COMPLETED {"visible":["Buy milk"]}
STEP5_FILTER_ACTIVE    {"visible":["Write report"]}
STEP6_DELETED   {"items":["Buy milk"],"remaining":"0 items left"}
CONSOLE_ERRORS  []
```
A working ToDo app — add / toggle / filter / delete — served by Vite running from `/tmp`
in a sub-isolate of the DO, rendered and driven in a real Chromium.

## workerd fork changes (committed to `feat/vfs-module-loading`, pushed)

Pre-existing (earlier agents):
1. **Implicit UnsafeEval for VFS children** (`server.c++`) — children get an `UNSAFE_EVAL` global (wasm compile / codegen) since the native jsg type can't ride through `env`.
2. **Shared-`/tmp` module-eval fallback** (`worker-fs.{h,c++}` + `server.c++`) — module-eval-time `fs.readFileSync` (no IoContext on stack) sees the shared `/tmp`.
3. **Drop bundler-only `module`/`module-sync` exports conditions** (`vfs-module-fallback.c++`).

Added this track (to climb rungs 2→4):
4. **Classify Babel/TS-transpiled CJS correctly** (`vfs-module-fallback.c++` `classify`). The `.js` ESM-vs-CJS heuristic flipped `Object.defineProperty(exports,"__esModule")` CJS to ESM whenever the source merely *contained* `"import "` — which `@import url(…)` in a comment satisfies (tailwindcss/lib/lib/collapseAdjacentRules.js). It loaded as ESM → "exports is not defined". Added the transpiled-CJS markers (`__esModule`, `Object.defineProperty(exports`) as CJS signals.
5. **Statement-position ESM detection, with CJS self-declaration winning first** (`vfs-module-fallback.c++`). `hasToplevelEsmStatement()` detects a real line-leading `export`/`import` statement (cannot occur in CJS), so bundled `esm/` builds that also touch `exports.` in helper code (esbuild-wasm/esm/browser.js) classify as ESM. But a file that *self-declares* CJS (`module.exports`/`__esModule`/`Object.defineProperty(exports`) wins first — sucrase/dist/HelperManager.js is CJS yet stores ESM helper snippets in template literals (a line-leading `import {createRequire} from "module"` inside backticks), which the raw scan would otherwise mis-read.
6. **`fs` directory `renameSync` + `rm` `force`** (`filesystem.c++`). (a) The directory rename case shadowed the destination-parent `dir` with the source node, so `dir->add(name, dir.addRef())` added the source dir into *itself*, then removed it — a dir rename silently dropped all contents. This made vite's optimizer commit (`renameSync(deps_temp → .vite/deps)`) produce an **empty** deps dir, so every prebundled-dep request 504'd and the app never loaded. (b) `rm` ignored `force`, so `rm(missing,{force:true})` (used all over vite's optimizer) threw ENOENT. Both fixed; verified by the `/fs-caps` probe.

## do-machine JS fixes (this track)

- **WASI ENOENT over native fs** (`makeEnoentFs` in `worker/driver-do.mjs` + `worker/vite-dev-probe.mjs`). workerd's native `openSync(missing, O_RDONLY)` returns a valid fd (then `fd_read` → 0 bytes) instead of throwing ENOENT, so rolldown's oxc_resolver read a missing `package.json` as `""` → `JSONError "File is empty"` while walking dirs. The proxy makes read-only `openSync`/`readFileSync`/`statSync`/`lstatSync` of a non-existent path throw `{code:'ENOENT'}`, which the `@tybys` WASI shim's `handleError` maps to `WasiErrno.ENOENT`. (Skips `O_CREAT` so genuine writes work. The "purer" (a) fix from the brief — keeps bundler I/O on the real native `/tmp`.)
- **Native esbuild shim** (`worker/esbuild-shim-native.mjs`) for the dep optimizer's transform/scan in the child.
- **HMR over the right port**: the DO passes `DEV_PORT` to the dev child; the probe sets `hmr.clientPort` so the browser's HMR client dials the miniflare port, not vite's default 5173. The `/__hmr` WebSocket is proxied DO→child over a `WebSocketPair`-backed `HotChannel` (ported from `harness/worker/driver.mjs`).

## Files

- `run.mjs` — host harness (miniflare + workerd fork): module fallback for the DO's own npm engine; HOST service serving the rolldown/esbuild overlays, app source, wasm bytes, and the dev probe. `DEV=1` binds a real port and keeps the dev server up; `FSCAPS=1` runs only the fs-capability probe.
- `worker/driver-do.mjs` — the Durable Object: install / overlay / scaffold / transform ops, the Worker-Loader child probes (rolldown bundle, vite build), the dev-server warmup + browser-proxy catch-all, and the `/fs-caps` + `/dev-deps-state` diagnostics.
- `worker/vite-dev-probe.mjs` — the dev-server child: vite `createServer` (middleware mode) from `/tmp`, the WebSocketPair HMR transport, and the connect-middleware adapter.
- `worker/esbuild-shim-native.mjs` — native-fs esbuild-wasm shim for the dep optimizer.
- `transform-tmp.mjs` — the post-install workerd-ready transform pass over `/tmp`.
- `proof/` — Playwright screenshots of the working ToDo app (rung 4).

Reused (unmodified): `../do-native-fs/host-do.mjs` (DO npm engine module fallback),
`../../../harness/rolldown-shim` + `harness/worker/rolldown.wasm` + `harness/node_modules/esbuild-wasm`
(the proven single-threaded WASM toolchain), `../../../app-todo` (the demo app).

## Remaining notes / not-yet-done

- **RUNG 5** (full `npm run dev` end-to-end: scaffold → `npm install` the rolldown-fork "vite"
  into `/tmp` → `npm run dev` spawns the child) is not done. The current flow installs real
  `vite`/`rolldown` then *overlays* the single-threaded WASM rolldown + native esbuild shim;
  a true `npm run dev` would need the fork published (or a local tarball) as the installed
  `rolldown`/`esbuild`, plus a process spawner in the DO. Everything downstream of install
  (transform → build → dev → browser) is proven.
- The fs/classifier fixes are deliberately conservative but are heuristic (substring/scan,
  not a full JS lexer); pathological inputs could still mis-classify. No upstream PRs filed.
