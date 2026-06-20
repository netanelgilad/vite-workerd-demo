// POST-INSTALL TRANSFORM PASS (runs INSIDE the DO, over the shared native /tmp).
//
// This is the prompt's "make /tmp code workerd-ready" design: instead of doing
// source rewrites in the C++ VFS loader or in a host fallback service, we rewrite
// the .js/.mjs/.cjs files ON DISK under /tmp after npm install. Because the child
// isolate's native fs IS the shared /tmp, once these files are workerd-compatible
// the child loads already-baked code straight through workerd's native module
// system + the fork's VFS module fallback.
//
// The rewrites mirror harness/host.mjs's `rewriteSource` (the accumulated solution
// to every workerd-ism), applied per-file with the file's own absolute /tmp path
// baked in for import.meta.url / __dirname / __filename.
//
// This module runs in the DO (full nodejs_compat: node:fs, node:path), NOT in a
// child. It only needs node:fs + node:path.
import * as nodeFs from "node:fs";
import nodePath from "node:path";

// Mirror of host.mjs rewriteSource, but path-baking uses the file's REAL absolute
// /tmp path (no /tmp/app virt mapping -- native fs == /tmp here).
export function rewriteSource(src, absPath, format) {
  // import.meta.* -> baked literals (workerd gives import.meta.url === undefined).
  // Quote-guarded so string literals like "import.meta.url" in source survive.
  src = src.replace(
    /(?<!["'`\\])\bimport\.meta\.url\b(?!["'`])/g,
    JSON.stringify("file://" + absPath)
  );
  src = src.replace(
    /(?<!["'`\\])\bimport\.meta\.dirname\b(?!["'`])/g,
    JSON.stringify(nodePath.dirname(absPath))
  );
  src = src.replace(
    /(?<!["'`\\])\bimport\.meta\.filename\b(?!["'`])/g,
    JSON.stringify(absPath)
  );
  if (format === "cjs") {
    // CJS in workerd's module system may not define __dirname/__filename.
    // Guard against redeclaration (some bundles already declare them).
    if (!/\b(const|let|var)\s+__filename\b/.test(src)) {
      src =
        `const __filename = ${JSON.stringify(absPath)}, __dirname = ${JSON.stringify(
          nodePath.dirname(absPath)
        )};\n` + src;
    }
  }
  // Runtime wasm compilation is blocked outside UnsafeEval; route through globals
  // (the child installs __UNSAFE_EVAL / __wasmCompile in its main module).
  src = src.replaceAll("new WebAssembly.Module(", "globalThis.__UNSAFE_EVAL.newWasmModule(");
  src = src.replaceAll("WebAssembly.compile(", "globalThis.__wasmCompile(");
  // bare eval / new Function are code-generation, blocked outside UnsafeEval.
  src = src.replaceAll("(0,eval)", "(globalThis.__safeEval)");
  src = src.replaceAll("(0, eval)", "(globalThis.__safeEval)");
  src = src.replaceAll("new Function(", "globalThis.__newFunction(");
  // createRequire(x).resolve(name) -> worker-side helper (workerd require has no .resolve)
  src = src.replace(/createRequire[\w$]*\(([\w$]+)\)\.resolve\(/g, "globalThis.__requireResolve($1, ");
  // pathToFileURL(url)?t=Date.now() dynamic import -> import the path directly
  src = src.replace(
    /`\$\{pathToFileURL[\w$]*\(([\w$]+)\)\}\?t=\$\{Date\.now\(\)\}`/g,
    "$1"
  );
  return src;
}

function pkgTypeIsModule(file, fs) {
  let dir = nodePath.dirname(file);
  while (dir.length > 1) {
    const pj = nodePath.join(dir, "package.json");
    if (fs.existsSync(pj)) {
      try {
        return JSON.parse(fs.readFileSync(pj, "utf8")).type === "module";
      } catch {
        return false;
      }
    }
    dir = nodePath.dirname(dir);
  }
  return false;
}

function detectFormat(file, src, fs) {
  const ext = nodePath.extname(file);
  if (ext === ".mjs") return "esm";
  if (ext === ".cjs") return "cjs";
  if (pkgTypeIsModule(file, fs)) return "esm";
  if (
    /^\s*(export\s+(default|const|let|var|function|class|\{|\*)|import[\s{"'])/m.test(src) &&
    !/(?<![.\w$])(module\.exports|exports\.[A-Za-z_$])/.test(src)
  ) {
    return "esm";
  }
  return "cjs";
}

const SKIP_DIRS = new Set([".bin", ".cache", ".vite"]);

function* walkJs(dir, fs) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const name = String(e.name);
    const p = nodePath.join(dir, name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      yield* walkJs(p, fs);
    } else if (e.isFile()) {
      if (/\.(js|mjs|cjs)$/.test(name)) yield p;
    }
  }
}

// Transform every .js/.mjs/.cjs file under `root` in place. Idempotent-ish: we
// only mark files we touched. Returns stats.
export function transformTree(root, { fs = nodeFs } = {}) {
  let scanned = 0;
  let rewritten = 0;
  const touched = [];
  for (const file of walkJs(root, fs)) {
    scanned++;
    let src;
    try {
      src = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // Fast skip: only files containing a token we rewrite are worth touching.
    if (
      !/import\.meta\.(url|dirname|filename)|new WebAssembly\.Module\(|WebAssembly\.compile\(|\(0, ?eval\)|new Function\(|\.resolve\(|pathToFileURL/.test(
        src
      )
    ) {
      continue;
    }
    const format = detectFormat(file, src, fs);
    const out = rewriteSource(src, file, format);
    if (out !== src) {
      fs.writeFileSync(file, out);
      rewritten++;
      if (touched.length < 50) touched.push(file);
    }
  }
  return { scanned, rewritten, touched };
}
