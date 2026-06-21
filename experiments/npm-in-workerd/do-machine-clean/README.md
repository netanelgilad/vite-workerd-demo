# do-machine-clean — the DO is a JS machine: `npm install @netanelgilad/vite` from PUBLIC npm → vite dev from `/tmp` in a sub-isolate → a reachable ToDo app

This is the **canonical capstone demo** of "the Durable Object is a JavaScript
machine." A Durable Object (running on a forked workerd) does a real
`npm install` of Vite **from the public npm registry**, writes the package tree
into its own `/tmp` over native `fs`, and then runs **`vite build`** and a live
**`vite dev` server** of a real ToDo app — Vite executing entirely inside a
Worker-Loader **sub-isolate** that resolves its module graph from the DO's
shared `/tmp` via the fork's C++ VFS module loader. The dev server is proxied
out to a real port and a browser renders + drives the working ToDo app.

There is **NO source-transform pass and NO runtime overlay**. Everything Vite
needs is baked into the two published packages; the workerd fork supplies
`import.meta.url` natively. The only host/child glue is the documented
runtime-contract globals (`__UNSAFE_EVAL`, `__wasmCompile`, the rolldown WASI
boot globals) — not a code rewrite.

## What it proves (the whole loop, from public npm)

1. **`npm install @netanelgilad/vite` from `https://registry.npmjs.org/`** —
   the `@npmcli/arborist` engine resolves + fetches the published fork and its
   transitive deps into the DO's `/tmp/node_modules` over native `fs`. The
   `rolldown` dep is the npm alias `npm:@netanelgilad/rolldown@1.0.3-workerd.0`,
   so Arborist transitively pulls the forked rolldown straight from npm too.
   Both tarballs ship their critical deps as `bundleDependencies`
   (vite → the esbuild-wasm workerd shim; rolldown → the patched
   `@emnapi`/`@napi-rs`/`@tybys` WASI runtime), so the patched runtime arrives
   inside the registry tarballs — nothing extra resolved from stock npm.
2. **`vite build`** of `app-todo` from `/tmp` in a Worker-Loader child → a real
   `dist/` (`index.html` + hashed `index-*.js` / `index-*.css`).
3. **`vite dev`** (`createServer`, middleware mode) in a child over the DO's
   `/tmp`; the DO proxies browser HTTP (and the `/__hmr` WebSocket) to the child
   and exposes it on a real miniflare port.
4. **The ToDo app renders + works in a real browser** (Playwright): add todos,
   toggle complete (strikethrough + "N items left"), filter (all/active/
   completed), delete.

The captured results live in [`proof/`](./proof):

- [`proof/build-result.json`](./proof/build-result.json) — the public-registry
  resolved dependency tree (vite + the `@netanelgilad/rolldown` fork, both with
  `_resolved: https://registry.npmjs.org/...`) and the build output (real
  `dist/` with hashed JS/CSS, `rolldownReady: true`, `viteVersion`).
- [`proof/browser-proof.json`](./proof/browser-proof.json) — the live-browser
  DOM assertions against the dev server (initial render, add 3, toggle →
  `text-decoration: line-through` + "2 items left", filter active/completed,
  delete → "1 item left").

## Run it

Requires the fork workerd binary (see below) and Node. **Run only ONE instance
at a time** — concurrent runs race on the DO's `/tmp`.

```bash
# vite BUILD of the ToDo app from /tmp in a child (writes a real dist):
MINIFLARE_WORKERD_PATH=/tmp/workerd-vfsmod-bin \
  node experiments/npm-in-workerd/do-machine-clean/run.mjs

# vite DEV server, browser-reachable on a real port:
DEV=1 PORT=5191 MINIFLARE_WORKERD_PATH=/tmp/workerd-vfsmod-bin \
  node experiments/npm-in-workerd/do-machine-clean/run.mjs
# -> open http://127.0.0.1:5191/ in a browser; the ToDo app is served by Vite
#    running from /tmp inside a workerd sub-isolate.
```

The install fetches real packages from npm and takes ~90s the first time on a
given DO instance. The DEV run keeps the serving DO + its vite child warm so a
browser session stays fast.

