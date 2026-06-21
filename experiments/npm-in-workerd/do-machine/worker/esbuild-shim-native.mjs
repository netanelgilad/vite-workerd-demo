// do-machine esbuild shim: like harness/shims/esbuild.mjs, but backed by the child's
// NATIVE node:fs (which IS the shared /tmp) instead of the harness's memfs, and reading
// the wasm bytes from /tmp/proj/esbuild.wasm via native fs instead of fetching from a host
// service. Runs esbuild-wasm single-threaded (worker:false) on a precompiled wasm module
// via the UnsafeEval binding so vite's dep optimizer works inside the Worker-Loader child.
import * as nodeFs from "node:fs";
import path from "node:path";

import * as esbuild from "esbuild-wasm/esm/browser.js";

const fs = nodeFs;

let initPromise;
function ensureInit() {
  if (!initPromise) {
    initPromise = (async () => {
      const bytes = new Uint8Array(nodeFs.readFileSync("/tmp/proj/esbuild.wasm"));
      const wasmModule = globalThis.__UNSAFE_EVAL.newWasmModule(bytes);
      await esbuild.initialize({ wasmModule, worker: false });
    })().catch((e) => { initPromise = undefined; throw e; });
  }
  return initPromise;
}

const LOADERS = {
  ".js": "js", ".cjs": "js", ".mjs": "js", ".jsx": "jsx",
  ".ts": "ts", ".mts": "ts", ".cts": "ts", ".tsx": "tsx",
  ".json": "json", ".css": "css", ".txt": "text",
};

function resolveFileLike(abs) {
  const tryPaths = [abs, abs + ".js", abs + ".mjs", abs + ".cjs", abs + ".json",
    path.join(abs, "index.js"), path.join(abs, "index.mjs"), path.join(abs, "index.json")];
  for (const p of tryPaths) {
    try { if (fs.statSync(p).isFile()) return p; } catch {}
  }
  return null;
}

function resolveExportValue(v, conditions) {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    for (const c of [...conditions, "default"]) {
      if (c in v) {
        const r = resolveExportValue(v[c], conditions);
        if (r) return r;
      }
    }
  }
  return null;
}

function resolvePackage(pkgDir, subpath) {
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")); } catch { pkg = null; }
  const conditions = ["browser", "import", "require", "module"];
  if (pkg?.exports) {
    const key = subpath === "" ? "." : "./" + subpath;
    let entry = null;
    if (typeof pkg.exports === "string") entry = subpath === "" ? pkg.exports : null;
    else if (key in pkg.exports) entry = resolveExportValue(pkg.exports[key], conditions);
    else if (subpath === "" && !Object.keys(pkg.exports).some((k) => k.startsWith("."))) entry = resolveExportValue(pkg.exports, conditions);
    if (entry) {
      const r = resolveFileLike(path.join(pkgDir, entry));
      if (r) return r;
    }
  }
  if (subpath !== "") return resolveFileLike(path.join(pkgDir, subpath));
  if (pkg) {
    for (const f of ["module", "main"]) {
      if (pkg[f]) {
        const r = resolveFileLike(path.join(pkgDir, pkg[f]));
        if (r) return r;
      }
    }
  }
  return resolveFileLike(path.join(pkgDir, "index.js"));
}

function nativeFsPlugin() {
  return {
    name: "workerd-native-fs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const base = args.resolveDir && args.resolveDir !== "" ? args.resolveDir
          : args.importer ? path.dirname(args.importer) : "/tmp/proj";
        if (args.path.startsWith("./") || args.path.startsWith("../") || path.isAbsolute(args.path)) {
          const abs = path.isAbsolute(args.path) ? args.path : path.join(base, args.path);
          const r = resolveFileLike(abs);
          if (r) return { path: r };
          return undefined;
        }
        const parts = args.path.split("/");
        const pkgName = args.path.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
        const subpath = args.path.slice(pkgName.length).replace(/^\//, "");
        let dir = base;
        for (;;) {
          const pkgDir = path.join(dir, "node_modules", pkgName);
          let exists = false;
          try { exists = fs.statSync(pkgDir).isDirectory(); } catch {}
          if (exists) {
            const r = resolvePackage(pkgDir, subpath);
            if (r) return { path: r };
          }
          const parent = path.dirname(dir);
          if (parent === dir) break;
          dir = parent;
        }
        return undefined;
      });
      build.onLoad({ filter: /.*/ }, (args) => {
        let contents;
        try { contents = fs.readFileSync(args.path); } catch { return undefined; }
        return {
          contents,
          loader: LOADERS[path.extname(args.path)] ?? "js",
          resolveDir: path.dirname(args.path),
        };
      });
    },
  };
}

async function flushOutputFiles(result) {
  for (const f of result?.outputFiles ?? []) {
    fs.mkdirSync(path.dirname(f.path), { recursive: true });
    fs.writeFileSync(f.path, f.contents);
  }
}

function prepareOptions(options) {
  return {
    ...options,
    write: false,
    plugins: [...(options?.plugins ?? []), nativeFsPlugin()],
  };
}

export const version = esbuild.version;

export async function transform(input, options) {
  await ensureInit();
  return esbuild.transform(input, options);
}

export async function build(options) {
  await ensureInit();
  const result = await esbuild.build(prepareOptions(options));
  await flushOutputFiles(result);
  return result;
}

export async function context(options) {
  await ensureInit();
  const opts = prepareOptions(options);
  const ctx = await esbuild.context(opts);
  return {
    ...ctx,
    rebuild: async () => {
      const result = await ctx.rebuild();
      await flushOutputFiles(result);
      return result;
    },
    watch: ctx.watch?.bind(ctx),
    cancel: ctx.cancel?.bind(ctx),
    dispose: ctx.dispose?.bind(ctx),
    serve: ctx.serve?.bind(ctx),
  };
}

export async function formatMessages(messages, options) {
  await ensureInit();
  return esbuild.formatMessages(messages, options);
}
export async function analyzeMetafile(metafile, options) {
  await ensureInit();
  return esbuild.analyzeMetafile(metafile, options);
}
export default { version, transform, build, context, formatMessages, analyzeMetafile };
