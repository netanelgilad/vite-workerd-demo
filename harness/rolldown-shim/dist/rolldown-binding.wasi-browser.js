import {
  createOnMessage as __wasmCreateOnMessageForFsProxy,
  getDefaultContext as __emnapiGetDefaultContext,
  instantiateNapiModule as __emnapiInstantiateNapiModule,
  WASI as __WASI,
} from '@napi-rs/wasm-runtime'
import { memfs } from '@napi-rs/wasm-runtime/fs'


const __memfs = memfs()
export const __volume = __memfs.vol
export const __fs = globalThis.__ROLLDOWN_FS ?? __memfs.fs

const __wasi = new __WASI({
  version: 'preview1',
  fs: __fs,
  env: globalThis.__RD_ENV ?? {},
  preopens: {
    '/tmp': '/tmp',
  },
})

const __wasmUrl = new URL('WASM_PLACEHOLDER', import.meta.url).href
const __emnapiContext = __emnapiGetDefaultContext()


const __sharedMemory = new WebAssembly.Memory({
  initial: 2048,
  maximum: 65536,
})

let __napiInstance, __wasiModule, __napiModule;
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
      const __wasmFile = await (async () => {
        if (globalThis.__ROLLDOWN_WASM_BYTES) return globalThis.__ROLLDOWN_WASM_BYTES
        try { return await fetch(__wasmUrl).then((res) => res.arrayBuffer()) }
        catch { const { readFileSync } = await import('node:fs'); const { fileURLToPath } = await import('node:url'); return readFileSync(fileURLToPath(__wasmUrl)) }
      })();

      ;({
        instance: __napiInstance,
        module: __wasiModule,
        napiModule: __napiModule,
      } = await __emnapiInstantiateNapiModule(__wasmFile, {
        context: __emnapiContext,
        asyncWorkPoolSize: 0,
        wasi: __wasi,
        onCreateWorker() {
          globalThis.__THREAD_SPAWN_ATTEMPTS = (globalThis.__THREAD_SPAWN_ATTEMPTS || 0) + 1
          throw new Error('THREAD_SPAWN_ATTEMPTED #' + globalThis.__THREAD_SPAWN_ATTEMPTS)
        },
        overwriteImports(importObject) {
          importObject.env = {
            ...importObject.env,
            ...importObject.napi,
            ...importObject.emnapi,
            memory: __sharedMemory,
          }
          return importObject
        },
        beforeInit({ instance }) {
          for (const name of Object.keys(instance.exports)) {
            if (name.startsWith('__napi_register__')) {
              instance.exports[name]()
            }
          }
        },
      }))
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
      LegalCommentsMode = __napiModule.exports.LegalCommentsMode;
      minify = __napiModule.exports.minify;
      minifySync = __napiModule.exports.minifySync;
      Severity = __napiModule.exports.Severity;
      ParseResult = __napiModule.exports.ParseResult;
      ExportExportNameKind = __napiModule.exports.ExportExportNameKind;
      ExportImportNameKind = __napiModule.exports.ExportImportNameKind;
      ExportLocalNameKind = __napiModule.exports.ExportLocalNameKind;
      ImportNameKind = __napiModule.exports.ImportNameKind;
      parse = __napiModule.exports.parse;
      parseSync = __napiModule.exports.parseSync;
      rawTransferSupported = __napiModule.exports.rawTransferSupported;
      ResolverFactory = __napiModule.exports.ResolverFactory;
      EnforceExtension = __napiModule.exports.EnforceExtension;
      ModuleType = __napiModule.exports.ModuleType;
      sync = __napiModule.exports.sync;
      HelperMode = __napiModule.exports.HelperMode;
      isolatedDeclaration = __napiModule.exports.isolatedDeclaration;
      isolatedDeclarationSync = __napiModule.exports.isolatedDeclarationSync;
      moduleRunnerTransform = __napiModule.exports.moduleRunnerTransform;
      moduleRunnerTransformSync = __napiModule.exports.moduleRunnerTransformSync;
      transform = __napiModule.exports.transform;
      transformSync = __napiModule.exports.transformSync;
      BindingBundleEndEventData = __napiModule.exports.BindingBundleEndEventData;
      BindingBundleErrorEventData = __napiModule.exports.BindingBundleErrorEventData;
      BindingBundler = __napiModule.exports.BindingBundler;
      BindingCallableBuiltinPlugin = __napiModule.exports.BindingCallableBuiltinPlugin;
      BindingChunkingContext = __napiModule.exports.BindingChunkingContext;
      BindingDecodedMap = __napiModule.exports.BindingDecodedMap;
      BindingDevEngine = __napiModule.exports.BindingDevEngine;
      BindingLoadPluginContext = __napiModule.exports.BindingLoadPluginContext;
      BindingMagicString = __napiModule.exports.BindingMagicString;
      BindingModuleInfo = __napiModule.exports.BindingModuleInfo;
      BindingNormalizedOptions = __napiModule.exports.BindingNormalizedOptions;
      BindingOutputAsset = __napiModule.exports.BindingOutputAsset;
      BindingOutputChunk = __napiModule.exports.BindingOutputChunk;
      BindingPluginContext = __napiModule.exports.BindingPluginContext;
      BindingRenderedChunk = __napiModule.exports.BindingRenderedChunk;
      BindingRenderedChunkMeta = __napiModule.exports.BindingRenderedChunkMeta;
      BindingRenderedModule = __napiModule.exports.BindingRenderedModule;
      BindingSourceMap = __napiModule.exports.BindingSourceMap;
      BindingTransformPluginContext = __napiModule.exports.BindingTransformPluginContext;
      BindingWatcher = __napiModule.exports.BindingWatcher;
      BindingWatcherBundler = __napiModule.exports.BindingWatcherBundler;
      BindingWatcherChangeData = __napiModule.exports.BindingWatcherChangeData;
      BindingWatcherEvent = __napiModule.exports.BindingWatcherEvent;
      ParallelJsPluginRegistry = __napiModule.exports.ParallelJsPluginRegistry;
      ScheduledBuild = __napiModule.exports.ScheduledBuild;
      TraceSubscriberGuard = __napiModule.exports.TraceSubscriberGuard;
      TsconfigCache = __napiModule.exports.TsconfigCache;
      BindingAttachDebugInfo = __napiModule.exports.BindingAttachDebugInfo;
      BindingBuiltinPluginName = __napiModule.exports.BindingBuiltinPluginName;
      BindingChunkModuleOrderBy = __napiModule.exports.BindingChunkModuleOrderBy;
      BindingLogLevel = __napiModule.exports.BindingLogLevel;
      BindingPluginOrder = __napiModule.exports.BindingPluginOrder;
      BindingPropertyReadSideEffects = __napiModule.exports.BindingPropertyReadSideEffects;
      BindingPropertyWriteSideEffects = __napiModule.exports.BindingPropertyWriteSideEffects;
      BindingRebuildStrategy = __napiModule.exports.BindingRebuildStrategy;
      collapseSourcemaps = __napiModule.exports.collapseSourcemaps;
      enhancedTransform = __napiModule.exports.enhancedTransform;
      enhancedTransformSync = __napiModule.exports.enhancedTransformSync;
      FilterTokenKind = __napiModule.exports.FilterTokenKind;
      initTraceSubscriber = __napiModule.exports.initTraceSubscriber;
      registerPlugins = __napiModule.exports.registerPlugins;
      resolveTsconfig = __napiModule.exports.resolveTsconfig;
      shutdownAsyncRuntime = __napiModule.exports.shutdownAsyncRuntime;
      startAsyncRuntime = __napiModule.exports.startAsyncRuntime;
    })();
  }
  return __readyPromise;
}
globalThis.__ROLLDOWN_ENSURE_READY = __ensureReady;
export default __exportsHolder
export let LegalCommentsMode
export let minify
export let minifySync
export let Severity
export let ParseResult
export let ExportExportNameKind
export let ExportImportNameKind
export let ExportLocalNameKind
export let ImportNameKind
export let parse
export let parseSync
export let rawTransferSupported
export let ResolverFactory
export let EnforceExtension
export let ModuleType
export let sync
export let HelperMode
export let isolatedDeclaration
export let isolatedDeclarationSync
export let moduleRunnerTransform
export let moduleRunnerTransformSync
export let transform
export let transformSync
export let BindingBundleEndEventData
export let BindingBundleErrorEventData
export let BindingBundler
export let BindingCallableBuiltinPlugin
export let BindingChunkingContext
export let BindingDecodedMap
export let BindingDevEngine
export let BindingLoadPluginContext
export let BindingMagicString
export let BindingModuleInfo
export let BindingNormalizedOptions
export let BindingOutputAsset
export let BindingOutputChunk
export let BindingPluginContext
export let BindingRenderedChunk
export let BindingRenderedChunkMeta
export let BindingRenderedModule
export let BindingSourceMap
export let BindingTransformPluginContext
export let BindingWatcher
export let BindingWatcherBundler
export let BindingWatcherChangeData
export let BindingWatcherEvent
export let ParallelJsPluginRegistry
export let ScheduledBuild
export let TraceSubscriberGuard
export let TsconfigCache
export let BindingAttachDebugInfo
export let BindingBuiltinPluginName
export let BindingChunkModuleOrderBy
export let BindingLogLevel
export let BindingPluginOrder
export let BindingPropertyReadSideEffects
export let BindingPropertyWriteSideEffects
export let BindingRebuildStrategy
export let collapseSourcemaps
export let enhancedTransform
export let enhancedTransformSync
export let FilterTokenKind
export let initTraceSubscriber
export let registerPlugins
export let resolveTsconfig
export let shutdownAsyncRuntime
export let startAsyncRuntime
