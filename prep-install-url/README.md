# `npm install` from a LOCAL HTTP URL inside the in-DO npm engine

Scratch copy of `experiments/npm-in-workerd/do-native-fs/`, extended to prove
that the in-Durable-Object npm engine (real `@npmcli/arborist` + `pacote` over
workerd's native `node:fs`) can install a package whose dependency is specified
as a **locally-hosted HTTP tarball URL** instead of a registry range.

This is the mechanism we'll use later to `npm install` a custom **vite-fork**
tarball that we host ourselves.

## TL;DR — it works

```bash
# run from this dir (a node_modules symlink -> the original experiment's deps is set up)
cd prep-install-url
node run-install-url.mjs            # installs is-odd@3.0.1 from a local http://127.0.0.1:<port>/pkg.tgz
```

Result (real output):

```
dependencies: { "is-odd": "http://127.0.0.1:<port>/pkg.tgz" }
=> installed: is-odd@3.0.1  (from the local URL)  +  is-number@6.0.0 (transitive, from registry)
=> /tmp/proj/node_modules/is-odd/{package.json,index.js,LICENSE,README.md}
=> tarball HTTP hits: 2     (manifest fetch + tarball fetch, both to our local server)
```

`is-odd`'s root tarball comes from our **local HTTP server**; its transitive
`is-number` dep is resolved from the **real registry** — they coexist in one
install. Each of seed / install / ls is a SEPARATE `dispatchFetch` to one
singleton DO, so a populated `/ls` also re-proves the DO's native `/tmp`
persists across requests.

## How a local-URL install works in this setup

1. **Host an npm tarball over plain HTTP.** `npm pack <pkg>` produces a `.tgz`
   (here `served-tarball/pkg.tgz` = `is-odd@3.0.1`). `run-install-url.mjs`
   stands up a one-route `node:http` server (`createServer`, port 0 = random)
   that serves those bytes at `http://127.0.0.1:<port>/pkg.tgz`.
2. **Seed a URL specifier.** The DO writes `package.json` with
   `dependencies: { "<name>": "http://127.0.0.1:<port>/pkg.tgz" }`. npm/pacote
   classify an `http(s)` value ending in a tarball as a **remote-tarball
   specifier** (handled by pacote's `RemoteFetcher`) — no registry lookup for
   that dep's *resolution*; the tarball IS the package.
3. **Arborist `reify()`** (inside the DO, over native `node:fs`) fetches the
   tarball over HTTP, reads its `package.json` for the manifest, resolves any
   transitive deps (from the registry), extracts everything into
   `/tmp/proj/node_modules`, and writes the lockfile.

To later install a custom **vite fork**: `npm pack` the fork (or build a `.tgz`),
serve it at a local URL, and set `dependencies: { "vite": "http://.../vite-fork.tgz" }`.
Same path.

## localhost reachability (the open question — answered)

**workerd reaches `127.0.0.1` over plain HTTP just fine.** Both `globalThis.fetch`
and `node:http.get` from inside the DO downloaded the full tarball (probed via
`/probe-fetch`). No TLS needed — we use `http:`. (HTTPS to a local self-signed
cert was not required and not attempted; plain `http:` is sufficient and is what
we'll use to host the vite-fork tarball locally.)

## workerd native-fs bugs hit on the URL path (and the two targeted workarounds)

The registry install path (the parent experiment) already worked. The URL path
exposed **two additional** workerd native-fs bugs, each isolated to a minimal
probe and worked around with a single targeted source rewrite in `host-do.mjs`
(no behavioral change to npm's logic):

1. **`fs.mkdtempSync(prefix)` returns `EINVAL` when `prefix` ends in `/`**
   (empty final path component). npm's `@npmcli/fs` `withTempDir` builds the
   template as `join(root + sep, tmpPrefix || '')`; for a remote-tarball
   manifest fetch `tmpPrefix` is empty, so the template ends in `/` and
   `mkdtemp` throws. Verified via `/probe-mkdtemp`:
   `/tmp/npmcache/tmp/` -> EINVAL, but `/tmp/npmcache/tmp/x` -> OK.
   **Fix:** rewrite `withTempDir` to default the prefix to a non-empty literal
   (`options.tmpPrefix || 'tmp-'`).

2. **`cacache.get.stream.byDigest()` hangs** — the content-addressable read
   stream never emits `end` in workerd (same class as the tar async-write bug
   the parent experiment hit). pacote's `tarballStream()` short-circuits to
   `#tarballFromCache()` (which calls that API) whenever `this.integrity &&
   this.resolved` are set; for a remote tarball the manifest fetch populates the
   cache AND sets `this.integrity`, so the subsequent `extract()` takes the
   cache-read path and hangs forever. Verified via `/probe-cacache` (manifest OK,
   `cacache.get.stream.byDigest` TIMEOUT). Re-downloading over HTTP works (a
   standalone `pacote.extract` = 2 server hits, via `/probe-pacote`).
   **Fix:** rewrite pacote's `tarballStream` to force `fromCache = null`
   (`false && ...`) so it always takes the online `fromResolved` path. Registry
   installs are unaffected (they re-download too; that stream works) — regression
   checked with a registry install of the same package.

Both are upstream workerd bugs; the rewrites here are demo-side shims pending
fork fixes (same posture as the parent experiment's tar sync-extract workaround,
which is also kept).

## Files

```
host-do.mjs            module-fallback host harness. Adds 2 source rewrites vs the
                       parent: @npmcli/fs withTempDir prefix + pacote tarballStream
                       cache-bypass. NPM_NM points at the original experiment's
                       node_modules; module/modulesRoot paths made absolute.
worker/driver-do.mjs   the NpmInstaller DO. /seed now accepts ?name=&url= for a
                       URL specifier (in addition to ?pkg= registry specifier).
                       Adds read-only probes: /probe-mkdtemp /probe-fetch
                       /probe-pacote /probe-cacache (used to localize the bugs).
run-install-url.mjs    serves served-tarball/pkg.tgz over local HTTP, then drives
                       reset -> seed(url) -> install -> ls against the DO.
served-tarball/pkg.tgz   is-odd@3.0.1, produced by `npm pack` (the URL-served root)
served-tarball/nodep.tgz is-number@7.0.0 (zero-dep tarball, isolates the URL path)
node_modules -> ../experiments/npm-in-workerd/node_modules   (symlink; this is a
                       scratch dir with no deps of its own)
```

## Reproduce

```bash
cd prep-install-url
# (node_modules symlink + served-tarball/*.tgz already in place)
node run-install-url.mjs               # is-odd@3.0.1 from local URL (root) + is-number (transitive)

# isolation probes (read-only, no install) via mf.dispatchFetch:
#   /probe-fetch?url=    — workerd fetch + node:http.get reach 127.0.0.1
#   /probe-mkdtemp       — which mkdtempSync prefixes EINVAL
#   /probe-pacote?url=   — pacote.manifest + pacote.extract from the URL (standalone)
#   /probe-cacache?url=  — cacache.get.stream.byDigest hang
```
