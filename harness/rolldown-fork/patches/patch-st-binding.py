#!/usr/bin/env python3
"""Patch an @rolldown/browser dist into a single-threaded (no workers) binding
driving our forked wasm with the cooperative napi pump.

Usage: python3 patch-st-binding.py <dist-dir> <wasm-path>
- non-shared imported memory (the fork links non-threads emnapi)
- workers forbidden (onCreateWorker throws; counts attempts)
- wasm loaded from <wasm-path> (fetch in workerd via __ROLLDOWN_WASM_BYTES, fs on node)
- WASI filesystem injectable via globalThis.__ROLLDOWN_FS (defaults to memfs)
- every async binding export auto-driven by pumpAsyncRuntime until settled
"""
import sys

dist, wasm_path = sys.argv[1], sys.argv[2]
f = dist + "/rolldown-binding.wasi-browser.js"
s = open(f).read()

# 1. plain (non-shared) memory
s = s.replace("""const __sharedMemory = new WebAssembly.Memory({
  initial: 16384,
  maximum: 65536,
  shared: true,
})""", """const __sharedMemory = new WebAssembly.Memory({
  initial: 2048,
  maximum: 65536,
})""")
assert "shared: true" not in s

# 2. injectable WASI fs (host: node fs; workerd: the in-heap memfs instance)
old_fs = """export const { fs: __fs, vol: __volume } = memfs()

const __wasi = new __WASI({
  version: 'preview1',
  fs: __fs,
  preopens: {
    '/': '/',
  },
})"""
new_fs = """const __memfs = memfs()
export const __volume = __memfs.vol
export const __fs = globalThis.__ROLLDOWN_FS ?? __memfs.fs

const __wasi = new __WASI({
  version: 'preview1',
  fs: __fs,
  env: globalThis.__RD_ENV ?? {},
  preopens: {
    '/tmp': '/tmp',
  },
})"""
assert old_fs in s
s = s.replace(old_fs, new_fs)

# 3. wasm source: injected bytes (workerd) or file read (node)
old_load = "const __wasmFile = await fetch(__wasmUrl).then((res) => res.arrayBuffer())"
new_load = """const __wasmFile = await (async () => {
  if (globalThis.__ROLLDOWN_WASM_BYTES) return globalThis.__ROLLDOWN_WASM_BYTES
  try { return await fetch(__wasmUrl).then((res) => res.arrayBuffer()) }
  catch { const { readFileSync } = await import('node:fs'); const { fileURLToPath } = await import('node:url'); return readFileSync(fileURLToPath(__wasmUrl)) }
})()"""
assert old_load in s
s = s.replace(old_load, new_load)
s = s.replace("const __wasmUrl = new URL('./rolldown-binding.wasm32-wasi.wasm', import.meta.url).href",
              f"const __wasmUrl = new URL({wasm_path!r}, import.meta.url).href")

# 4. forbid workers
old_worker = s[s.index("  onCreateWorker() {"):s.index("    return worker\n  },") + len("    return worker\n  },")]
s = s.replace(old_worker, """  onCreateWorker() {
    globalThis.__THREAD_SPAWN_ATTEMPTS = (globalThis.__THREAD_SPAWN_ATTEMPTS || 0) + 1
    throw new Error('THREAD_SPAWN_ATTEMPTED #' + globalThis.__THREAD_SPAWN_ATTEMPTS)
  },""")
s = s.replace("asyncWorkPoolSize: 4", "asyncWorkPoolSize: 0")

# 5. LAZY instantiation. workerd evaluates a module's top-level await in
#    "global scope" even when the module is imported dynamically from a
#    handler — and crypto.getRandomValues / timers / IO are forbidden there.
#    The emnapi wasm instantiation does exactly those. So we hoist the
#    instantiation out of top-level await into an async __ensureReady() that
#    the driver calls from inside a request handler (where they're allowed).
import re

