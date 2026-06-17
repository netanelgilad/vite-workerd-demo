# Vite 8 (Rolldown) running single-threaded inside workerd — SOLVED

Companion to `README.md`. Goal: run **Vite 8**, whose bundler **Rolldown** ships
as a threads-only `wasm32-wasip1-threads` binary, inside **workerd**, which has
no threads. We patched the whole stack — Rolldown's Rust crates, a vendored
`napi` runtime, a vendored `napi-build`, the emnapi JS glue, and the `@tybys`
WASI shim — and got it working end to end.

## Status: ✅ WORKING

Verified on this machine, with a **single-threaded `wasm32-wasip1` Rolldown
(zero threads)** running inside workerd (via miniflare):

| Target | Result |
|---|---|
| **Vite 8 stock react-ts `vite build`** in workerd | ✅ **8/8 dist files byte-identical** to native-Rolldown host build; warm rebuild **~370 ms** |
| **Vite 8 modern app** (tailwindcss 3 + react-router 7 + @tanstack/react-query 5) in workerd | ✅ **4/4 byte-identical** (incl. 8 kB Tailwind CSS + 270 kB router/query bundle); warm rebuild **~840 ms** |
| **Vite 8 dev server** in workerd | ✅ full module graph serves 200 (incl. Rolldown-optimized deps) |
| Vite 7 path (esbuild-wasm + rollup-wasm) | ✅ still 8/8 — no regression |
| thread spawns during any of the above | **0** |

Rolldown is genuinely running as wasm in a V8 isolate, calling back into Vite's
JS plugins (`resolveId`/`load`/`transform`/`defer_sync_scan_data`) through a
cooperative single-threaded async bridge — no Web Workers, no SharedArrayBuffer
threads, no containers.

## The five-layer fix

### 1. Rolldown crates — `rolldown-singlethread.patch` (8 files, +39 lines)
- Target-gate wasm-incompatible tokio features (`fs`, `rt-multi-thread`,
  `signal`) to non-wasm in 4 crates; cargo unifies features across the graph so
  they leaked onto the wasm `tokio` build and tripped its `compile_error!`.
  Port the 2 exposed `tokio::fs::read` calls to `std::fs::read` under
  `#[cfg(target_family="wasm")]`.
- Add `pump_async_runtime(budget)` `#[napi]` export — the JS side calls it to
  cooperatively drive the runtime.

### 2. Vendored `napi` 3.9.1 — `napi-vendored-tokio_runtime.patch`
The published wasm async path `std::thread::spawn(block_on(...))` panics on
threadless wasm. Replaced with a **non-parking cooperative pump**:
- `execute_tokio_future` spawns onto the current-thread runtime instead of a
  thread.
- `pump_tokio_runtime(budget)` spawns a one-time always-ready **keepalive task**
  (so the scheduler never *parks* waiting for a waker that can't fire
  single-threaded → would deadlock), then drives `budget` cooperative ticks and
  returns control to the JS event loop.

### 3. Vendored `napi-build` 2.3.2 — `napi-build-wasi.patch`
Link the **non-`mt` emnapi** static lib for non-threads `wasm32-wasip1` (the
`-mt` build needs `__tls_*` symbols that only exist with shared memory) and skip
the thread-only `emnapi_async_worker_*` exports. This is the wiring napi-rs
ships only for `-threads`, which is *why* `@rolldown/browser` is threads-only.

### 4. emnapi JS glue + WASI shim — `harness/patch-emnapi-wasi.mjs` (idempotent)
Applied to `@emnapi/core`, `@emnapi/runtime`, `@tybys/wasm-util` (all gitignored):
- **TSFN mutex → advisory** (spin then proceed). Single-threaded, a contended
  lock is reentrancy, not contention; `Atomics.wait` would deadlock.
- **TSFN `cond.wait` → immediate return** (no signaler can run single-threaded).
- **Re-derive `Int32Array` views per use** in the TSFN enqueue/dispatch path
  (non-shared memory detaches cached views on grow → `Atomics.* on detached
  ArrayBuffer`).
