# Rebuilding the single-threaded Rolldown wasm

`harness/worker/rolldown.wasm` (12 MB) is the prebuilt, single-threaded
`wasm32-wasip1` Rolldown binding that lets Vite 8 bundle inside workerd, which
has no threads. This directory holds the **source patches** that produce it, so
the binary is auditable and reproducible rather than an opaque blob.

Stock `@rolldown/browser` ships only as a threads-only `wasm32-wasip1-threads`
build (it spawns WASI worker threads via `worker_threads.Worker`, which workerd
stubs out). Making it run threadless is a 5-layer fix; layers 1–3 are Rust
(compiled *into* `rolldown.wasm`), layers 4–5 are JS (applied at install / already
vendored). Full rationale: [`../../docs/rolldown-fork-findings.md`](../../docs/rolldown-fork-findings.md).

## What's in `patches/`

| File | Layer | Target | What it does |
|---|---|---|---|
| `rolldown-singlethread.patch` | 1 (Rust) | Rolldown crates (8 files, +39 lines) | Target-gate wasm-incompatible tokio features (`rt-multi-thread`, `fs`, `signal`) off the wasm build; port the 2 exposed `tokio::fs::read` calls to `std::fs::read` under `cfg(target_family="wasm")`; add a `pump_async_runtime(budget)` `#[napi]` export the JS side drives cooperatively. |
| `napi-vendored-tokio_runtime.patch` | 2 (Rust) | vendored `napi` 3.9.1 | Replace the wasm async path `std::thread::spawn(block_on(...))` (panics threadless) with a non-parking cooperative pump: run futures on the current-thread runtime + a keepalive task so the scheduler never parks waiting for a waker that can't fire. |
| `napi-build-wasi.patch` | 3 (Rust) | vendored `napi-build` 2.3.2 | Link the **non-`mt`** emnapi static lib for non-threads `wasm32-wasip1` and skip the thread-only `emnapi_async_worker_*` exports. (This wiring is *why* upstream `@rolldown/browser` is threads-only.) |
| `patch-st-binding.py` | 5 (JS, **already applied**) | `@rolldown/browser` binding loader | Non-shared imported memory, workers forbidden, wasm injected as a precompiled `CompiledWasm` module, lazy in-handler instantiation, and the cooperative pump wrapper. **The result is already vendored at `harness/rolldown-shim/`** — you don't need to run this unless regenerating the shim from a fresh `@rolldown/browser`. |

Layer 4 (the emnapi / `@tybys` WASI JS glue) is **not** a static patch — it's
applied reproducibly at install by [`../patch-emnapi-wasi.mjs`](../patch-emnapi-wasi.mjs)
(the harness `postinstall`), because those files live in `node_modules`.

## Rebuilding `rolldown.wasm` (layers 1–3)

Requires the Rust toolchain and a Rolldown checkout — not done by `setup.sh`.

```bash
# 1. Rolldown crates
git clone https://github.com/rolldown/rolldown rolldown-fork-src
cd rolldown-fork-src
git apply /path/to/harness/rolldown-fork/patches/rolldown-singlethread.patch

# 2. vendor + patch napi and napi-build (versions per the patch headers:
#    napi 3.9.1, napi-build 2.3.2 — match whatever the Rolldown checkout resolves)
cp -r <napi-3.9.1>       vendored/napi
( cd vendored/napi       && patch -p1 < /path/to/.../napi-vendored-tokio_runtime.patch )
cp -r <napi-build-2.3.2> vendored/napi-build
( cd vendored/napi-build && patch -p1 < /path/to/.../napi-build-wasi.patch )

# 3. build the threadless wasm
rustup target add wasm32-wasip1
EMNAPI_LINK_DIR=<emnapi>/lib/wasm32-wasip1 \
  cargo build --target wasm32-wasip1 --profile release-wasi -p rolldown_binding
# strip → copy the result over harness/worker/rolldown.wasm
```

## Verify the binary still works

```bash
cd harness
npm run verify:build   # vite build in workerd, byte-compared to a host build
npm run dev            # dev server in workerd, with HMR
```
