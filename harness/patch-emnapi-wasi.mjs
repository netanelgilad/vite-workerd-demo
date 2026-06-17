// Reproducibly apply the single-threaded-workerd fixes to the emnapi JS glue
// and the @tybys WASI shim (both live in node_modules, which is gitignored).
// Idempotent: safe to re-run. Run from harness/ after `npm install`.
//
// These are the JS-side companions to the Rust/napi fork
// (rolldown-singlethread.patch + napi-vendored-*.patch). Together they let
// Rolldown's wasm run single-threaded inside workerd.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

let applied = 0;
const patch = (file, edits) => {
  if (!existsSync(file)) { console.warn("skip (missing):", file); return; }
  let s = readFileSync(file, "utf8");
  for (const [tag, from, to] of edits) {
    if (s.includes(to)) continue; // already applied
    if (!s.includes(from)) { console.warn(`  ! pattern not found [${tag}] in ${file}`); continue; }
    s = s.replace(from, to);
    applied++;
    console.log(`  ✓ ${tag}`);
  }
  writeFileSync(file, s);
};

// Blanket-redirect EVERY emnapiCtx.feature.setImmediate(...) call site to the
// host-provided scheduler. workerd's setImmediate blocks when called from
// synchronous wasm execution inside our block_on pump; the driver sets
// __EMNAPI_SCHED = queueMicrotask, which schedules without blocking.
const redirectSetImmediate = (file) => {
  if (!existsSync(file)) return;
  let s = readFileSync(file, "utf8");
  const needle = "emnapiCtx.feature.setImmediate(";
  const repl = "(globalThis.__EMNAPI_SCHED || emnapiCtx.feature.setImmediate)(";
  // skip if already redirected everywhere
  const remaining = s.split(needle).length - 1;
  const alreadyDone = s.split(repl).length - 1;
  if (remaining === alreadyDone) { return; } // every site already wrapped
  const n = s.split(needle).length - 1;
  s = s.split(needle).join(repl);
  // the join above also rewrites the already-wrapped ones' inner needle harmlessly? no:
  // `(globalThis... || emnapiCtx.feature.setImmediate)(` contains the needle once; guard:
  writeFileSync(file, s);
  applied += n;
  console.log(`  ✓ setImmediate->sched x${n} in ${file.split("/").pop()}`);
};