- **`feature.setImmediate` → `globalThis.__EMNAPI_SCHED` (= `queueMicrotask`).**
  This was the final, decisive bug: **workerd's `setImmediate` *call* never
  returns when invoked from synchronous wasm execution inside our `block_on`
  pump.** `queueMicrotask` schedules without blocking and drains when the pump
  yields. Same redirect for the runtime's finalizer scheduler.
- **WASI `clock_time_get` → monotonically advancing**, and **`poll_oneoff`
  busy-sleep disabled**. workerd freezes `Date.now()`/`performance.now()` during
  synchronous execution (Spectre mitigation); the shim's
  `while (Date.now() < end) {}` sleep otherwise never terminates.

### 5. Binding loader — `harness/patch-st-binding.py`
- Non-shared imported memory; workers forbidden; wasm injected as a precompiled
  `CompiledWasm` module (workerd won't runtime-compile a 12 MB module).
- **Lazy in-handler instantiation.** workerd evaluates a dynamically-imported
  module's top-level `await` in "global scope", where `crypto.getRandomValues`
  (emnapi init) is forbidden. Instantiation is hoisted into `__ensureReady()`
  the driver calls from inside the request handler; Rolldown's JS chunks are
  imported after (live ESM bindings pick up the populated binding classes).
- The cooperative **pump wrapper**: every async binding export drives
  `pumpAsyncRuntime` until its promise settles.
- WASI preopen `/` → `/tmp` (memfs can't open the root dir as an fd).

## How the single-threaded async bridge works

1. Vite calls `bundler.write()` (one napi async call covering the whole build).
2. The wrapper sees a pending promise and starts the **pump**: repeatedly call
   `pumpAsyncRuntime(512)` then `await setTimeout(0)`.
3. `pumpAsyncRuntime` drives the current-thread tokio runtime for 512
   cooperative ticks (keepalive prevents parking), then returns.
4. When Rolldown's wasm needs a JS plugin hook, napi schedules the call via
   `queueMicrotask` (not workerd's blocking `setImmediate`) and the Rust future
   `await`s a oneshot channel — yielding, not blocking.
5. `await setTimeout(0)` between pumps lets the JS event loop run the
   microtask → the JS hook runs → resolves → the channel fires → next pump
   resumes the build. No thread ever blocks.

## Reproduce

```bash
# 1. fork + patches
cd rolldown-fork && git apply ../rolldown-singlethread.patch
cp -r <napi-3.9.x>       vendored/napi       && (cd vendored/napi && patch -p1 < ../../../napi-vendored-tokio_runtime.patch)
cp -r <napi-build-2.3.x> vendored/napi-build && (cd vendored/napi-build && patch -p1 < ../../../napi-build-wasi.patch)
rustup target add wasm32-wasip1
EMNAPI_LINK_DIR=<emnapi>/lib/wasm32-wasip1 \
  cargo build --target wasm32-wasip1 --profile release-wasi -p rolldown_binding   # -> 12 MB wasm (stripped)

# 2. harness JS patches (idempotent)
cd ../harness && npm install && node patch-emnapi-wasi.mjs

# 3. verify
SPIKE_VITE8=1 SPIKE_APP_DIR=../app          node run-verify.mjs     # ✅ 8/8 byte-identical
SPIKE_VITE8=1 SPIKE_APP_DIR=../app-modern8   node run-verify.mjs     # ✅ 4/4 byte-identical (tailwind+router+query)
SPIKE_VITE8=1 SPIKE_APP_DIR=../app          node run-dev-graph.mjs  # ✅ dev server module graph 200
SPIKE_APP_DIR=../app7                        node run-verify.mjs     # ✅ Vite 7 path, no regression
```

## Why this matters

This is, as far as we can tell, the first time Vite 8 / Rolldown has been run as
a single-threaded wasm inside a V8 isolate (workerd) with no Web Workers. It
removes the last blocker from `docs/plans/vite-in-isolates.md`: the build *and*
dev toolchain — Vite 7 (esbuild+rollup wasm) **and** Vite 8 (Rolldown wasm) —
now run inside an isolate, byte-identical to native, with no container and no
threads. The patches are small and upstreamable in spirit: Rolldown is +39
lines, and the rest is wiring napi-rs/emnapi for a single-threaded wasm target
that the ecosystem currently only builds for `-threads`.
