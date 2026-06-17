# Vite 8 + Tailwind, running inside workerd

This is a self-contained demo of running a **real Vite 8 (Rolldown) app's
`vite build` _and_ dev server entirely inside [workerd](https://github.com/cloudflare/workerd)** —
the open-source Cloudflare Workers runtime, self-hosted via
[miniflare](https://github.com/cloudflare/workers-sdk) — instead of on Node.

No Cloudflare account, no containers, no microVMs. A single V8 isolate is the
sandbox; the build toolchain (Vite, Rolldown, esbuild, PostCSS, Tailwind) runs
inside it over an in-heap filesystem.

The demo app (`app/`) is a realistic modern stack:
**Vite 8**, **Tailwind CSS v3** (PostCSS + autoprefixer, `@tailwind` directives
and `@apply`), **react-router 7** and **@tanstack/react-query 5**.

## Result

| What runs inside workerd | Outcome |
|---|---|
| `vite build` (Tailwind + router + query, ~90 modules) | ✅ **byte-identical** to the host-Node build of the same app — including the Tailwind-generated, autoprefixed, minified CSS |
| `vite` dev server (`createServer`, middleware mode) | ✅ every URL a browser requests returns 200: `index.html`, `/@vite/client`, TSX transforms, the Tailwind CSS transform, dep-optimizer prebundles |
| Rolldown bundling | ✅ single-threaded (forked wasm) — **0 worker-thread spawns** |

## Quick start

```bash
./setup.sh    # installs app + harness deps, patches Rolldown for single-threaded workerd

cd harness
npm run dev    # vite dev server INSIDE workerd → open http://localhost:5173 in a browser
npm run build  # vite build INSIDE workerd → writes ../app/dist
```

`npm run dev` and `npm run build` behave like ordinary `vite` / `vite build` —
the toolchain just runs inside the isolate instead of on Node. `dev` leaves
workerd listening on a real port; open it and use the app like any Vite dev
server (HMR client connects over `/__hmr`). Set `PORT=…` to change the port.

Two extra scripts prove the isolate output matches Node:

```bash
npm run verify:build  # builds on host AND in workerd, byte-compares the two dist trees
npm run verify:dev    # crawls the dev module graph and reports every response status
```

`setup.sh` is just `npm install` in `app/`, then `npm install` in `harness/`
(whose `postinstall` runs `patch-emnapi-wasi.mjs`).

## How it works

```
host Node process                          workerd isolate
─────────────────────────────             ────────────────────────────────────────
miniflare (workerd supervisor)
├─ module fallback service  ◀── every import workerd can't resolve
│   • Node/exports-map resolution           worker/driver.mjs (bundle module)
│   • aliases: esbuild→esbuild-wasm,        ├─ /build  → vite.build()
│     rollup→@rollup/wasm-node,             ├─ /dev/warmup → createServer + prebundle
│     rolldown→single-threaded fork         ├─ /preview/* → dev server fetch
│   • source rewrites (see below)           └─ module state (persists per isolate):
├─ HOST service binding                        • memfs volume = the project FS
│   • /manifest (app files + dep trees)        • vite dev server + module graph
│   • /esbuild.wasm                            • esbuild-wasm + rolldown wasm instances
└─ UnsafeEval binding
    (newWasmModule / eval / newFunction)
```

The **module fallback service** (`harness/host.mjs`) is the linchpin: workerd
asks the host for every specifier it can't resolve from the bundle. That makes
it the single interception point for **resolution** (real `node_modules` on
disk, plus aliases), **format** (ESM/CJS + `namedExports` via `cjs-module-lexer`),
and **source rewriting**.

### Why the app lives in an in-heap filesystem (memfs), not real files

workerd's `node:fs` VFS is **per-request** — writes vanish between requests and
module-evaluation code sees a different view than request handlers. So there is
no persistent real filesystem inside the isolate to point Vite at. The fix (the
WebContainers move): bring your own filesystem. The host reads the real,
npm-installed app from disk and ships it into an in-heap **memfs** volume inside
the isolate via the `/manifest` binding; module-level state (memfs, the Vite dev
server, the wasm instances) persists for the isolate's lifetime.

### Source rewrites applied by the fallback service

1. `import.meta.url/dirname/filename` → baked literals (workerd gives `undefined`).
2. `new WebAssembly.Module(` / `WebAssembly.compile(` → the `UnsafeEval` binding (runtime wasm compilation is otherwise forbidden).
3. `(0,eval)` / `new Function(` → `UnsafeEval`-backed helpers (code generation is disabled outside it).
4. fs import/require sites (incl. `__require("fs")` interop) → the in-heap memfs shim.
5. `createRequire(x).resolve(...)` and `pathToFileURL(...)?t=...` (PostCSS config loading) → worker-side helpers that resolve through the fallback service.
6. CJS modules get `__filename`/`__dirname` injected.

### The Vite 8 / Rolldown piece

Vite 8 bundles with Rolldown, whose wasm binding spawns WASI worker threads.
workerd has `SharedArrayBuffer`, shared `WebAssembly.Memory` and `Atomics` — but
`worker_threads.Worker` spawning is a stub. So this demo uses a **forked,
single-threaded Rolldown** (`harness/worker/rolldown.wasm` +
`harness/rolldown-shim/`, the patched `@rolldown/browser` loader). `patch-emnapi-wasi.mjs`
applies the JS-side companions (emnapi scheduler redirect, WASI clock/poll fixes
for workerd's frozen-during-sync-execution clock). Full writeup:
[`docs/rolldown-fork-findings.md`](docs/rolldown-fork-findings.md).

## Layout

```
app/                        the demo app (Vite 8 + Tailwind v3 + router + query)
harness/
  host.mjs                  miniflare host: module fallback service + manifest + rewrites
  worker/driver.mjs         the in-isolate driver (build / dev / preview routes)
  worker/rolldown.wasm      single-threaded Rolldown fork (12 MB)
  rolldown-shim/            patched @rolldown/browser loader (installed as node_modules/rolldown)
  shims/                    in-heap memfs fs / fs-promises, esbuild-wasm shim, bash
  patch-emnapi-wasi.mjs     reproducible JS-side patches for single-threaded workerd
  run-dev.mjs               `npm run dev`   — browser-accessible dev server on a real port
  run-build.mjs             `npm run build` — build, written to ../app/dist
  run-verify-build.mjs      `npm run verify:build` — host vs workerd byte-compare
  run-verify-dev.mjs        `npm run verify:dev`   — dev module-graph crawl
docs/rolldown-fork-findings.md
```

## Notes & limits

- **Memory**: workerd RSS is dominated by the wasm heaps (esbuild's Go runtime +
  Rolldown); it ratchets up across repeated builds since wasm memory can't
  shrink. For production the fix is isolate **recycling** at ms-spawn cost.
- **HMR transport**: the invalidation core works (edit → invalidate → fresh
  module); wiring Vite's `ws` HMR server to workerd's native `WebSocketPair` is
  mechanical and not included in this minimal demo.
- This started as a research spike; `byte-identical` is verified per machine via
  `npm run verify`.
