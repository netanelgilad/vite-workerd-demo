// Durable Object driver: runs real npm's install engine (@npmcli/arborist)
// inside a DO over workerd's NATIVE node:fs (no memfs). In a Durable Object the
// VFS /tmp persists across requests, so seed -> install -> ls can be separate
// dispatches and still see the same filesystem.
//
// CRITICAL: all filesystem work happens INSIDE the fetch handler. At module-eval
// time there is no active IoContext, so /tmp resolves to a DIFFERENT
// (isolate-level) directory than request code — touching /tmp at top level would
// be invisible to handlers.
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";

const ARBORIST = "/tmp/xnm/npm/node_modules/@npmcli/arborist/lib/index.js";
const PROJ = "/tmp/proj";
const CACHE = "/tmp/npmcache";

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__wasmCompile = async (bytes) => env.UNSAFE_EVAL.newWasmModule(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  globalThis.__safeEval = (code) => env.UNSAFE_EVAL.eval(String(code));
  globalThis.__newFunction = (...args) => { const body = args.pop(); return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...args); };
}

// npm-install-checks' libc detection calls process.report.getReport(), which
// segfaults workerd. Stub it on every reachable process object. (The memfs
// variant also seeded /usr/bin/ldd, but workerd's native VFS only allows writes
// under /tmp — /usr is read-only — so we rely solely on this stub, which makes
// getFamilyFromReport() return family=null without crashing.)
async function patchProcessReport() {
  const stub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };
  const targets = new Set([process, globalThis.process]);
  try { const m = await import("node:process"); targets.add(m.default); targets.add(m); } catch {}
  for (const t of targets) {
    if (!t) continue;
    try { Object.defineProperty(t, "report", { configurable: true, value: stub }); } catch {}
  }
}

function walk(fs, d, out = [], depth = 0) {
  let entries;
  try { entries = fs.readdirSync(d); } catch { return out; }
  for (const e of entries) {
    const p = d + "/" + e;
    let st;
    try { st = fs.lstatSync(p); } catch { out.push(p + " <stat-err>"); continue; }
    const kind = st.isSymbolicLink() ? "@" : st.isDirectory() ? "/" : "";
    out.push(p + kind);
    if (st.isDirectory() && !st.isSymbolicLink() && depth < 3) walk(fs, p, out, depth + 1);
  }
  return out;
}

export class NpmInstaller {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    installGlobals(this.env);
    await patchProcessReport();
    const fs = nodeFs; // workerd's native node:fs (no memfs)
    const url = new URL(request.url);
    try {
      if (url.pathname === "/seed") {
        const spec = url.searchParams.get("pkg") ?? "left-pad@1.3.0";
        const name = spec.replace(/@[^@]*$/, "") || spec;
        const range = spec.slice(name.length + 1) || "*";
        fs.mkdirSync(PROJ, { recursive: true });
        fs.mkdirSync(CACHE, { recursive: true });
        fs.writeFileSync(PROJ + "/package.json", JSON.stringify({
          name: "scratch", version: "1.0.0", private: true,
          dependencies: { [name]: range },
        }, null, 2));
        const readBack = fs.readFileSync(PROJ + "/package.json", "utf8");
        return Response.json({ ok: true, op: "seed", spec, pkgJson: JSON.parse(readBack) });
      }

      if (url.pathname === "/install") {
        // Prove the seed (written by a PRIOR request) persisted — native VFS in a DO.
        let seeded;
        try { seeded = fs.readFileSync(PROJ + "/package.json", "utf8"); }
        catch (e) { return Response.json({ ok: false, op: "install", error: "package.json not found — /tmp did NOT persist: " + e }, { status: 500 }); }

        const t0 = Date.now();
        const { default: Arborist } = await import(ARBORIST);
        const arb = new Arborist({
          path: PROJ, cache: CACHE, registry: "https://registry.npmjs.org/",
          ignoreScripts: true, audit: false, fund: false, progress: false,
          packumentCache: new Map(),
        });
        const tree = await arb.reify({ ignoreScripts: true, audit: false });

        let installed = [];
        try { installed = fs.readdirSync(PROJ + "/node_modules").filter((n) => !n.startsWith(".")); } catch {}
        const detail = {};
        for (const n of installed) {
          if (n.startsWith("@")) {
            try {
              for (const sub of fs.readdirSync(PROJ + "/node_modules/" + n)) {
                try { detail[n + "/" + sub] = JSON.parse(fs.readFileSync(PROJ + "/node_modules/" + n + "/" + sub + "/package.json", "utf8")).version; } catch {}
              }
            } catch {}
          } else {
            try { detail[n] = JSON.parse(fs.readFileSync(PROJ + "/node_modules/" + n + "/package.json", "utf8")).version; } catch {}
          }
        }
        return Response.json({
          ok: true, op: "install", ms: Date.now() - t0,
          seededPkg: JSON.parse(seeded),
          rootChildren: tree?.children ? [...tree.children.keys()] : null,
          installed, detail,
        });
      }

      if (url.pathname === "/ls") {
        const p = url.searchParams.get("p") ?? PROJ + "/node_modules";
        if (!fs.existsSync(p)) return Response.json({ ok: false, op: "ls", p, error: "path does not exist (did /tmp persist?)" });
        const tree = walk(fs, p);
        const bins = [];
        try {
          const binDir = p + "/.bin";
          if (fs.existsSync(binDir)) {
            for (const b of fs.readdirSync(binDir)) {
              let target = null, isLink = false;
              try { const st = fs.lstatSync(binDir + "/" + b); isLink = st.isSymbolicLink(); } catch {}
              if (isLink) { try { target = fs.readlinkSync(binDir + "/" + b); } catch {} }
              bins.push({ name: b, isSymlink: isLink, target });
            }
          }
        } catch {}
        return Response.json({ ok: true, op: "ls", p, count: tree.length, tree, bins });
      }

      if (url.pathname === "/reset") {
        try { fs.rmSync(PROJ, { recursive: true, force: true }); } catch {}
        try { fs.rmSync(CACHE, { recursive: true, force: true }); } catch {}
        return Response.json({ ok: true, op: "reset" });
      }

      return new Response("ops: /seed?pkg=  /install  /ls?p=  /reset", { status: 404 });
    } catch (e) {
      return Response.json({ ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 40) }, { status: 500 });
    }
  }
}

// Default export: routes every request to ONE DO instance ("singleton") so the
// VFS is shared across the separate seed/install/ls dispatches.
export default {
  async fetch(request, env) {
    const id = env.INSTALLER.idFromName("singleton");
    return env.INSTALLER.get(id).fetch(request);
  },
};
