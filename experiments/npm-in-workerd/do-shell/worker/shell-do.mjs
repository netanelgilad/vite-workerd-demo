// Shell Durable Object: owns the shared native /tmp filesystem and runs
// just-bash as the shell over it. `npm install` and `vite build` are registered
// as just-bash commands.
//
// SPAWNING MODEL (see report): a Worker-Loader child CAN share the DO's /tmp
// (shareParentTmp:true, proven in m1-child-probe), but a child isolate has NO
// module fallback service and cannot import() from the native fs — so npm/vite
// (hundreds of modules) cannot be resolved inside a child. Therefore npm/vite
// run IN-PROCESS in the DO (the top-level worker, which DOES have the fallback)
// over the same shared /tmp. We still DEMONSTRATE a real sub-isolate that
// shares the /tmp via the `spawn` command (it runs an inline child that reads/
// writes the shared fs), so the "sub-isolate over one filesystem" capability is
// exercised end to end even though the heavy toolchain runs in-DO.
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";

const ARBORIST = "/tmp/xnm/npm/node_modules/@npmcli/arborist/lib/index.js";
const CACHE = "/tmp/npmcache";

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__wasmCompile = async (b) => env.UNSAFE_EVAL.newWasmModule(b instanceof Uint8Array ? b : new Uint8Array(b));
  globalThis.__safeEval = (code) => env.UNSAFE_EVAL.eval(String(code));
  globalThis.__newFunction = (...a) => { const body = a.pop(); return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...a); };
}

// npm-install-checks' libc probe calls process.report.getReport() -> segfault.
async function patchProcessReport() {
  const stub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };
  const targets = new Set([process, globalThis.process]);
  try { const m = await import("node:process"); targets.add(m.default); targets.add(m); } catch {}
  for (const t of targets) {
    if (!t) continue;
    try { Object.defineProperty(t, "report", { configurable: true, value: stub }); } catch {}
  }
}

// Inline child source used by the `spawn` shell command to prove a sub-isolate
// shares the DO's /tmp.
const SPAWN_CHILD_SRC = `
import * as cfs from "node:fs";
export default { async fetch(req) {
  const u = new URL(req.url);
  const op = u.searchParams.get("op");
  const p = u.searchParams.get("path");
  try {
    if (op === "read") return Response.json({ ok: true, content: cfs.readFileSync(p, "utf8") });
    if (op === "write") { cfs.writeFileSync(p, u.searchParams.get("data") ?? ""); return Response.json({ ok: true, wrote: p }); }
    if (op === "ls") return Response.json({ ok: true, entries: cfs.readdirSync(p) });
    return Response.json({ ok: false, error: "unknown op" });
  } catch (e) { return Response.json({ ok: false, error: String(e) }); }
}};
`;

async function npmInstall(specs, cwd) {
  await patchProcessReport();
  const fs = nodeFs;
  fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(CACHE, { recursive: true });
  // merge into existing package.json (or create one)
  let pkg = { name: "scratch", version: "1.0.0", private: true, dependencies: {} };
  try { pkg = JSON.parse(fs.readFileSync(cwd + "/package.json", "utf8")); pkg.dependencies ??= {}; } catch {}
  for (const spec of specs) {
    const name = spec.replace(/@[^@]*$/, "") || spec;
    const range = spec.slice(name.length + 1) || "*";
    pkg.dependencies[name] = range;
  }
  fs.writeFileSync(cwd + "/package.json", JSON.stringify(pkg, null, 2));
  const t0 = Date.now();
  const { default: Arborist } = await import(ARBORIST);
  const arb = new Arborist({
    path: cwd, cache: CACHE, registry: "https://registry.npmjs.org/",
    ignoreScripts: true, audit: false, fund: false, progress: false,
    packumentCache: new Map(),
  });
  await arb.reify({ ignoreScripts: true, audit: false });
  let installed = [];
  try { installed = fs.readdirSync(cwd + "/node_modules").filter((n) => !n.startsWith(".")); } catch {}
  return { ms: Date.now() - t0, installed, specs };
}

