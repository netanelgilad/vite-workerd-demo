// SCRATCH (vfs-module-loading / exports+imports): install REAL vite@^8 and
// @vitejs/plugin-react into a DO's native /tmp via Arborist, then load a
// Worker-Loader CHILD that shares the DO's /tmp (shareParentTmp) and resolves
// modules from it (vfsModuleFallback). The child attempts `await import("vite")`
// (+ resolve @vitejs/plugin-react and vite's bin) to drive the C++ VFS module
// resolver -- specifically conditional exports/imports maps -- as far through
// vite's real module graph as possible.
//
// The DO's OWN npm machinery (Arborist) is loaded via miniflare's host module
// fallback (../do-native-fs/host-do.mjs). The CHILD's modules are resolved by
// workerd's native VFS fallback (the fork feature under test).
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

const CHILD_FLAGS = ["nodejs_compat", "nodejs_compat_v2", "experimental", "enable_nodejs_fs_module"];

// The child probes vite's module graph. It resolves+loads as much as it can and
// reports the FIRST error verbatim (resolution OR execution), plus how far it got.
function viteChild() {
  return {
    compatibilityDate: "2025-01-01",
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    mainModule: "main.js",
    // main.js re-exports the probe module which LIVES under /tmp/proj (written to disk by
    // the DO before load) so its bare specifiers resolve against /tmp/proj/node_modules.
    modules: {
      "main.js": `export { default } from "/tmp/proj/probe.mjs";`,
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
        const deps = {
          vite: url.searchParams.get("vite") ?? "^8",
          "@vitejs/plugin-react": url.searchParams.get("pr") ?? "*",
        };
        fs.mkdirSync(PROJ, { recursive: true });
        fs.mkdirSync(CACHE, { recursive: true });
        fs.writeFileSync(
          PROJ + "/package.json",
          JSON.stringify(
            { name: "scratch", version: "1.0.0", private: true, dependencies: deps },
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
        // Read vite's package.json exports for the record.
        let viteExports = null;
        try {
          const pj = JSON.parse(fs.readFileSync(PROJ + "/node_modules/vite/package.json", "utf8"));
          viteExports = { exports: pj.exports, main: pj.main, module: pj.module, type: pj.type };
        } catch (e) {
          viteExports = { error: String(e) };
        }
        return Response.json({ ok: true, op: "install", ms: Date.now() - t0, installed, viteExports });
      }

      if (url.pathname === "/run-child") {
        const viteMain = PROJ + "/node_modules/vite/package.json";
        if (!fs.existsSync(viteMain)) {
          return Response.json(
            { ok: false, error: "vite not installed; run /install first (did /tmp persist?)" },
            { status: 500 }
          );
        }
        // Write the probe module UNDER /tmp/proj so bare specifiers resolve against
        // /tmp/proj/node_modules (where vite was installed). The probe is an ESM module
        // with a default-exported WorkerEntrypoint class; main.js re-exports it.
        fs.writeFileSync(
          PROJ + "/probe.mjs",
          `
          import { WorkerEntrypoint } from "cloudflare:workers";
          import { createRequire } from "node:module";
          const require = createRequire("/tmp/proj/index.js");
          export default class extends WorkerEntrypoint {
            async probe() {
              const out = {};
              try {
                const vite = await import("vite");
                out.viteImport = "OK keys=" + Object.keys(vite).slice(0, 8).join(",");
              } catch (e) { out.viteImport = "ERR " + (e && e.stack ? e.stack : String(e)); }
              try {
                const pr = await import("@vitejs/plugin-react");
                out.pluginReact = "OK keys=" + Object.keys(pr).slice(0, 8).join(",");
              } catch (e) { out.pluginReact = "ERR " + (e && e.stack ? e.stack : String(e)); }
              try {
                const v = require("vite");
                out.viteRequire = "OK type=" + typeof v;
              } catch (e) { out.viteRequire = "ERR " + (e && e.stack ? e.stack : String(e)); }
              return out;
            }
          }
          `
        );
        const child = this.env.LOADER.get("vite-child", () => viteChild());
        const ep = child.getEntrypoint();
        const result = await ep.probe();
        return Response.json({ ok: true, op: "run-child", result });
      }

      if (url.pathname === "/diag") {
        const read = (p) => {
          try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return { error: String(e) }; }
        };
        const prRoot = PROJ + "/node_modules/@vitejs/plugin-react";
        const pr = read(prRoot + "/package.json");
        let dist = [];
        try { dist = fs.readdirSync(prRoot + "/dist"); } catch {}
        return Response.json({
          pluginReact: { type: pr.type, main: pr.main, module: pr.module, exports: pr.exports, dist },
        });
      }

      return new Response("ops: /install  /run-child  /diag", { status: 404 });
    } catch (e) {
      return Response.json(
        { ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 50) },
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
