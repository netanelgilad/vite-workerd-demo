# Experiment: real npm install inside workerd

Can the **real npm** (`@npmcli/arborist`, npm 11's actual install engine) run
inside a V8 isolate (workerd) over an in-heap memfs, fetching from the real
registry? **Yes** — `npm install` works.

```bash
npm install                 # installs miniflare + real npm + harness deps
node run-install.mjs left-pad@1.3.0
node run-install.mjs debug@4.3.4          # transitive: debug + ms
node run-install.mjs react-dom@18.3.1     # full tree: react-dom react scheduler loose-envify js-tokens
```

Each runs npm's Arborist `reify()` **inside workerd** (via miniflare): resolve
the dependency tree → fetch packuments + tarballs from `registry.npmjs.org` over
`node:https` → gunzip + untar into memfs → write `node_modules`. Verified:

| Install | Result |
|---|---|
| `left-pad@1.3.0` (no deps) | ✅ ~1.0 s |
| `debug@4.3.4` (→ ms) | ✅ transitive resolution |
| `react-dom@18.3.1` (→ react, scheduler, loose-envify, js-tokens) | ✅ full tree, ~2.7 s |

Run with `--ignore-scripts` semantics (lifecycle scripts can't run — see below).

## How it works

Same module-fallback + memfs machinery as the Vite harness (`../../harness`):
`host.mjs` resolves the worker's imports against npm's code on disk, rewrites
`fs`/`process` import sites to in-heap shims, and routes runtime
eval/Function/wasm through the `UnsafeEval` binding. npm's network
(`make-fetch-happen` → `node:https`) reaches the registry directly. `driver.mjs`
seeds a project `package.json` into memfs and runs `Arborist.reify()`.

## What workerd makes hard (the debugging journey)

Getting npm to load + run surfaced several workerd-isms, each fixed in
`host.mjs` / `worker/driver.mjs` / `shims/`:

1. **`node:`-prefixed builtins** — npm imports `node:process` etc.; the fallback
   must redirect both bare and `node:`-prefixed forms to workerd's native
   builtins.
2. **`require('node:process')` segfaults workerd** — a fallback-served CJS module
   doing `require('node:process')` crashes the runtime (stack-overflow-shaped).
   The *global* `process` is fine, so the source rewrite swaps `node:process` /
   `process` import sites for a shim that re-exports `globalThis.process`
   (`shims/process.cjs`). (`fs` is rewritten to a memfs shim the same way.)
3. **`process.report.getReport()` segfaults workerd** — npm's libc detection
   (`npm-install-checks/current-env.js`) calls it on Linux. We stub
   `process.report` and seed a fake `/usr/bin/ldd` in memfs so detection
   short-circuits to "glibc" before ever touching `report`.
4. **ESM-import vs CJS-require split the memfs volume** — workerd keeps separate
   module instances for `import("…/fs.mjs")` and `require("…/fs.mjs")`, so the
   driver's writes and npm's reads landed in *different* volumes. The fs shim
   now holds its `Volume` on `globalThis` so there's one shared filesystem.
5. **npm's keepalive/proxy agent breaks `node:https.request`** — the
   `@npmcli/agent` agent forces an HTTP ClientRequest for an HTTPS URL
   ("Protocol https: not supported"). Aliasing `@npmcli/agent` to a shim whose
   `getAgent()` returns `undefined` lets npm use workerd's default request path,
   which reaches the registry fine.

## The hard wall: `child_process.spawn`

workerd stubs process spawning (`spawn` → "not implemented"). That means:
- **Lifecycle scripts** (`preinstall`/`postinstall`/`prepare`) can't run — installs
  are effectively `--ignore-scripts`. Fine for pure-JS packages; native packages
  that download a binary in `postinstall` (esbuild, etc.) won't — but the Vite
  harness already replaces those with wasm.
- **`npm exec` / `npm create`** spawn a downloaded CLI's bin. To do `npm create
  vite` in-isolate, the scaffolder has to be run **in-process** (import its
  module) rather than spawned.

## Toward the goal (`npm create vite` → `npm install` → `vite dev`)

- ✅ `npm install` (the engine) runs in workerd — proven here.
- ⏭ Install a full Vite React-TS project's deps (pure-JS subset; native bundlers
  come from the Vite harness's wasm shims).
- ⏭ Scaffold via create-vite **in-process** (no spawn).
- ✅ `vite dev` / `vite build` in workerd — the sibling `../../harness`.

Next step is to merge the two harnesses: install into the same memfs the Vite
driver builds/serves from, end to end in one isolate.