let bashInstance;
async function getBash(env) {
  if (bashInstance) return bashInstance;
  const { Bash, defineCommand } = await import("just-bash");
  const { NativeFsAdapter } = await import("/tmp/shims/bash-native.mjs");
  const bash = new Bash({ fs: new NativeFsAdapter(), cwd: "/tmp/proj", defenseInDepth: false });

  // npm install <pkg...>  — runs Arborist IN-PROCESS over the shared /tmp.
  const npm = defineCommand("npm", async (args, ctx) => {
    const cwd = ctx?.cwd || "/tmp/proj";
    if (args[0] === "install" || args[0] === "i" || args[0] === "add") {
      const specs = args.slice(1).filter((a) => !a.startsWith("-"));
      if (specs.length === 0) return { stdout: "", stderr: "npm install <pkg> required in this shell\n", exitCode: 1 };
      try {
        const r = await npmInstall(specs, cwd);
        return { stdout: `+ ${r.specs.join(" ")}\ninstalled ${r.installed.length} packages in ${r.ms}ms\n` +
          `node_modules: ${r.installed.join(", ")}\n`, stderr: "", exitCode: 0 };
      } catch (e) {
        return { stdout: "", stderr: `npm install failed: ${e?.stack ?? e}\n`, exitCode: 1 };
      }
    }
    if (args[0] === "ls") {
      try {
        const ns = nodeFs.readdirSync(cwd + "/node_modules").filter((n) => !n.startsWith("."));
        return { stdout: ns.join("\n") + "\n", stderr: "", exitCode: 0 };
      } catch { return { stdout: "(no node_modules)\n", stderr: "", exitCode: 0 }; }
    }
    return { stdout: "", stderr: `npm: only install/ls wired (got ${args.join(" ")})\n`, exitCode: 2 };
  });

  // spawn <op> <path> [data] — runs a REAL sub-isolate (Worker Loader,
  // shareParentTmp) that touches the DO's shared /tmp. Proves sub-isolate +
  // one-filesystem end to end.
  const spawn = defineCommand("spawn", async (args) => {
    const [op, p, data] = args;
    if (!op || !p) return { stdout: "", stderr: "usage: spawn <read|write|ls> <path> [data]\n", exitCode: 1 };
    try {
      const stub = env.LOADER.get("shell-spawn-child", () => ({
        compatibilityDate: "2026-06-01",
        compatibilityFlags: ["nodejs_compat", "enable_nodejs_fs_module"],
        allowExperimental: true,
        shareParentTmp: true,
        mainModule: "child.js",
        modules: { "child.js": SPAWN_CHILD_SRC },
      }));
      const qs = new URLSearchParams({ op, path: p, ...(data != null ? { data } : {}) });
      const res = await stub.getEntrypoint().fetch(new Request("http://child.local/?" + qs));
      const j = await res.json();
      return { stdout: `[sub-isolate] ${JSON.stringify(j)}\n`, stderr: "", exitCode: j.ok ? 0 : 1 };
    } catch (e) {
      return { stdout: "", stderr: `spawn failed: ${e}\n`, exitCode: 1 };
    }
  });

  // vite build — attempts an in-process build (see report for status).
  const vite = defineCommand("vite", async (args, ctx) => {
    return { stdout: "", stderr: "vite: not wired into the DO shell in this build (see report: needs the harness vite engine ported to native fs)\n", exitCode: 2 };
  });

  for (const c of [npm, spawn, vite]) bash.registerCommand(c);
  bashInstance = bash;
  return bash;
}

export class Shell {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    installGlobals(this.env);
    const url = new URL(request.url);
    const fs = nodeFs;

    if (url.pathname === "/init") {
      fs.mkdirSync("/tmp/proj", { recursive: true });
      return Response.json({ ok: true, cwd: "/tmp/proj" });
    }

    if (url.pathname === "/exec") {
      const body = await request.json();
      const bash = await getBash(this.env);
      const t0 = Date.now();
      try {
        const r = await bash.exec(body.cmd, { cwd: body.cwd || "/tmp/proj", ...(body.opts || {}) });
        return Response.json({ ok: true, ms: Date.now() - t0, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr });
      } catch (e) {
        return Response.json({ ok: false, error: String(e?.stack ?? e) }, { status: 500 });
      }
    }

    return new Response("ops: POST /exec {cmd}, GET /init", { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    return env.SHELL.get(env.SHELL.idFromName("singleton")).fetch(request);
  },
};
