// Worker-side driver: runs real npm's install engine (@npmcli/arborist) inside
// the isolate over an in-heap memfs, fetching from the real registry.
import { Buffer } from "node:buffer";

const ARBORIST = "/tmp/xnm/npm/node_modules/@npmcli/arborist/lib/index.js";

async function getFs() {
  return (await import("/tmp/shims/fs.mjs")).default;
}

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__wasmCompile = async (bytes) => env.UNSAFE_EVAL.newWasmModule(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  globalThis.__safeEval = (code) => env.UNSAFE_EVAL.eval(String(code));
  globalThis.__newFunction = (...args) => { const body = args.pop(); return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...args); };
}

// npm-install-checks' libc detection calls process.report.getReport(), which
// segfaults workerd. Stub it on every process object reachable (the global and
// the `node:process` module export are distinct in workerd).
async function patchProcessReport() {
  const stub = { excludeNetwork: true, getReport: () => ({ header: {}, sharedObjects: [] }) };
  const targets = new Set([process, globalThis.process]);
  try { const m = await import("node:process"); targets.add(m.default); targets.add(m); } catch {}
  for (const t of targets) {
    if (!t) continue;
    try { Object.defineProperty(t, "report", { configurable: true, value: stub }); } catch {}
  }
}

export default {
  async fetch(request, env, ctx) {
    globalThis.__WAIT_UNTIL = ctx?.waitUntil ? (p) => { try { ctx.waitUntil(p); } catch {} } : undefined;
    installGlobals(env);
    await patchProcessReport();
    const url = new URL(request.url);
    try {
      if (url.pathname === "/install") {
        const spec = url.searchParams.get("pkg") ?? "left-pad@1.3.0";
        const name = spec.replace(/@[^@]*$/, "") || spec;
        const range = spec.slice(name.length + 1) || "*";
        const projDir = "/tmp/proj";
        const cacheDir = "/tmp/npmcache";

        const fs = await getFs();
        fs.mkdirSync(projDir, { recursive: true });
        fs.mkdirSync(cacheDir, { recursive: true });
        // libc detection (npm-install-checks) reads /usr/bin/ldd; seed it so it
        // resolves "glibc" via memfs and never calls the crashing process.report.
        fs.mkdirSync("/usr/bin", { recursive: true });
        fs.writeFileSync("/usr/bin/ldd", "GNU C Library (glibc) stable release version 2.39\n");
        fs.writeFileSync(projDir + "/package.json", JSON.stringify({
          name: "scratch", version: "1.0.0", private: true,
          dependencies: { [name]: range },
        }, null, 2));

        const t0 = Date.now();
        const { default: Arborist } = await import(ARBORIST);
        const arb = new Arborist({
          path: projDir,
          cache: cacheDir,
          registry: "https://registry.npmjs.org/",
          ignoreScripts: true,
          audit: false,
          fund: false,
          progress: false,
          packumentCache: new Map(),
        });
        const tree = await arb.reify({ ignoreScripts: true, audit: false });

        // list what landed in node_modules
        let installed = [];
        try {
          installed = fs.readdirSync(projDir + "/node_modules").filter((n) => !n.startsWith("."));
        } catch {}
        const detail = {};
        for (const n of installed) {
          try { detail[n] = JSON.parse(fs.readFileSync(projDir + "/node_modules/" + n + "/package.json", "utf8")).version; } catch {}
        }
        return Response.json({
          ok: true, ms: Date.now() - t0, spec,
          rootChildren: tree?.children ? [...tree.children.keys()] : null,
          installed, detail,
        });
      }

      if (url.pathname === "/step") {
        // Granular localization: run reify in stages, each a separate dispatch,
        // to find which one segfaults workerd. ?n=1 load, 2 construct,
        // 3 buildIdealTree, 4 reify.
        const n = Number(url.searchParams.get("n") ?? 1);
        const spec = url.searchParams.get("pkg") ?? "left-pad@1.3.0";
        const name = spec.replace(/@[^@]*$/, "") || spec;
        const range = spec.slice(name.length + 1) || "*";
        const projDir = "/tmp/proj", cacheDir = "/tmp/npmcache";
        const fs = await getFs();
        fs.mkdirSync(projDir, { recursive: true });
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.mkdirSync("/usr/bin", { recursive: true });
        fs.writeFileSync("/usr/bin/ldd", "GNU C Library (glibc) stable release version 2.39\n");
        fs.writeFileSync(projDir + "/package.json", JSON.stringify({ name: "scratch", version: "1.0.0", private: true, dependencies: { [name]: range } }));
        const out = { n };
        const { default: Arborist } = await import(ARBORIST);
        out.loaded = true;
        if (n < 2) return Response.json(out);
        const arb = new Arborist({ path: projDir, cache: cacheDir, registry: "https://registry.npmjs.org/", ignoreScripts: true, audit: false, fund: false, progress: false, packumentCache: new Map() });
        out.constructed = true;
        if (n < 3) return Response.json(out);
        const ideal = await arb.buildIdealTree({ add: [`${name}@${range}`] });
        out.ideal = ideal?.children ? [...ideal.children.keys()] : null;
        if (n < 4) return Response.json(out);
        await arb.reify({ ignoreScripts: true, audit: false });
        out.reified = true;
        return Response.json(out);
      }

      if (url.pathname === "/req") {
        // import a single module path to isolate a crash
        const fs = await getFs();
        fs.mkdirSync("/usr/bin", { recursive: true });
        fs.writeFileSync("/usr/bin/ldd", "GNU C Library (glibc)\n");
        const p = url.searchParams.get("path");
        const m = await import(p);
        return Response.json({ ok: true, keys: Object.keys(m).slice(0, 8), default: typeof m.default });
      }

      if (url.pathname === "/spawn-demo") {
        // Proof: run a node program in-isolate the way a shimmed child_process
        // spawn would — fake argv/exit, capture stdout, share the memfs. This is
        // exactly the create-vite scaffolding mechanism (a node bin writing files).
        const argv = (url.searchParams.get("argv") ?? "my-app,react-ts").split(",");
        const file = "/tmp/shims/_scaffold.cjs";

        const stdout = [];
        const realExit = process.exit, realArgv = process.argv;
        const realLog = console.log, realWrite = process.stdout?.write;
        const ExitSignal = Symbol("exit");
        let exitCode = 0;
        process.exit = (c) => { exitCode = c ?? 0; throw ExitSignal; };
        console.log = (...a) => stdout.push(a.join(" "));
        if (process.stdout) process.stdout.write = (s) => (stdout.push(String(s)), true);
        process.argv = ["node", file, ...argv];
        try {
          await import(file); // the "child" runs here, in this isolate
        } catch (e) {
          if (e !== ExitSignal) { exitCode = 1; stdout.push("ERR " + (e?.message ?? e)); }
        } finally {
          process.exit = realExit; process.argv = realArgv; console.log = realLog;
          if (process.stdout && realWrite) process.stdout.write = realWrite;
        }

        // show what the "child" wrote into the shared memfs
        const fs = await getFs();
        const proj = "/tmp/" + argv[0];
        let tree = [];
        const walk = (d) => { for (const e of fs.readdirSync(d)) { const p = d + "/" + e; tree.push(p); try { if (fs.statSync(p).isDirectory()) walk(p); } catch {} } };
        try { walk(proj); } catch {}
        return Response.json({ ok: true, exitCode, stdout, wroteToMemfs: tree });
      }

      if (url.pathname === "/ls") {
        const fs = await getFs();
        const p = url.searchParams.get("p") ?? "/tmp/proj";
        let entries = [];
        try { entries = fs.readdirSync(p); } catch (e) { return Response.json({ ok: false, error: String(e) }); }
        return Response.json({ ok: true, p, entries });
      }

      return new Response("ops: /install?pkg=NAME@RANGE  /ls?p=PATH", { status: 404 });
    } catch (e) {
      return Response.json({ ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 30) }, { status: 500 });
    }
  },
};