// ── @emnapi/core ────────────────────────────────────────────────────────────
// 1. TSFN mutex: advisory (no Atomics.wait deadlock). On one thread a contended
//    lock is reentrancy, not contention; blocking would deadlock.
// 2. TSFN cond.wait: return immediately (no signaler can run single-threaded).
// 3. Re-derive Int32Array views per use in enqueue/dispatch (non-shared memory
//    detaches cached views on grow).
// 4. feature.setImmediate → globalThis.__EMNAPI_SCHED (workerd's setImmediate
//    blocks when called from synchronous wasm execution inside our block_on
//    pump; the driver sets __EMNAPI_SCHED = queueMicrotask).
const core = "node_modules/@emnapi/core/dist/emnapi-core.mjs";
patch(core, [
  ["mutex.lock advisory",
`                        else {
                            while (true) {
                                var oldValue = Atomics.compareExchange(i32a, 0, 0, 10);
                                if (oldValue === 0) {
                                    return;
                                }
                                Atomics.wait(i32a, 0, 10);
                            }
                        }`,
`                        else {
                            // single-threaded wasm: a failed acquire is reentrancy,
                            // not contention. Blocking (Atomics.wait) would deadlock
                            // the only thread. Spin briefly for an in-flight unlock,
                            // then proceed (advisory lock).
                            var __spins = 0;
                            while (true) {
                                var oldValue = Atomics.compareExchange(i32a, 0, 0, 10);
                                if (oldValue === 0) {
                                    return;
                                }
                                if (++__spins > 1000) {
                                    return;
                                }
                            }
                        }`],
  ["cond.wait non-blocking",
`                    wait: function () {
                        var i32a = new Int32Array(wasmMemory.buffer, index, 1);
                        var value = Atomics.load(i32a, 0);
                        mutex.unlock();
                        Atomics.wait(i32a, 0, value);
                        mutex.lock();
                    },`,
`                    wait: function () {
                        // single-thread: a real cond wait blocks the only thread
                        // forever (no signaler). Return immediately; callers re-check
                        // their predicate under the cooperative pump.
                        var i32a = new Int32Array(wasmMemory.buffer, index, 1);
                        Atomics.load(i32a, 0);
                        mutex.unlock();
                        mutex.lock();
                    },`],
  ["enqueue re-derive views",
`            enqueue: function (func) {
                var pending = func + emnapiTSFN.offset.async_pending;
                var scheduled = func + emnapiTSFN.offset.async_u_fd;
                var i32a = new Int32Array(wasmMemory.buffer);
                if (Atomics.exchange(i32a, scheduled >>> 2, 1) !== 0) {
                    return;
                }
                emnapiCtx.feature.setImmediate(function () {
                    if (!emnapiTSFN._liveSet.has(func)) {
                        return;
                    }
                    if (Atomics.load(i32a, pending >>> 2) === 0) {
                        Atomics.store(i32a, scheduled >>> 2, 0);
                        return;
                    }
                    emnapiCtx.feature.setImmediate(function () {
                        try {
                            if (Atomics.exchange(i32a, pending >>> 2, 0) === 0) {
                                return;
                            }
                            if (!emnapiTSFN._liveSet.has(func)) {
                                return;
                            }
                            emnapiTSFN.dispatch(func);
                        }
                        finally {
                            if (emnapiTSFN._liveSet.has(func)) {
                                Atomics.store(i32a, scheduled >>> 2, 0);
                                if (Atomics.load(i32a, pending >>> 2) !== 0) {
                                    emnapiTSFN.enqueue(func);
                                }
                            }
                        }
                    });
                });
            },`,
`            enqueue: function (func) {
                var pending = func + emnapiTSFN.offset.async_pending;
                var scheduled = func + emnapiTSFN.offset.async_u_fd;
                var view = function () { return new Int32Array(wasmMemory.buffer); };
                if (Atomics.exchange(view(), scheduled >>> 2, 1) !== 0) {
                    return;
                }
                emnapiCtx.feature.setImmediate(function () {
                    if (!emnapiTSFN._liveSet.has(func)) {
                        return;
                    }
                    if (Atomics.load(view(), pending >>> 2) === 0) {
                        Atomics.store(view(), scheduled >>> 2, 0);
                        return;
                    }
                    emnapiCtx.feature.setImmediate(function () {
                        try {
                            if (Atomics.exchange(view(), pending >>> 2, 0) === 0) {
                                return;
                            }
                            if (!emnapiTSFN._liveSet.has(func)) {
                                return;
                            }
                            emnapiTSFN.dispatch(func);
                        }
                        finally {
                            if (emnapiTSFN._liveSet.has(func)) {
                                Atomics.store(view(), scheduled >>> 2, 0);
                                if (Atomics.load(view(), pending >>> 2) !== 0) {
                                    emnapiTSFN.enqueue(func);
                                }
                            }
                        }
                    });
                });
            },`],
  ["dispatch re-derive view",
`            dispatch: function (func) {
                var has_more = true;
                var iterations_left = 1000;
                var ui32a = new Uint32Array(wasmMemory.buffer);
                var index = (func + emnapiTSFN.offset.dispatch_state) >>> 2;
                while (has_more && --iterations_left !== 0) {
                    Atomics.store(ui32a, index, 1);
                    has_more = emnapiTSFN.dispatchOne(func);
                    if (Atomics.exchange(ui32a, index, 0) !== 1) {
                        has_more = true;
                    }
                }`,
`            dispatch: function (func) {
                var has_more = true;
                var iterations_left = 1000;
                var ui32a = function () { return new Uint32Array(wasmMemory.buffer); };
                var index = (func + emnapiTSFN.offset.dispatch_state) >>> 2;
                while (has_more && --iterations_left !== 0) {
                    Atomics.store(ui32a(), index, 1);
                    has_more = emnapiTSFN.dispatchOne(func);
                    if (Atomics.exchange(ui32a(), index, 0) !== 1) {
                        has_more = true;
                    }
                }`],
]);

redirectSetImmediate(core);

