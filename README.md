# Vite + npm inside workerd

Running a modern web build toolchain — **Vite 8, Rolldown, esbuild, PostCSS,
Tailwind** — and **npm itself** inside a single V8 isolate
([workerd](https://github.com/cloudflare/workerd), Cloudflare's open-source
Workers runtime), with no Node, no container, and no microVM underneath.

The motivation is a concrete one. Vibe-coding platforms run a Vite dev server
per preview and a `vite build` per deploy, today inside sandboxes (containers /
microVMs). This repo explores collapsing that sandbox down to a **V8 isolate**:
the dev sandbox becomes a **Durable Object** and the build sandbox a stateless
request flow — `npm install`, `vite dev`, and `vite build` all executing inside
workerd over a virtual filesystem.

It is a research spike, built by forking and patching downstream until it ran,
then working backward to understand each patch. The result is in three layers,
each independently runnable and verifiable:

| Layer | What runs in workerd | Runtime needed | Where |
|---|---|---|---|
| **1. Vite in workerd** | `vite build` + `vite dev` of a real React/Tailwind app | **stock workerd** (via miniflare) | [`harness/`](harness/) |
| **2. npm in workerd** | real `@npmcli/arborist` install from the live registry | **stock workerd** | [`experiments/npm-in-workerd/`](experiments/npm-in-workerd/) |
| **3. The DO machine** | `npm install` → `vite build`/`dev` from `/tmp` in sub-isolates | **forked workerd** ([`feat/vfs-module-loading`](https://github.com/netanelgilad/workerd/tree/feat/vfs-module-loading)) | [`experiments/npm-in-workerd/do-machine-clean/`](experiments/npm-in-workerd/do-machine-clean/) |

Layers 1 and 2 run on **stock workerd** today — no custom binary. Layer 3 (the
end goal: a Durable Object that installs and serves a project entirely on its
own) needs two small C++ capabilities that don't exist upstream yet; they live
in [a workerd fork](https://github.com/netanelgilad/workerd/tree/feat/vfs-module-loading)
and are spelled out in [§ The forks](#the-forks).

---

## Contents

- [Quick start (Layer 1: Vite in workerd)](#quick-start-layer-1-vite-in-workerd)
- [What's actually verified](#whats-actually-verified)
- [How it works](#how-it-works)
  - [The module fallback service (the linchpin)](#the-module-fallback-service-the-linchpin)
  - [The in-heap filesystem](#the-in-heap-filesystem-memfs)
  - [Source rewrites](#source-rewrites)
  - [Single-threaded Rolldown](#single-threaded-rolldown)
  - [HMR](#hmr)
- [Layer 2: real npm inside workerd](#layer-2-real-npm-inside-workerd)
- [Layer 3: the Durable Object machine](#layer-3-the-durable-object-machine)
- [The forks](#the-forks)
- [Honest limits & known sharp edges](#honest-limits--known-sharp-edges)
- [Repository map](#repository-map)

---

## Quick start (Layer 1: Vite in workerd)

This is the most polished, runnable-today piece, and it runs on **stock
workerd** (miniflare ships it; no custom binary).

```bash
./setup.sh        # npm install in app/ and harness/; harness postinstall patches
                  # the Rolldown wasm for single-threaded workerd

cd harness
npm run dev       # vite dev server INSIDE workerd → open http://localhost:5173
npm run build     # vite build INSIDE workerd → writes ../app/dist
```

`npm run dev` and `npm run build` behave like ordinary `vite` / `vite build` —
the toolchain just runs inside the isolate instead of on Node. `dev` leaves
workerd listening on a real port; open it and use the app like any Vite dev
server (HMR client connects over `/__hmr`). Set `PORT=…` to change the port.

The demo app ([`app/`](app/)) is a realistic stack: **Vite 8**, **Tailwind CSS
v3** (PostCSS + autoprefixer, `@tailwind` directives, `@apply`), **react-router
7**, **@tanstack/react-query 5** — ~90 modules.

### Self-checks

```bash
npm run verify:build   # build on host Node AND in workerd, byte-compare the two dist trees
npm run verify:dev     # crawl the dev module graph, report the status of every response
```

`verify:build` is the strong correctness proof: it runs the real Vite on host
Node into `baseline-dist/`, runs the same build inside workerd into
`workerd-dist/`, and asserts the two trees are **byte-for-byte identical** —
same JS, same Tailwind-generated/autoprefixed/minified CSS, same file set. It
fails unless every file matches.

`verify:dev` is a reachability check: it crawls the dev server's module graph
the way a browser would (following `import` specifiers) and asserts every
response is `200` with the expected content-type. It proves the dev server
serves the whole graph; it does not diff the transformed output against host
Vite (the build path is where output correctness is proven).

---

## What's actually verified

Concretely demonstrated, with the checks/artifacts that back each claim:

| Claim | Evidence |
|---|---|
| `vite build` runs inside workerd | `vite.build()` executes in the isolate (`harness/worker/driver.mjs`); output collected from in-heap `/tmp/app/dist` |
| …and is byte-identical to host Node | `npm run verify:build` — strict byte-compare of both dist trees |
| `vite dev` runs inside workerd | `vite.createServer()` (middleware mode) in the isolate; every graph URL returns 200 (`npm run verify:dev`) |
| Rolldown bundles single-threaded | forked wasm with `asyncWorkPoolSize: 0` and a hard guard that **throws** on any worker-thread spawn — 0 threads, by construction |
| real `npm install` runs inside workerd | `@npmcli/arborist` `reify()` fetches from `registry.npmjs.org` into the isolate FS (Layer 2) |
| the full loop in a Durable Object | `npm install @netanelgilad/vite` from public npm → `vite build`/`dev` from `/tmp` in a sub-isolate → ToDo app driven in a real browser; captured in [`do-machine-clean/proof/`](experiments/npm-in-workerd/do-machine-clean/proof/) (Layer 3, fork) |
| real `npm create vite` → live HMR, in the shell | `npm create vite` (real `libnpmexec` + `create-vite` via the `child_process`→isolate bridge) → `npm install` → real `vite` bin `dev` for the cwd → editing a component pushes a live HMR `update` to the browser; asserted in [`workerd-bash/test-realbin-dev.mjs`](experiments/npm-in-workerd/workerd-bash/test-realbin-dev.mjs) (Layer 3, fork) |

Everything labeled "inside workerd" genuinely executes in the isolate — there is
no path that silently shells out to host Node for the build. The host process's
only jobs are running miniflare, answering module-resolution requests, and (for
dev) watching `app/` on disk. See [§ How it works](#how-it-works).

---

## How it works

```
host Node process                          workerd isolate (stock)
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

### The module fallback service (the linchpin)

workerd asks the host for every module specifier it can't resolve from the
bundle. `harness/host.mjs` registers as that fallback service, which makes it the
single interception point for three things at once:

- **resolution** — real `node_modules` on disk (via `enhanced-resolve`), plus
  aliases that swap native tooling for wasm: `esbuild → esbuild-wasm`,
  `rollup → @rollup/wasm-node`, `rolldown → the single-threaded fork`;
- **format** — ESM/CJS handling, `namedExports` via `cjs-module-lexer`;
- **source rewriting** — see below.

This is the WebContainers pattern: intercept at module-load time rather than
patching files on disk.

### The in-heap filesystem (memfs)

workerd's `node:fs` VFS is **per-request** — writes vanish between requests, and
module-evaluation code sees a different view than request handlers. So there's
no persistent real filesystem to point Vite at. The fix is to bring your own:
the host reads the npm-installed app from disk and ships it into an in-heap
[`memfs`](https://github.com/streamich/memfs) volume inside the isolate (via the
`/manifest` binding). That volume — plus the Vite dev server and the wasm
instances — persists for the isolate's lifetime as module-level state.

### Source rewrites

Applied by the fallback service as modules are served, because workerd disallows
or under-implements a handful of things Vite/Rolldown rely on:

1. `import.meta.url`/`dirname`/`filename` → baked literals (workerd returns `undefined`).
2. `new WebAssembly.Module(` / `WebAssembly.compile(` → the `UnsafeEval` binding (runtime wasm compilation is otherwise forbidden).
3. `(0,eval)` / `new Function(` → `UnsafeEval`-backed helpers (code generation is disabled outside it).
4. `fs` import/require sites (incl. `__require("fs")` interop) → the in-heap memfs shim.
5. `createRequire(x).resolve(...)` and `pathToFileURL(...)` (PostCSS config loading) → host-resolving helpers.
6. CJS modules get `__filename`/`__dirname` injected.

These are runtime adaptations, not output shortcuts — the rewrites change *how*
code loads, not *what* the build produces (which is why `verify:build` comes out
byte-identical).

### Single-threaded Rolldown

Vite 8 bundles with Rolldown, whose wasm binding spawns WASI worker threads.
workerd has `SharedArrayBuffer`, shared `WebAssembly.Memory`, and `Atomics`, but
`worker_threads.Worker` spawning is a stub. So this uses a **forked,
single-threaded Rolldown**: `asyncWorkPoolSize: 0`, a cooperative async-runtime
pump (`pump_async_runtime`) driven from JS via `ctx.waitUntil`, and a guard that
**throws `THREAD_SPAWN_ATTEMPTED`** if any code path tries to spawn a thread — so
"single-threaded" is enforced and would fail loudly, not silently degrade. The
bundling logic itself is unchanged. `patch-emnapi-wasi.mjs` applies the JS-side
companions (advisory mutex, immediate condition-wait, re-derived `Int32Array`
views on memory growth, `setImmediate → queueMicrotask`, WASI clock/poll fixes
for workerd's frozen-during-sync-execution clock). Full writeup:
[`docs/rolldown-fork-findings.md`](docs/rolldown-fork-findings.md). The Rust +
binding source patches and rebuild steps are in
[`harness/rolldown-fork/`](harness/rolldown-fork/BUILD.md).

### HMR

Real Vite HMR (module hot-swap, not full-page reload), made to work against two
workerd constraints:

- Vite's HMR server is the `ws` npm package, which needs a raw TCP socket and an
  inbound listener — neither exists in workerd. So the client environment gets a
  **custom HotChannel** (`hotChannel` in `driver.mjs`) backed by workerd's
  `WebSocketPair` instead of `ws`. Vite's real HMR pipeline (`hot.send`) drives
  it; the stock `@vite/client` connects over `/__hmr`.
- An accepted WebSocket can only be used from the request context that accepted
  it, so each socket is driven by a **pump loop inside its own `/__hmr`
  request** (via `ctx.waitUntil`): it long-polls the host file watcher, writes
  changed bytes into memfs, and fires `server.watcher.emit("change", …)` — Vite
  computes the update and sends it back over that same socket, in-context.
- The host watches `app/` on disk (`fs.watch`), since the isolate can't watch
  its in-heap memfs.

---

## Layer 2: real npm inside workerd

[`experiments/npm-in-workerd/`](experiments/npm-in-workerd/) — can npm 11's
actual install engine (`@npmcli/arborist`) run inside a V8 isolate, over an
in-heap memfs, fetching from the live registry? **Yes**, on stock workerd:

```bash
cd experiments/npm-in-workerd
npm install
node run-install.mjs left-pad@1.3.0
node run-install.mjs debug@4.3.4          # transitive: debug + ms
node run-install.mjs react-dom@18.3.1     # full tree, ~2.7s
```

Each runs Arborist `reify()` **inside workerd**: resolve the tree → fetch
packuments + tarballs from `registry.npmjs.org` over `node:https` → gunzip +
untar into memfs → write `node_modules`. The same module-fallback + memfs
machinery as the Vite harness, plus a handful of workerd-specific accommodations
(`node:process` shim, `process.report` stub, a one-volume memfs across the
ESM/CJS split, an `@npmcli/agent` alias so npm uses workerd's default HTTPS
path). All of these — and the one hard wall, `child_process.spawn` — are
documented in [its README](experiments/npm-in-workerd/README.md).

The hard wall matters: workerd stubs process spawning, so installs are
effectively `--ignore-scripts` (no lifecycle scripts; native postinstall
packages don't work — but the Vite toolchain already replaces native bundlers
with wasm).

---

## Layer 3: the Durable Object machine

This is the end goal: **the Durable Object *is* the machine.** A DO does a real
`npm install @netanelgilad/vite` **from public npm** into its own persistent,
native `/tmp`, then runs `vite build` and a live `vite dev` server of a real
ToDo app — Vite executing inside a **Worker-Loader sub-isolate** that resolves
its module graph from the DO's shared `/tmp`. The dev server is proxied out to a
real port and a browser renders and drives the app.

The canonical demo is
[`do-machine-clean/`](experiments/npm-in-workerd/do-machine-clean/):

```bash
# build of the ToDo app from /tmp in a child (writes a real dist):
MINIFLARE_WORKERD_PATH=~/path/to/workerd-vfs.bin \
  node experiments/npm-in-workerd/do-machine-clean/run.mjs

# dev server, browser-reachable on a real port:
DEV=1 PORT=5191 MINIFLARE_WORKERD_PATH=~/path/to/workerd-vfs.bin \
  node experiments/npm-in-workerd/do-machine-clean/run.mjs
# -> open http://127.0.0.1:5191/
```

There is **no source-transform pass and no runtime overlay** here: everything
Vite needs is baked into the two published npm packages, and the workerd fork
supplies `import.meta.url` natively. The captured proof (resolved
public-registry dependency tree, real `dist/`, and live-browser DOM assertions)
is in [`do-machine-clean/proof/`](experiments/npm-in-workerd/do-machine-clean/proof/).

### The full hands-on flow: real `npm create vite` → live HMR

[`workerd-bash/`](experiments/npm-in-workerd/workerd-bash/) is an interactive
shell into a running DO isolate, and it now drives the **entire real toolchain
end to end** — not just the prebaked ToDo demo:

```bash
node experiments/npm-in-workerd/workerd-bash/repl.mjs   # locates the fork binary itself; dev port 5190
```

then, at the `workerd:/tmp/proj$` prompt:

```bash
npm create vite myapp -- --template react-ts          # REAL create-vite, run in a sub-isolate
# repin the scaffolded app onto the workerd forks:
sed -i 's#"vite": "[^"]*"#"vite": "npm:@netanelgilad/vite@8.0.16-workerd.0", "rolldown": "npm:@netanelgilad/rolldown@1.0.3-workerd.0"#' myapp/package.json
cd myapp
npm install                                            # the app's own deps, from public npm
npm run dev                                            # the REAL vite bin serving myapp → open http://127.0.0.1:5190/
sed -i 's/Get started/Hello from workerd/' src/App.tsx   # edit the <h1> → it updates LIVE in the browser
```

Three primitives make this work — each *fixing a missing capability*, not
scripting around the tool:

- **`npm create` / `npm exec` / `npx`** run real `libnpmexec` + the real
  `create-vite` bin via a `child_process.spawn` → **isolate-spawn bridge** (a
  spawned process becomes a Worker-Loader child over the shared `/tmp`).
- **`vite dev` / `npm run dev`** run the **real `vite` bin against the current
  dir**, honoring the project's own `vite.config.ts` (no hand-rolled
  `createServer`). The fork's `node:http` shim supplies the listening server
  workerd has no primitive for.
- **Live HMR**: workerd has no `fs.watch`, so the shell — which owns every edit —
  drives Vite's real watcher on each write (`server.watcher.emit('change', …)`);
  the resulting update reaches the browser over a `WebSocketPair` bridge to
  Vite's real `ws` server. End-to-end verified in
  [`workerd-bash/test-realbin-dev.mjs`](experiments/npm-in-workerd/workerd-bash/test-realbin-dev.mjs).

### Why a sub-isolate (and the constraint that shaped this)

A Worker-Loader child can share the DO's native `/tmp` (`shareParentTmp`), but on
**stock workerd a child cannot resolve modules via the fallback service, nor
`import()` a file from `/tmp`** — workerd's ESM loader only consults the
isolate's own module registry. That's verified empirically (the fallback service
receives zero requests from the child) in
[`do-shell/`](experiments/npm-in-workerd/do-shell/). The consequence:

- **npm runs in the DO itself** (the top-level worker, which *does* have the
  fallback), over the shared native `/tmp`.
- **Vite runs in a child** — but only because the workerd fork adds a **VFS
  module loader** that lets the child resolve its graph from `/tmp`. This is the
  capability Layer 3 depends on, and the reason it can't run on stock workerd.

---

## The forks

Three forks. Two are published, reproducible npm packages; one is the workerd
C++ branch.

### `@netanelgilad/rolldown@1.0.3-workerd.0` ([npm](https://www.npmjs.com/package/@netanelgilad/rolldown))

Rolldown built to run as **single-threaded wasm**. Five layers of patching, all
committed as source under [`harness/rolldown-fork/`](harness/rolldown-fork/BUILD.md):
target-gate wasm-incompatible tokio features and port the exposed `tokio::fs`
calls to `std::fs` under `cfg(target_family="wasm")`; add a `pump_async_runtime`
export so JS can cooperatively drive the runtime; vendor napi/napi-build wired
for threadless `wasm32-wasip1`; JS-side emnapi/WASI patches; and a binding loader
that uses non-shared memory and forbids worker creation. **Net ≈ +39 lines of
Rust** — the changes alter the *execution model* (thread-per-task → cooperative
pump), not the bundling logic. The 12 MB `rolldown.wasm` is a prebuilt blob
(gitignored to keep the repo small; the durable artifact is the npm package),
but it's fully reproducible from the committed patches — see
[`harness/rolldown-fork/BUILD.md`](harness/rolldown-fork/BUILD.md) and
[`docs/rolldown-fork-findings.md`](docs/rolldown-fork-findings.md).

### `@netanelgilad/vite@8.0.16-workerd.0` ([npm](https://www.npmjs.com/package/@netanelgilad/vite))

Upstream Vite 8 (Rolldown-powered) with three changes baked into the published
`dist/`: (1) `rolldown` repinned to the fork via an npm alias; (2) esbuild
replaced with a single-threaded `esbuild-wasm` workerd shim
(`bundleDependencies`); (3) the code-gen rewrites (`new Function`, `(0,eval)`,
`WebAssembly.compile`, `createRequire().resolve`) baked in, so a consumer only
needs to install contract globals before `import`-ing vite. Recipe and exact
rewrite table: [`harness/vite-fork/BUILD.md`](harness/vite-fork/BUILD.md);
publish steps: [`packages/PUBLISH.md`](packages/PUBLISH.md). The unpacked copy
under [`packages/vite/`](packages/) is just `npm pack` output, re-fetchable with
`npm pack @netanelgilad/vite@8.0.16-workerd.0`.

### workerd fork — [`feat/vfs-module-loading`](https://github.com/netanelgilad/workerd/tree/feat/vfs-module-loading)

Stock workerd runs Layers 1 and 2. Layer 3 needs two C++ capabilities that don't
exist upstream, plus several `node:fs` bug fixes, all on this pushed branch:

- **VFS-backed module loading for Worker-Loader children** — a child can resolve
  and execute its `import` graph from a shared `/tmp`, with a correct
  `import.meta.url` (`file://<path>`) supplied natively. This removes the single
  largest class of source rewrites (≈28 hits across a full Vite install).
- **`shareParentTmp`** — a child isolate inherits the parent DO's writable
  `/tmp`; and a shared writable `/tmp` via `TmpDirStoreScope` + `IoContext`.
- **`node:fs` fixes** surfaced by running real npm over native fs: `mkdtemp`
  with a trailing-separator prefix (npm's `withTempDir`), async `read` with
  null position, `O_TRUNC`, directory `renameSync`, `rm` force, `writev`/`readv`
  callback handling.

To run Layer 3, build that branch (`bazel build //src/workerd/server:workerd`)
and point miniflare at the binary with `MINIFLARE_WORKERD_PATH`. The `prep-install-url/`
experiment additionally shows installing the fork from a local HTTP tarball URL
into a DO. These workerd-isms are exactly the kind of thing worth upstreaming —
each is a small, well-scoped capability or bugfix.

---

## Honest limits & known sharp edges

Stated plainly so nothing reads as more finished than it is:

- **Layer 3 requires the workerd fork.** `do-machine-clean` and `workerd-bash`
  will not run on stock workerd (no `vfsModuleFallback`, no `shareParentTmp`).
  Layers 1 and 2 do run on stock workerd.
- **npm installs are `--ignore-scripts`.** workerd has no `child_process.spawn`,
  so lifecycle scripts (`pre/postinstall`, `prepare`) can't run. Pure-JS packages
  are fine; native postinstall packages aren't (the Vite path sidesteps this by
  shipping wasm bundlers).
- **The npm experiment's `spawn` command is faked.** It runs a program inline in
  the same isolate (fake `argv`/`cwd`, trapped `process.exit`), not a real OS
  process. There's no TTY, no signals, no fork/IPC, and shared globals across
  "processes" — fine for sequential scaffold/build steps, not concurrent ones.
- **`verify:dev` is a reachability check, not an output diff.** It asserts every
  module-graph URL returns 200 with the right content-type; it does not compare
  transformed output against host Vite. The build path (`verify:build`) is the
  byte-level correctness proof.
- **Memory.** workerd RSS is dominated by the wasm heaps (esbuild's Go runtime +
  Rolldown) and ratchets up across repeated builds, since wasm memory can't
  shrink. The full `@netanelgilad/vite` + rolldown install is memory-hungry and
  can SIGKILL the workerd child under pressure; keep heavy runs serial and retry
  on an idle machine. For production the fix is isolate **recycling** at
  ms-spawn cost.
- **DO `/tmp` is per-process**, not persisted to host disk — in the
  shell/REPL demos you must `npm install` and `vite dev` in the same session.
- **The Rolldown wasm is a prebuilt blob** (reproducible from committed patches,
  but not rebuilt by `setup.sh`).
- **Live HMR is real but its connection is `waitUntil`-bounded.** The shell drives
  Vite's real watcher on each edit and the update is pushed to the browser, but
  the HMR WebSocket is served from a `ctx.waitUntil`-kept-alive context (workerd
  won't let a later invocation send on a socket the upgrade accepted). So edits
  land live within a window after each page load; a reload reconnects. The durable
  fix is to host the socket in the DO with the WebSocket **Hibernation API**.

---

## Repository map

```
app/                          Layer-1 demo app: Vite 8 + Tailwind v3 + router + query
app-todo/                     simpler ToDo app (the Layer-3 demo target); proof-screenshots/
harness/                      Layer 1 — Vite build/dev INSIDE workerd (stock)
  host.mjs                      miniflare host: module fallback + manifest + rewrites
  worker/driver.mjs             in-isolate driver (build / dev / preview routes)
  run-{dev,build}.mjs           npm run dev / build
  run-verify-{build,dev}.mjs    the two self-checks
  shims/                        in-heap memfs fs, esbuild-wasm shim, bash
  rolldown-shim/                patched @rolldown/browser loader (installed as node_modules/rolldown)
  rolldown-fork/                Rust + binding source patches that build rolldown.wasm + BUILD.md
  vite-fork/BUILD.md            how @netanelgilad/vite is produced
  patch-emnapi-wasi.mjs         JS-side single-threaded-workerd patches (run by postinstall)
packages/                     npm pack output of the two published forks + PUBLISH.md
docs/rolldown-fork-findings.md  deep writeup of the 5-layer single-threaded Rolldown fix
experiments/npm-in-workerd/   Layers 2 & 3
  README.md                     Layer 2: real npm install in workerd (memfs, stock)
  run-install.mjs, worker/, shims/   the Layer-2 install harness
  do-native-fs/                 npm install over a DO's persistent native /tmp
  do-shell/                     shell into a DO + the "can a child use the fallback?" probe (answer: no)
  do-machine-clean/  ★          CANONICAL Layer-3 capstone (public-npm install → vite from /tmp → browser)
  workerd-bash/      ★          interactive shell culminating in `vite dev` (Layer 3)
prep-install-url/             npm install from a local HTTP tarball URL into a DO's native /tmp
                              (the mechanism for installing a self-hosted fork tarball)
```

★ = the demos to look at first. Other directories under `experiments/npm-in-workerd/`
(`do-machine`, `create-vite-spike`, `vite-serve-spike`, `importmeta-probe`,
`scratch-investigate`, `scratch-vite`, `shims-vite`, `vfs-child-mod`,
`zzz-install-probe`) are **kept-on-purpose investigation artifacts** — earlier
variants and probes that document the path to the working demos. They are not the
canonical demos; `do-machine` in particular is the earlier transform-pass
approach that `do-machine-clean` supersedes.
