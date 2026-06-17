// Shim served in place of the `esbuild` package inside workerd.
// Backs the esbuild API with esbuild-wasm running single-threaded
// (worker: false) on a precompiled wasm module via the UnsafeEval binding.
//
// esbuild-wasm's browser build has no filesystem, but vite's dep optimizer
// expects native-fs resolution, loads, and an outdir write. We bridge all
// three to the in-heap memfs: a catch-all resolve/load plugin appended after
// vite's own plugins, write:false forced, and outputFiles flushed to memfs.
import path from "node:path";

import * as esbuild from "esbuild-wasm/esm/browser.js";

async function getFs() {
  return (await import("/tmp/shims/fs.mjs")).default;
}

let initPromise;
function ensureInit() {
  if (!initPromise) {
    initPromise = (async () => {
      const res = await globalThis.__HOST.fetch("http://host/esbuild.wasm");
      if (!res.ok) throw new Error("esbuild.wasm fetch failed: " + res.status);
      const bytes = new Uint8Array(await res.arrayBuffer());
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

function resolveFileLike(fs, abs) {
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

function resolvePackage(fs, pkgDir, subpath) {
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
      const r = resolveFileLike(fs, path.join(pkgDir, entry));
      if (r) return r;
    }
  }
  if (subpath !== "") return resolveFileLike(fs, path.join(pkgDir, subpath));
  if (pkg) {
    for (const f of ["module", "main"]) {
      if (pkg[f]) {
        const r = resolveFileLike(fs, path.join(pkgDir, pkg[f]));
        if (r) return r;
      }
    }
  }
  return resolveFileLike(fs, path.join(pkgDir, "index.js"));
}

function memfsPlugin(fs) {
  return {
    name: "workerd-memfs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const base = args.resolveDir && args.resolveDir !== "" ? args.resolveDir
          : args.importer ? path.dirname(args.importer) : "/tmp/app";
        if (args.path.startsWith("./") || args.path.startsWith("../") || path.isAbsolute(args.path)) {
          const abs = path.isAbsolute(args.path) ? args.path : path.join(base, args.path);
          const r = resolveFileLike(fs, abs);
          if (r) return { path: r };
          return undefined;
        }
        // bare specifier: walk node_modules upwards in memfs
        const parts = args.path.split("/");
        const pkgName = args.path.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
        const subpath = args.path.slice(pkgName.length).replace(/^\//, "");
        let dir = base;
        for (;;) {
          const pkgDir = path.join(dir, "node_modules", pkgName);
          let exists = false;
          try { exists = fs.statSync(pkgDir).isDirectory(); } catch {}
          if (exists) {
            const r = resolvePackage(fs, pkgDir, subpath);
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

async function flushOutputFiles(fs, result) {
  for (const f of result?.outputFiles ?? []) {
    fs.mkdirSync(path.dirname(f.path), { recursive: true });
    fs.writeFileSync(f.path, f.contents);
  }
}

async function prepareOptions(options) {
  const fs = await getFs();
  return {
    fs,
    opts: {
      ...options,
      write: false,
      plugins: [...(options?.plugins ?? []), memfsPlugin(fs)],
    },
  };
}

export const version = esbuild.version;

export async function transform(input, options) {
  await ensureInit();
  return esbuild.transform(input, options);
}

export async function build(options) {
  await ensureInit();
  const { fs, opts } = await prepareOptions(options);
  const result = await esbuild.build(opts);
  await flushOutputFiles(fs, result);
  return result;
}

export async function context(options) {
  await ensureInit();
  const { fs, opts } = await prepareOptions(options);
  const ctx = await esbuild.context(opts);
  return {
    ...ctx,
    rebuild: async () => {
      const result = await ctx.rebuild();
      await flushOutputFiles(fs, result);
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
