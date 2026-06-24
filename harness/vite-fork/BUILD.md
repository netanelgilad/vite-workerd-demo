# Rebuilding `@netanelgilad/vite` (the workerd-ready Vite fork)

`@netanelgilad/vite@8.0.16-workerd.0` is **build output** — it's published on npm and the
unpacked copy under `packages/vite/` is just `npm pack` output (re-fetchable with
`npm pack @netanelgilad/vite@8.0.16-workerd.0`). This file documents how that artifact is
*produced* from upstream, so the fork is reproducible from committed source (the npm tarball
is the durable artifact; this is the recipe).

Companion to [`../rolldown-fork/BUILD.md`](../rolldown-fork/BUILD.md) (the Rust/wasm half).
`@netanelgilad/vite` depends on `@netanelgilad/rolldown` via an npm alias, so build/publish
rolldown first.

## Base

Upstream **Vite 8.0.16** — i.e. the Rolldown-powered Vite (`rolldown-vite`), which already
bundles its dev/build engine via Rolldown. Vite 8 runs the dep optimizer through esbuild and
the bundler through Rolldown; both need workerd accommodations below.

## What changes (4 steps), and where each lives in this repo

All the transformation *logic* is committed — this doc just sequences it.

### 1. Repin the `rolldown` dependency onto the fork
`package.json`:
```jsonc
"dependencies": { "rolldown": "npm:@netanelgilad/rolldown@1.0.3-workerd.0" }
```
So a consumer `npm install @netanelgilad/vite` transitively pulls the single-threaded
Rolldown wasm fork (see `../rolldown-fork/BUILD.md`).

### 2. Bundle the esbuild → workerd-shim
Native esbuild ships a Go binary and spawns a process/worker thread — neither works in a
workerd isolate. Replace it with a single-threaded `esbuild-wasm` shim:

- **Shim source (committed):** [`../../experiments/npm-in-workerd/do-machine-clean/worker/esbuild-shim-native.mjs`](../../experiments/npm-in-workerd/do-machine-clean/worker/esbuild-shim-native.mjs)
  — runs `esbuild-wasm` with `worker:false` on a precompiled WASM module via the host
  `UnsafeEval` binding, backed by the child's native `node:fs` (the shared `/tmp`). It reads
  its own bundled `esbuild.wasm` via `import.meta.url` (populated by the workerd VFS loader's
  `file://` support — see the workerd fork's `vfs-module-fallback.c++`).
- Install it into the package as `node_modules/esbuild-wasm/esm/workerd-shim.mjs`, add
  `esbuild-wasm` (incl. `esbuild.wasm`) to `bundleDependencies`, and rewrite Vite's
  `import("esbuild")` in `dist/` to resolve to that shim.

### 3. Bake the code-gen rewrites into `dist/`
workerd forbids runtime code generation outside the `UnsafeEval` binding, and its `require`
has no `.resolve`. The canonical rewrite list is
[`../../experiments/npm-in-workerd/do-machine/transform-tmp.mjs`](../../experiments/npm-in-workerd/do-machine/transform-tmp.mjs)
(`rewriteSource`, mirrored from `experiments/npm-in-workerd/host.mjs`). Apply to the built
`dist/` (the published package ships these pre-baked):

| from | to |
|------|----|
| `new Function(` | `globalThis.__newFunction(` |
| `(0,eval)` / `(0, eval)` | `(globalThis.__safeEval)` |
| `new WebAssembly.Module(` | `globalThis.__UNSAFE_EVAL.newWasmModule(` |
| `WebAssembly.compile(` | `globalThis.__wasmCompile(` |
| `createRequire(x).resolve(` | `globalThis.__requireResolve(x, ` |

The consumer installs these contract globals before importing vite (see the `installGlobals`
+ WASM-patch prelude in `experiments/npm-in-workerd/workerd-bash/worker/vite-realbin-probe.mjs`).

**NOT baked anymore:** `import.meta.url` / `import.meta.dirname` and the per-file path
rewrites that `transform-tmp.mjs` also does. Those were needed by the earlier *transform-pass*
approach (`do-machine`); the published package relies instead on the workerd fork supplying a
correct `import.meta.url` natively for VFS modules (the `file://` resolver fix). So the dist's
baked set is exactly steps 2–3's code-gen rewrites — confirmed by:
`grep -roE '__newFunction|__safeEval|__wasmCompile|workerd-shim' packages/vite/dist`.

### 4. Version, pack, publish
Bump to a `-workerd.N` prerelease suffix (avoids colliding with upstream version space), set
`publishConfig.access = "public"`, keep `LICENSE.md` / `NOTICE.md`, then publish **after**
rolldown (see [`../../packages/PUBLISH.md`](../../packages/PUBLISH.md)).

## Why `packages/` isn't committed
It's regenerable build output and the working artifact is durably on npm. The `.tgz` and the
12–13 MB `.wasm` blobs are gitignored / skipped to avoid bloating the repo. To recover the
exact dist: `npm pack @netanelgilad/vite@8.0.16-workerd.0` (and likewise for rolldown).