## The dependency on the fork workerd binary

The harness must run on the forked workerd built from branch
**`feat/vfs-module-loading`** (this session it lives at
`/tmp/workerd-vfsmod-bin`, READ-ONLY). Point miniflare at it with
`MINIFLARE_WORKERD_PATH`. The fork carries two C++ fixes that this demo depends
on:

1. **Legacy-registry `import.meta` initializer** (`jsg/modules.h`): VFS-loaded
   ESM modules now get `import.meta.url = file://<their /tmp path>`. This makes
   the single biggest "needs a rewrite" class (≈28 hits across a full Vite
   install) work natively, so no transform pass is needed.
2. **`mkdtemp(prefix)` with a trailing-separator prefix** (`api/filesystem.c++`):
   what npm's `@npmcli/fs withTempDir` does during install — previously raised
   `EINVAL`; now resolves correctly.

## The published packages (live on npm)

- `@netanelgilad/vite@8.0.16-workerd.0` — rolldown repinned to the fork (npm
  alias `npm:@netanelgilad/rolldown@1.0.3-workerd.0`), esbuild bundled as a
  single-threaded esbuild-wasm workerd shim, code-gen rewrites baked into
  `dist/node/chunks/*`.
- `@netanelgilad/rolldown@1.0.3-workerd.0` — single-threaded `rolldown.wasm` +
  the patched emnapi/@tybys/@napi-rs WASI runtime (`bundleDependencies`) + the
  code-gen rewrites baked in. WASM wired via `import.meta.url`.

These are installed straight from npm; the big `packages/*/*.tgz` tarballs are
**not** committed (they're gitignored — the packages live on npm now).

## Architecture summary

```
host (node + miniflare, fork workerd)
└── Durable Object  NpmChildRunner  (native /tmp persists per DO instance)
    ├── /install        Arborist → npm registry → /tmp/node_modules  (native fs)
    ├── /scaffold-app   ToDo source → /tmp/proj
    ├── /run-vite-build ─┐
    └── /dev-warmup ─────┤  Worker-Loader CHILD (sub-isolate)
                         │   - shareParentTmp: sees the DO's /tmp
                         │   - vfsModuleFallback: C++ VFS module loader resolves
                         │     vite/rolldown/react from /tmp (import.meta.url native)
                         │   - runtime-contract globals installed (NOT a rewrite)
                         └── vite build  /  vite createServer (dev, middleware mode)
```

Three pieces make it work, all without a transform pass:

- **The C++ VFS module loader** in the fork resolves the child's `import`s
  against the DO's shared `/tmp` and supplies a correct `import.meta.url`.
- **A shared `/tmp`** (`shareParentTmp`) so the child sees the exact tree the DO
  `npm install`ed.
- **The baked-into-package workerd workarounds** (single-thread rolldown WASM,
  esbuild-wasm shim, code-gen rewrites) shipped inside the published packages —
  so a plain `npm install` from public npm is all that's needed.

### Notes / known sharp edges

- `@vitejs/plugin-react@6` declares a **required** peer `vite: "^8.0.0"`. The
  fork's version `8.0.16-workerd.0` is a *prerelease*, which by semver does not
  satisfy `^8.0.0`, so Arborist is run with `legacyPeerDeps: true` — exactly
  what a real `npm install @netanelgilad/vite @vitejs/plugin-react` user would
  pass (`--legacy-peer-deps`). This is an npm-side resolution accommodation, not
  a package defect.
- `run.mjs` drives the build path via `dispatchFetch`. For the dev path it warms
  + serves over the bound HTTP port, and the DO serve path **self-heals**
  (`ensureDevReady`): if a port request lands on a DO instance that didn't run
  setup, it installs-from-registry (if needed) + scaffolds + boots Vite on that
  instance, so whichever DO answers the browser can serve.
- `capture-build.mjs` is a one-shot harness that drives only the build flow and
  writes the full install + build result JSON to `proof/build-result.json`
  (deterministic capture, independent of stdout buffering / dispose hangs).
```
