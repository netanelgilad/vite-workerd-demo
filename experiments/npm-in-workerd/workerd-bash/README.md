# workerd-bash — a shell INTO a v8 isolate

A hands-on interactive REPL that drops you **inside a workerd Durable Object's
shared native `/tmp`**. You type commands; they run in the v8 isolate. Culminates
in `vite dev` serving the ToDo app — installed from public npm and run from `/tmp`
— on a reachable port you open in your browser.

## Run it (ONE command)

From `experiments/npm-in-workerd/`:

```bash
node workerd-bash/repl.mjs
```

or, equivalently (the package declares a `bin` + `start` script):

```bash
npm --prefix workerd-bash start
# or, if linked:  npx workerd-bash
```

That's the whole thing. The launcher locates the workerd **fork** binary itself
(no env var needed): it tries `$MINIFLARE_WORKERD_PATH`, then
`~/Development/workerd-vfs.bin` (the stable fork build), then
`/tmp/workerd-vfsmod-bin`, and prints a clear "build the fork" error if none exist.

Optional: `PORT=5191 node workerd-bash/repl.mjs` to change the dev-server port
(default `5190`); `VERBOSE=1` for miniflare debug logs.

## What you can type

```
workerd:/tmp/proj$ help                 # the command list
workerd:/tmp/proj$ pwd                   # /tmp/proj
workerd:/tmp/proj$ echo hi > note.txt    # just-bash builtins over the isolate's
workerd:/tmp/proj$ cat note.txt          #   real native /tmp: ls cat echo mkdir
workerd:/tmp/proj$ ls sub | wc -l        #   rm cd, pipes, > and >> redirects
workerd:/tmp/proj$ npm install           # @netanelgilad/vite + ToDo deps from
                                         #   public npm (no args = the default set);
                                         #   `npm install left-pad react ...` for specifics
workerd:/tmp/proj$ npm ls                # list installed packages
workerd:/tmp/proj$ npm create vite myapp -- --template react-ts   # REAL create-vite in a sub-isolate
workerd:/tmp/proj$ npm exec <pkg> / npx <pkg>   # real libnpmexec via the child_process->isolate bridge
workerd:/tmp/proj$ scaffold              # write the ToDo app source into /tmp/proj
workerd:/tmp/proj$ vite build            # build from /tmp in a child isolate; lists dist/
workerd:/tmp/proj$ vite dev              # boot the REAL vite bin for the current dir; PRINTS a URL
workerd:/tmp/proj$ npm run dev           #   (alias for `vite dev`; honors the project's own vite.config)
workerd:/tmp/proj$ exit
```

Two flows:

**Quick (prebaked ToDo):** `npm install` → `vite dev` → open the printed
`http://127.0.0.1:5190/` → the ToDo app, served by Vite running from `/tmp`.

**Full (real `npm create` → live HMR):** scaffold a brand-new app and edit it live:

```bash
npm create vite myapp -- --template react-ts
# repin the scaffolded app onto the workerd forks:
sed -i 's#"vite": "[^"]*"#"vite": "npm:@netanelgilad/vite@8.0.16-workerd.0", "rolldown": "npm:@netanelgilad/rolldown@1.0.3-workerd.0"#' myapp/package.json
cd myapp
npm install
npm run dev                                            # open http://127.0.0.1:5190/
sed -i 's/Vite + React/Vite in workerd/' src/App.tsx   # → updates LIVE in the browser (HMR)
```

`npm create`/`exec`/`npx` run the real bins through a `child_process.spawn` →
isolate-spawn bridge; `vite dev` runs the real `vite` bin against the cwd; and an
edit to a component is reported to Vite's real watcher, so HMR pushes the update
to the browser with no reload (workerd has no `fs.watch` — the shell, which owns
every write, *is* the watch source).

## How it works

- **ONE miniflare + ONE Durable Object** (`Shell`), booted on the fork binary with
  a bound HTTP port, `worker_loaders`, `nodejs_compat`/`experimental`, and the
  module-fallback service.
- The DO owns a **shared native `/tmp`** (workerd's `node:fs`, persisted across the
  separate `/exec` requests the REPL fires per line). just-bash runs as the shell
  over it via a `NativeFsAdapter` (`worker/bash-native.mjs`).
- `npm install` runs **in the DO** via npm's Arborist, fetching from
  `https://registry.npmjs.org/` into `/tmp/proj/node_modules`. The DO has the
  module-fallback service (`host.mjs`) that resolves npm's own code from the host
  `node_modules`, plus the workerd workarounds (process shim, eval/Function/WASM
  rewrites, and the **tar sync-extract hack** that makes install work over native fs).
- `vite build` / `vite dev` run **in a Worker-Loader CHILD** that shares the DO's
  `/tmp` (`shareParentTmp`) and resolves vite/rolldown's module graph directly from
  `/tmp/proj` via the fork's **`vfsModuleFallback`**. The dev server runs in
  middleware mode; the DO proxies every browser request (and the `/__hmr`
  WebSocket) to the child over RPC.
- The dev path **self-heals**: miniflare can route a port request to a DO instance
  whose `/tmp` didn't get the REPL-driven setup, so the serve path re-runs
  install/scaffold/warmup on whichever instance the browser hits.

This is `do-shell` (the REPL + just-bash skeleton) fused with `do-machine-clean`
(the public-registry install + vite-from-`/tmp` dev/build + DO→child proxy + HMR).
Nothing in those source dirs was modified.

## Layout

```
workerd-bash/
  repl.mjs                 # the single-command launcher + interactive loop (bin: workerd-bash)
  host.mjs                 # miniflare harness + module-fallback service + app-manifest/dev-probe host
  worker/shell-do.mjs      # the Shell Durable Object: just-bash + npm/scaffold/vite commands
  worker/bash-native.mjs   # just-bash IFileSystem adapter over workerd's native node:fs
  worker/vite-dev-probe.mjs# the in-child vite dev server (createServer, middleware mode, HMR over WebSocketPair)
  proof/session-transcript.json
```

## Caveats

- **Fork-binary dependency.** Requires the VFS-module-loading workerd fork
  (branch `feat/vfs-module-loading`), defaulted to `~/Development/workerd-vfs.bin`.
  Stock workerd will not work (no `vfsModuleFallback`, no `shareParentTmp`).
- **The full `npm install` is flaky / memory-hungry.** Small and medium installs
  are fast and reliable (verified: `left-pad`/`react`/`react-dom` in ~10s;
  `tailwindcss`+`autoprefixer`+`postcss` = 18 pkgs in ~10s). The **full
  `@netanelgilad/vite` + `@netanelgilad/rolldown` tree** is large and, under memory
  pressure, can SIGKILL the workerd child mid-install (surfaces as
  `[host error] TypeError: fetch failed`). If that happens: **retry when the
  machine is idle** with several GB of free RAM, and keep runs **serial** (don't
  run a second heavy workerd install concurrently). The REPL stays alive and prints
  the error rather than hanging; just re-issue `npm install`.
- The isolate's `/tmp` is **per-process** (not persisted to host disk), so you must
  run `npm install` in the same REPL session where you run `vite dev` — there is no
  cross-process pre-warm.

The full `install → vite build → vite dev → browser` loop on this exact stack is
captured (DOM-asserted, browser-driven) in
`../do-machine-clean/proof/browser-proof.json` — workerd-bash wires the same ops
behind an interactive shell.
