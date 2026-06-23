// STAGE 2 end-to-end driver: a Durable Object installs a REAL npm package
// (left-pad) into its native /tmp via @npmcli/arborist, then loads a
// Worker-Loader CHILD that shares the DO's /tmp (shareParentTmp) and resolves
// modules from it (vfsModuleFallback). The child require()s left-pad -- a bare
// specifier node-resolved entirely from /tmp/node_modules by our C++ VFS module
// fallback -- and returns lp("x", 5). This proves a child isolate runs a real
// npm-installed package loaded from the shared VFS.
//
// The DO's OWN npm machinery (Arborist) is loaded via miniflare's host module
// fallback (host-do.mjs), exactly like the proven do-native-fs experiment. The
// CHILD's modules, by contrast, are loaded by workerd's native VFS fallback
// (our fork feature) -- no host involvement.
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";

const ARBORIST = "/tmp/xnm/npm/node_modules/@npmcli/arborist/lib/index.js";
const PROJ = "/tmp/proj";
const CACHE = "/tmp/npmcache";

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__wasmCompile = async (bytes) =>
    env.UNSAFE_EVAL.newWasmModule(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  globalThis.__safeEval = (code) => env.UNSAFE_EVAL.eval(String(code));
  globalThis.__newFunction = (...args) => {
    const body = args.pop();
    return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...args);
  };
}

async function patchProcessReport() {
  const stub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };
  const targets = new Set([process, globalThis.process]);
  try {
    const m = await import("node:process");
    targets.add(m.default);
    targets.add(m);
  } catch {}
  for (const t of targets) {
    if (!t) continue;
    try {
      Object.defineProperty(t, "report", { configurable: true, value: stub });
    } catch {}
  }
}

// The child worker's source. It require()s left-pad by BARE specifier; our VFS
// module fallback walks node_modules from the require referrer (/tmp/proj/...).
const CHILD_FLAGS = ["nodejs_compat", "nodejs_compat_v2", "experimental", "enable_nodejs_fs_module"];

function leftPadChild() {
  return {
    compatibilityDate: "2025-01-01",
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    mainModule: "main.js",
    modules: {
      "main.js": `
        import { WorkerEntrypoint } from "cloudflare:workers";
        import { createRequire } from "node:module";
        // Root the bare-specifier node_modules walk at /tmp/proj, where left-pad
        // was installed (createRequire's referrer dir seeds the resolution base).
        const require = createRequire("/tmp/proj/index.js");
        export default class extends WorkerEntrypoint {
          run() {
            const lp = require("left-pad");
            return lp("x", 5);
          }
          // Also prove ESM dynamic import of the same package resolves.
          async runEsm() {
            const mod = await import("/tmp/proj/node_modules/left-pad/index.js");
            const lp = mod.default ?? mod;
            return lp("y", 4);
          }
        }
      `,
    },
  };
}

export class NpmChildRunner {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    installGlobals(this.env);
    await patchProcessReport();
    const fs = nodeFs;
    const url = new URL(request.url);
    try {
      if (url.pathname === "/install") {
        const spec = url.searchParams.get("pkg") ?? "left-pad@1.3.0";
        const name = spec.replace(/@[^@]*$/, "") || spec;
        const range = spec.slice(name.length + 1) || "*";
        fs.mkdirSync(PROJ, { recursive: true });
        fs.mkdirSync(CACHE, { recursive: true });
        fs.writeFileSync(
          PROJ + "/package.json",
          JSON.stringify(
            { name: "scratch", version: "1.0.0", private: true, dependencies: { [name]: range } },
            null,
            2
          )
        );
        const t0 = Date.now();
        const { default: Arborist } = await import(ARBORIST);
        const arb = new Arborist({
          path: PROJ,
          cache: CACHE,
          registry: "https://registry.npmjs.org/",
          ignoreScripts: true,
          audit: false,
          fund: false,
          progress: false,
          packumentCache: new Map(),
        });
        await arb.reify({ ignoreScripts: true, audit: false });
        let installed = [];
        try {
          installed = fs.readdirSync(PROJ + "/node_modules").filter((n) => !n.startsWith("."));
        } catch {}
        return Response.json({ ok: true, op: "install", ms: Date.now() - t0, installed });
      }

      if (url.pathname === "/run-child") {
        // Sanity: the package must be on disk (installed by a PRIOR request).
        const lpMain = PROJ + "/node_modules/left-pad/index.js";
        if (!fs.existsSync(lpMain)) {
          return Response.json(
            { ok: false, error: "left-pad not installed; run /install first (did /tmp persist?)" },
            { status: 500 }
          );
        }
        // Load the child that shares this DO's /tmp and resolves modules from it.
        const child = this.env.LOADER.get("left-pad-child", () => leftPadChild());
        const ep = child.getEntrypoint();
        const cjsResult = await ep.run();
        let esmResult = null;
        let esmError = null;
        try {
          esmResult = await ep.runEsm();
        } catch (e) {
          esmError = String(e);
        }
        return Response.json({
          ok: cjsResult === "    x",
          op: "run-child",
          cjsResult, // expected "    x"
          esmResult, // expected "   y"
          esmError,
        });
      }

      return new Response("ops: /install?pkg=  /run-child", { status: 404 });
    } catch (e) {
      return Response.json(
        { ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 40) },
        { status: 500 }
      );
    }
  }
}

export default {
  async fetch(request, env) {
    const id = env.RUNNER.idFromName("singleton");
    return env.RUNNER.get(id).fetch(request);
  },
};
