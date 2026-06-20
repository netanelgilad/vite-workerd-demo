# do-shell — shell into a Durable Object over one shared native /tmp

A session Durable Object that owns a shared native `/tmp` filesystem, runs
**just-bash** as its shell, and where `npm install` runs over that shared `/tmp`.
A **real sub-isolate** (Worker Loader, `shareParentTmp:true`) is spawned by the
`spawn` command and proven to read/write the SAME `/tmp`.

Everything runs in **miniflare** driving the forked workerd binary with the
shared-`/tmp` feature: `MINIFLARE_WORKERD_PATH=/tmp/workerd-fork-shared-bin`
(`workerd 2026-06-20`).

## Run it

```bash
cd experiments/npm-in-workerd

# Interactive shell into the DO (milestone 5)
MINIFLARE_WORKERD_PATH=/tmp/workerd-fork-shared-bin node do-shell/repl.mjs
# then type, e.g.:  pwd | npm install left-pad | ls node_modules |
#                   echo hi > /tmp/proj/x | spawn read /tmp/proj/x | exit

# Scripted shell transcript
MINIFLARE_WORKERD_PATH=/tmp/workerd-fork-shared-bin node do-shell/run-shell.mjs \
  "npm install is-odd" "ls /tmp/proj/node_modules" \
  "echo seed > /tmp/proj/s.txt" "spawn read /tmp/proj/s.txt"

# Milestone-1 probes (shared /tmp + the module-fallback question)
MINIFLARE_WORKERD_PATH=/tmp/workerd-fork-shared-bin node do-shell/m1-host.mjs
MINIFLARE_WORKERD_PATH=/tmp/workerd-fork-shared-bin node do-shell/m1-host.mjs --fallback
```

## Files

- `worker/shell-do.mjs` — the Shell Durable Object. just-bash over native fs;
  `npm` (Arborist in-process) and `spawn` (sub-isolate) commands.
- `shell-host.mjs` — miniflare config: worker_loaders binding (`LOADER`) +
  module fallback service resolving npm + just-bash from disk.
- `shims/bash-native.mjs` — just-bash IFileSystem adapter over native `node:fs`.
- `repl.mjs` — interactive/scripted REPL ("shell into the DO").
- `run-shell.mjs` — scripted transcript runner.
- `worker/m1-child-probe.mjs` + `m1-host.mjs` — milestone-1 probe.
- `worker/m1b-tmp-import.mjs` — probe: can a child `import()` from native /tmp? (No.)

## What works

| # | Milestone | Status |
|---|-----------|--------|
| 1 | DO spawns Worker-Loader child with `shareParentTmp:true`; bidirectional shared `/tmp` in miniflare | ✅ |
| 2 | just-bash shell over native `/tmp` (`ls cat echo mkdir pwd`, pipes, redirects) | ✅ |
| 3 | `npm install <pkg>` in the shell → node_modules in the DO's shared `/tmp` | ✅ |
| 4 | `vite build` spawns a child over shared `/tmp` | ❌ not wired (see below) |
| 5 | Interactive REPL "shell into the DO" | ✅ |

## The critical unknown — answered

**Can a Worker-Loader-spawned CHILD resolve modules via miniflare's module
fallback service (the way the top-level worker does)? NO.**

- The JS `WorkerCode` struct (decoded from the binary's mangled symbol) has
  exactly 11 fields: `compatibilityDate, compatibilityFlags, allowExperimental,
  limits, mainModule, modules, env, globalOutbound, tails, streamingTails,
  shareParentTmp`. There is **no `moduleFallback` field** — the child cannot be
  pointed at a fallback service.
- Empirically: a child `import("left-pad")` (not in its inline `modules` map)
  fails with `No such module "left-pad"`, and the fallback service receives
  **zero** requests for it. The loaded isolate inherits no fallback.
- A child also **cannot `import()` a file path in the shared `/tmp`**
  (`import("/tmp/mod/hello.mjs")` → `No such module`). workerd's ESM loader
  resolves only against the isolate's module registry / fallback, never the
  native fs. So even code npm wrote to the shared `/tmp` is not importable by a
  child. (Probe: `worker/m1b-tmp-import.mjs`.)

**Consequence / chosen path:** npm (hundreds of modules) cannot run inside a
child isolate. So `npm install` runs **in-process in the DO** — the DO is the
top-level worker, which DOES have the fallback — over the DO's shared native
`/tmp` (reusing the proven do-native-fs Arborist + tar sync-extract approach).
The sub-isolate capability is still exercised end-to-end by the `spawn` command:
a real child isolate (`shareParentTmp:true`) reads/writes the same `/tmp` the
shell and npm use — proving "sub-isolate over one filesystem". The heavy
toolchain just isn't the thing running in the child.

## Why milestone 4 (vite) is not wired

The vite engine works inside workerd today (see `../../../harness`, `vite v8`
build of a React app). But that harness runs vite + rolldown over an in-heap
**memfs** volume: vite's `fs` import is aliased to memfs and rolldown's WASI
filesystem is `globalThis.__ROLLDOWN_FS = <memfs>`. Porting it onto the DO's
native shared `/tmp` requires (a) routing vite's fs to native `node:fs` (easy,
like npm), and (b) repointing rolldown's WASI preopen + the harness's
rolldown-readiness / WASI-pump globals at native `/tmp` (the hard part — needs
validation that the WASI shim behaves over workerd native fs). That is a
substantial, separate effort; not completed here. `rolldown.wasm` is copied into
`worker/` for whoever picks this up. The shell's `vite` command returns an
honest "not wired" message rather than faking it.