# 5a. defer __wasmFile + instantiation into an init function. Declare the
#     binding holders as mutable, move the two awaits into __doInit().
inst_start = s.index("const __wasmFile = await (async () => {")
inst_end = s.index("})\n", s.index("__emnapiInstantiateNapiModule(__wasmFile, {")) + len("})\n")
inst_block = s[inst_start:inst_end]
# turn `const { instance: __napiInstance, ... } = await __emnapiInstantiateNapiModule(...)`
# into an assignment to pre-declared `let`s
inst_body = inst_block.replace(
    "const {\n  instance: __napiInstance,\n  module: __wasiModule,\n  napiModule: __napiModule,\n} = await __emnapiInstantiateNapiModule(",
    ";({\n  instance: __napiInstance,\n  module: __wasiModule,\n  napiModule: __napiModule,\n} = await __emnapiInstantiateNapiModule(",
).replace("})\n", "}))\n", 1) if "const {\n  instance: __napiInstance," in inst_block else None
assert inst_body is not None, "instantiation destructure shape changed"
# terminate the __wasmFile IIFE so it doesn't merge with the next statement (ASI)
inst_body = inst_body.replace("  })()\n\n  ;(", "  })();\n\n  (", 1)
if "  })()\n\n  ;(" not in inst_block:
    inst_body = inst_body.replace("})()\n", "})();\n", 1)

# collect every `export const NAME = __napiModule.exports.NAME`
export_lines = re.findall(r"export const (\w+) = __napiModule\.exports\.\1\b", s)
assert export_lines, "no named exports found"

header = """let __napiInstance, __wasiModule, __napiModule;
let __readyPromise;
const __exportsHolder = {};
globalThis.__RD_DIAG = { calls: [], pumpIters: 0, active: 0 };
function __pumpUntil(promise) {
  let settled = false;
  globalThis.__RD_DIAG.active++;
  promise.then(() => { settled = true; }, () => { settled = true; });
  const loop = (async () => {
    while (!settled) {
      __napiModule.exports.pumpAsyncRuntime(512);
      globalThis.__RD_DIAG.pumpIters++;
      await new Promise((r) => setTimeout(r, 0));
    }
    globalThis.__RD_DIAG.active--;
  })();
  // register with the current request context so workerd keeps it alive
  // (and accounts for it) instead of orphaning cross-request work
  if (globalThis.__WAIT_UNTIL) globalThis.__WAIT_UNTIL(loop);
  return loop;
}
const __wrapResult = (v, label) => {
  const isP = v && typeof v.then === "function";
  const d = globalThis.__RD_DIAG;
  if (d.calls.length < 500) d.calls.push((label || "?") + (isP ? ":P" : ":s"));
  if (isP) __pumpUntil(v);
  return v;
};
function __ensureReady() {
  if (!__readyPromise) {
    __readyPromise = (async () => {
INST_BLOCK
      // pump-wrap every async export so callers don't have to drive the runtime
      for (const k of Object.getOwnPropertyNames(__napiModule.exports)) {
        const v = __napiModule.exports[k];
        if (typeof v !== "function") continue;
        if (v.prototype && Object.getOwnPropertyNames(v.prototype).some((m) => m !== "constructor")) {
          for (const m of Object.getOwnPropertyNames(v.prototype)) {
            if (m === "constructor") continue;
            const d = Object.getOwnPropertyDescriptor(v.prototype, m);
            if (d && typeof d.value === "function") {
              const orig = d.value;
              v.prototype[m] = function (...a) { return __wrapResult(orig.apply(this, a), k + "." + m); };
            }
          }
        } else if (k !== "pumpAsyncRuntime") {
          __napiModule.exports[k] = function (...a) { return __wrapResult(v.apply(this, a), k); };
        }
      }
      Object.assign(__exportsHolder, __napiModule.exports);
EXPORT_ASSIGN
    })();
  }
  return __readyPromise;
}
globalThis.__ROLLDOWN_ENSURE_READY = __ensureReady;
"""
# indent the moved instantiation block under the async IIFE
indented_inst = "\n".join(("      " + ln) if ln.strip() else ln for ln in inst_body.splitlines())
export_assign = "\n".join(f"      {n} = __napiModule.exports.{n};" for n in export_lines)
header = header.replace("INST_BLOCK", indented_inst).replace("EXPORT_ASSIGN", export_assign)

# remove the original top-level instantiation block, inject header in its place
s = s[:inst_start] + header + s[inst_end:]

# 5b. rewrite the export statements to mutable live bindings + lazy default
s = s.replace("export default __napiModule.exports", "export default __exportsHolder")
s = re.sub(r"export const (\w+) = __napiModule\.exports\.\1\b", r"export let \1", s)

open(f, "w").write(s)
print("patched (lazy)", f, "| named exports:", len(export_lines))
