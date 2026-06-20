# npm install in a Durable Object over workerd's NATIVE `node:fs` (no memfs)

Variant of the parent experiment that drops the in-heap **memfs** entirely and
uses workerd's own synchronous `node:fs` virtual filesystem, running inside a
**Durable Object** so `/tmp` persists across requests.

```bash
# run from the parent dir (experiments/npm-in-workerd)
node do-native-fs/run-install-do.mjs left-pad@1.3.0
node do-native-fs/run-install-do.mjs debug@4.3.4        # transitive: debug + ms
node do-native-fs/run-install-do.mjs react-dom@18.3.1   # full tree incl. a real .bin symlink
```

Each run makes **three separate requests** to one DO instance — `seed` (write
`package.json`), `install` (Arborist `reify()`), `ls` (list `node_modules`). That
`ls` finds what `install` wrote, and `install` finds what `seed` wrote, proving
the DO's native `/tmp` persists across requests.

## Why this matters

The parent experiment uses memfs because a **stateless** worker's native `/tmp`
is per-request (owned by the per-request `IoContext`). A **Durable Object** is one
long-lived isolate whose `IoContext` lives for the actor's lifetime, so its native
`/tmp` persists across requests — letting us delete the memfs shim and the
`fs`→memfs source rewrites and use the runtime's real, synchronous filesystem.

## What's different from the memfs variant

- `host-do.mjs`: the `fs`/`fs/promises` → memfs rewrite **and** 301 redirects are
  removed, so npm's `require('node:fs')` resolves to workerd's real `node:fs`.
  The non-fs workarounds are KEPT: `node:process`/`process` → `shims/process.cjs`
  (workerd segfaults on `require('node:process')` through the fallback) and the
  `@npmcli/agent` alias (its keepalive agent breaks `node:https.request`).
- `worker/driver-do.mjs`: the install logic runs inside a `NpmInstaller` Durable
  Object; **all** fs work is in the fetch handler (module-eval sees a different
  `/tmp`). Default export routes everything to `idFromName("singleton")`.

## Constraints discovered (native VFS vs memfs)

1. **`/usr` is read-only** — only `/tmp` (and `/dev`) are writable. The memfs
   variant seeded `/usr/bin/ldd` for libc detection; here we rely solely on the
   `process.report` stub so `npm-install-checks` returns `family=null`.
2. **Two workerd native-fs bugs in tar's async extraction** (the reason `reify()`
   hung), each isolated to a minimal repro:
   - `fs.writev(fd, buffers, undefined, cb)` — the callback never fires when
     `position` is literally `undefined` (works with `0`/`null`/3-arg).
   - In tar's concurrent async write pipeline, only the **first** file's
     `fs.write`/`fs.close` callback fires; the rest never complete (bytes land on
     disk, but tar's pending counter never reaches 0). Burst/standalone writes
     work — it's specific to tar's composed pipeline.
   **Workaround** (one source rewrite in `host-do.mjs`): route pacote's `#extract`
   through tar's **sync** unpack (`tar.x({ sync: true })` on a buffered tarball) —
   `writeSync`/`closeSync`, no async callbacks. These are upstream workerd bugs;
   fixes are being developed in our workerd fork.

## Verdict

memfs can be retired for this flow: Arborist resolves, fetches, extracts,
symlinks `.bin`, and writes a lockfile entirely on native `node:fs`, persisting
across requests inside a DO — with the one sync-extraction workaround and writes
confined to `/tmp`. Still effectively `--ignore-scripts` (no `child_process`).
