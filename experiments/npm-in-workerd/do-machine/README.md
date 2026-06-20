# do-machine — a real Vite/Rolldown toolchain running from a DO's shared `/tmp` in child isolates

This is the "DO as a JS machine" climax: a Durable Object installs npm packages into its
own native, writable `/tmp`, then loads **Worker-Loader child isolates** that resolve AND
**execute** that code from the shared `/tmp` via the workerd fork's VFS module fallback
(`shareParentTmp:true` + `vfsModuleFallback:true`). No RPC, no socket, no extra thread —
the VFS is in-memory and synchronous on the parent's thread.

## Run it

```bash
# Fork binary built from /Users/netanelg/Development/workerd @ feat/vfs-module-loading
MINIFLARE_WORKERD_PATH=/tmp/workerd-vfsmod-bin \
  node experiments/npm-in-workerd/do-machine/run.mjs
```

Flow (one miniflare process; the DO's `/tmp` persists across the dispatches):
1. `/install` — Arborist installs vite@8 + react@19 + @vitejs/plugin-react + tailwind/postcss into `/tmp/proj` (~90s, real registry).
2. `/overlay-rolldown` — replaces npm's native rolldown (.node binding) with the single-threaded WASM fork from `harness/rolldown-shim` + its patched emnapi/napi runtime deps, drops `rolldown.wasm` (12.5 MB) into `/tmp`, and rebinds every `rolldown-binding.wasi.cjs` reference to the browser binding.
3. `/overlay-esbuild` — replaces native esbuild with esbuild-wasm + the harness shim.
4. `/scaffold-app` — writes the ToDo app source into `/tmp/proj` (the vite build root).
5. `/transform` — POST-INSTALL TRANSFORM PASS over `/tmp` (`transform-tmp.mjs`): bakes `import.meta.url/dirname/filename`, routes `WebAssembly.Module/compile` + `eval`/`new Function` + `createRequire().resolve` through UnsafeEval helpers — mirrors `harness/host.mjs`'s `rewriteSource`, applied on disk instead of via a host fallback.
6. `/run-rolldown` — **the proof**: a child boots the rolldown WASM fork and bundles real code from `/tmp`.
7. `/run-vite-build` — vite build of the ToDo app (in progress; see Rung 3-full below).

## Highest rung reached: RUNG 3 (rolldown WASM bundle from /tmp) + most of RUNG 3-full (vite build)

`/run-rolldown` output (real):
```
"rolldownImport": "OK ... version=1.0.3"
"build": "OK chunks=1 firstLen=81"
"firstCodeHead": "//#region in.js\nconst x = 42;\nglobalThis.__rd_x = 42;\n//#endregion\nexport { x };"
```
A Worker-Loader child boots rolldown's single-threaded WASM bundler entirely from the
shared `/tmp` and emits correct bundled JS. This transitively proves rungs 1 & 2: node:
builtins, the implicit UnsafeEval binding (wasm compile), and the shared-`/tmp`
module-eval fallback (emnapi/napi glue + 12.5 MB wasm bytes read at module-eval time) all
work in the child.

Before the rolldown overlay, `/run-child` (now folded in) showed vite@8's **entire JS
module graph** loading AND evaluating from `/tmp` — including `vite/dist/node/chunks/logger.js`
doing `readFileSync(new URL("../../package.json", import.meta.url))` at module-eval time —
stopping only at rolldown's native `.node` binding, which the overlay then replaces.

`/run-vite-build` drives `vite.build()`: vite@8 loads, plugin-react loads, rolldown's WASM
resolver runs against `/tmp` (real wasm stack frames), and fails only at the
**WASI-vs-native-fs missing-file semantics** boundary (see below).

## workerd fork changes (committed to `feat/vfs-module-loading`, pushed)

1. **Implicit UnsafeEval for VFS children** (`server.c++` `compileBindings`). Real bundlers
   compile WebAssembly and generate code at runtime, forbidden outside the UnsafeEval
   binding. UnsafeEval is a native jsg type and is NOT RPC-serializable, so it can't be
   passed through a child's `env` (DataCloneError). When `vfsModuleFallback` is set, the
   fork injects an `UNSAFE_EVAL` global onto the child's env object directly (same opt-in /
   trust boundary as the VFS loader).

2. **Shared-`/tmp` module-eval fallback** (`worker-fs.{h,c++}` + `server.c++`). workerd
   evaluates dynamically-imported modules with NO IoContext on the stack ("Disallowed
   operation within global scope"), so npm packages doing `fs.readFileSync(...)` at
   module-eval time saw an empty `/tmp` (e.g. vite's logger.js reading vite/package.json).
   Added a thread-local module-eval fallback `/tmp` directory: when there's no IoContext,
   the in-memory fs uses the shared `/tmp` the VFS child captured at isolate setup, ahead
   of the private bootstrap stack scope. The parent DO is unaffected (its fs always runs
   with an IoContext, checked first); shareParentTmp guarantees it's the same directory.

3. **Drop bundler-only `module`/`module-sync` exports conditions** (`vfs-module-fallback.c++`).
   These are bundler-targeted and point at `*.js` ESM-bundler output that mixes
   import/export with require()/exports., which our `.js` classifier mis-detects as CJS
   ("Cannot use import statement outside a module" while booting rolldown's emnapi/napi
   deps). Matching Node + the harness's enhanced-resolve config (`["node","import","default"]`)
   makes those packages resolve via their unambiguous `"import": "*.mjs"` entry.

## Remaining blocker for RUNG 3-full (vite build) and onward

The rolldown WASM resolver walks directories statting `package.json`. The WASI shim
(`@napi-rs/wasm-runtime` + `@tybys/wasm-util`) over **native** `node:fs` maps a MISSING
file to an empty read (→ `JSONError "File is empty"`) instead of `ENOENT`. The harness
avoids this by backing rolldown's WASI fs with **memfs**, which returns `ENOENT` at the fd
level. Wrapping `readFileSync`/`statSync` to throw `ENOENT` is insufficient because WASI
goes through low-level fd ops (`path_open`/`fd_read`). The fix is to either (a) back the
child's `__ROLLDOWN_FS` with a memfs populated from `/tmp` (as the harness does), or (b)
wrap the low-level WASI fs ops so missing paths surface `ENOENT`. Until then vite build
stops at entry resolution. Rungs 4 (dev server) and 5 (browser ToDo) build on a working
build/transform, so they inherit this blocker.

## Files

- `run.mjs` — host harness (miniflare + workerd fork): module fallback for the DO's own
  npm engine, HOST service serving the rolldown/esbuild overlays + app source + wasm bytes.
- `worker/driver-do.mjs` — the Durable Object: install / overlay / scaffold / transform ops
  and the Worker-Loader child probes (rolldown bundle, vite build).
- `transform-tmp.mjs` — the post-install workerd-ready transform pass over `/tmp`.

Reused (unmodified): `../do-native-fs/host-do.mjs` (DO npm engine module fallback),
`../../../harness/rolldown-shim` + `worker/rolldown.wasm` + `shims/esbuild.mjs` (the proven
single-threaded WASM bundler fork), `../../../app-todo` (the demo app).