// ── @emnapi/runtime: finalizer scheduler ─────────────────────────────────────
const rt = "node_modules/@emnapi/runtime/dist/emnapi.mjs";
patch(rt, [
  ["runtime _setImmediate -> sched",
`const _setImmediate = typeof setImmediate === 'function'
    ? setImmediate
    : function (callback) {`,
`const _setImmediate = (typeof globalThis !== 'undefined' && globalThis.__EMNAPI_SCHED)
    ? ((cb) => globalThis.__EMNAPI_SCHED(cb))
    : typeof setImmediate === 'function'
    ? setImmediate
    : function (callback) {`],
]);

// ── @tybys/wasm-util: WASI shim ──────────────────────────────────────────────
// workerd freezes Date.now()/performance.now() during synchronous execution
// (Spectre mitigation): the busy-sleep in poll_oneoff never terminates, and any
// deadline logic stalls. Make the clock advance and drop the busy-sleep.
const wasi = "node_modules/@tybys/wasm-util/lib/mjs/wasi/preview1.mjs";
patch(wasi, [
  ["clock advancing",
`            const { view } = getMemory(this);
            switch (id) {
                case WasiClockid.REALTIME:
                    view.setBigUint64(time, BigInt(Date.now()) * BigInt(1000000), true);
                    return WasiErrno.ESUCCESS;
                case WasiClockid.MONOTONIC:
                case WasiClockid.PROCESS_CPUTIME_ID:
                case WasiClockid.THREAD_CPUTIME_ID: {
                    const t = performance.now() / 1000;
                    const s = Math.trunc(t);
                    const ms = Math.floor((t - s) * 1000);
                    const result = BigInt(s) * BigInt(1000000000) + BigInt(ms) * BigInt(1000000);
                    view.setBigUint64(time, result, true);
                    return WasiErrno.ESUCCESS;
                }
                default: return WasiErrno.EINVAL;
            }`,
`            const { view } = getMemory(this);
            // workerd freezes the clock during synchronous execution; keep a
            // monotonically advancing counter so the wasm always sees time move.
            const __adv = () => {
                const base = BigInt(Date.now()) * BigInt(1000000);
                const prev = globalThis.__WASI_CLOCK_NS || BigInt(0);
                const next = base > prev ? base : (prev + BigInt(1000000));
                globalThis.__WASI_CLOCK_NS = next;
                return next;
            };
            switch (id) {
                case WasiClockid.REALTIME:
                case WasiClockid.MONOTONIC:
                case WasiClockid.PROCESS_CPUTIME_ID:
                case WasiClockid.THREAD_CPUTIME_ID: {
                    view.setBigUint64(time, __adv(), true);
                    return WasiErrno.ESUCCESS;
                }
                default: return WasiErrno.EINVAL;
            }`],
  ["poll_oneoff no busy-sleep",
`            if (has_timeout) {
                const delay = Number(min_timeout / BigInt(1000000));
                // if (isMainThread || typeof SharedArrayBuffer !== 'function') {
                sleepBreakIf(delay, () => false);
                // } else {`,
`            if (has_timeout) {
                const delay = Number(min_timeout / BigInt(1000000));
                // workerd freezes Date.now() during sync execution: a busy
                // \`while (Date.now() < end)\` sleep would never terminate. Report
                // the timeout as immediately elapsed; real time advances between
                // the host driver's cooperative ticks.
                if (!globalThis.__WASI_NO_BUSY_SLEEP) {
                  sleepBreakIf(delay, () => false);
                }
                // } else {`],
]);

console.log(`\npatch-emnapi-wasi: ${applied} edit(s) applied.`);

// ── rolldown shim package ────────────────────────────────────────────────────
// npm prunes node_modules/rolldown (not in package.json); recreate it from the
// in-repo single-threaded shim so the module fallback service resolves
// `rolldown` (and its subpath exports) to our wasm binding.
import { cpSync, rmSync } from "node:fs";
{
  const dst = "node_modules/rolldown";
  try { rmSync(dst, { recursive: true, force: true }); } catch {}
  cpSync("rolldown-shim", dst, { recursive: true });
  console.log("  ✓ node_modules/rolldown <- rolldown-shim");
  applied++;
}
