// Worker-side driver: populates the in-heap memfs from the host manifest,
// then runs Vite's JS API (build / dev server) entirely inside the isolate.
import { Buffer } from "node:buffer";
import path from "node:path";

// single-threaded rolldown fork, precompiled by workerd at config load
import rolldownWasmModule from "./rolldown.wasm";

let vfsReady = false;
let devServer; // vite dev server (middleware mode), kept across requests

async function getFs() {
  return (await import("/tmp/shims/fs.mjs")).default;
}

async function ensureVfs(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__HOST = env.HOST;
  globalThis.__wasmCompile = async (bytes) => env.UNSAFE_EVAL.newWasmModule(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  globalThis.__safeEval = (code) => env.UNSAFE_EVAL.eval(String(code));
  globalThis.__newFunction = (...args) => {
    const body = args.pop();
    return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...args);
  };
  // require.resolve replacement for fallback-served code (see host rewrite):
  // absolute virtual paths and bare specifiers pass through to import(), where
  // the module fallback service does the real resolution.
  globalThis.__requireResolve = (base, spec) => {
    if (spec.startsWith("file://")) spec = spec.slice("file://".length);
    if (spec.startsWith("./") || spec.startsWith("../")) {
      const baseDir = path.dirname(String(base).startsWith("file://") ? String(base).slice("file://".length) : String(base));
      return path.join(baseDir, spec);
    }
    return spec;
  };
  if (vfsReady) return { files: 0, ms: 0, cached: true };
  const fs = await getFs();
  // single-threaded rolldown wasm: its WASI filesystem is THE in-heap memfs
  // (same volume vite uses), and the module arrives precompiled via UnsafeEval
  if (globalThis.__VITE8) {
    globalThis.__WASI_NO_BUSY_SLEEP = true;
    globalThis.__TSFN_LOG = false;
    globalThis.__EMNAPI_SCHED = (cb) => queueMicrotask(cb);
    globalThis.__RD_ENV = { RD_LOG: env.RD_LOG ?? "", RD_LOG_OUTPUT: "readable" };
    globalThis.__ROLLDOWN_FS = fs;
    globalThis.__ROLLDOWN_WASM_BYTES = rolldownWasmModule;
  }
  const t0 = Date.now();
  const res = await env.HOST.fetch("http://host/manifest");
  if (!res.ok) throw new Error("manifest fetch failed: " + res.status);
  const manifest = await res.json();
  let files = 0;
  const dirs = new Set();
  for (const [p, b64] of Object.entries(manifest)) {
    const dir = path.dirname(p);
    if (!dirs.has(dir)) { fs.mkdirSync(dir, { recursive: true }); dirs.add(dir); }
    fs.writeFileSync(p, Buffer.from(b64, "base64"));
    files++;
  }
  // rolldown's WASI preopens /tmp; it must exist before instantiation
  fs.mkdirSync("/tmp", { recursive: true });
  if (globalThis.__VITE8) {
    // Evaluate the binding module FIRST (lazy: no disallowed ops at its top
    // level), instantiate it in THIS handler (emnapi calls crypto.getRandomValues,
    // forbidden in workerd's global scope), THEN let rolldown's JS chunks evaluate
    // — they read BindingX.prototype at their own module-eval time and need the
    // binding classes already populated (live ESM bindings reflect the assignment).
    const __binding = await import("/tmp/xnm/rolldown/dist/rolldown-binding.wasi-browser.js");
    if (globalThis.__ROLLDOWN_ENSURE_READY) await globalThis.__ROLLDOWN_ENSURE_READY();
    if (env.RD_LOG) __binding.default.initTraceSubscriber();
    await import("rolldown");
  }
  vfsReady = true;
  return { files, ms: Date.now() - t0 };
}

async function collectDir(dir) {
  const fs = await getFs();
  const out = {};
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, String(e.name));
      if (e.isDirectory()) walk(p);
      else out[p.slice(dir.length + 1)] = fs.readFileSync(p).toString("base64");
    }
  };
  walk(dir);
  return out;
}

// live HMR sockets (accepted server ends of WebSocketPair), isolate-lifetime
const hmrSockets = new Set();
function hmrBroadcast(msg) {
  const data = JSON.stringify(msg);
  for (const s of hmrSockets) {
    try { s.send(data); } catch { hmrSockets.delete(s); }
  }
  return hmrSockets.size;
}

const HMR_CLIENT = `
<script type="module">
  // isolate push-HMR client: the server owns the write path, so updates are
  // pushed here directly — no file watcher anywhere.
  const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/__hmr");
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "full-reload") location.reload();
  };
</script>`;

async function inlineConfig(mode) {
  const { default: react } = await import("@vitejs/plugin-react");
  return {
    root: "/tmp/app",
    configFile: false,
    envFile: false,
    mode,
    logLevel: "info",
    plugins: [
      react(),
      {
        name: "isolate-hmr-client",
        apply: "serve",
        transformIndexHtml(html) {
          return html.replace("</head>", HMR_CLIENT + "</head>");
        },
      },
    ],
    server: { middlewareMode: true, hmr: false, watch: null, host: "127.0.0.1", allowedHosts: true },
  };
}

async function runBuild(mode) {
  const vite = await import("vite");
  const cfg = await inlineConfig(mode);
  const t0 = Date.now();
  await vite.build({ ...cfg, build: { outDir: "/tmp/app/dist", emptyOutDir: true } });
  return { ms: Date.now() - t0, viteVersion: vite.version, dist: await collectDir("/tmp/app/dist") };
}

async function ensureDevServer() {
  if (devServer) return devServer;
  const vite = await import("vite");
  const cfg = await inlineConfig("development");
  devServer = await vite.createServer(cfg);
  return devServer;
}

// Adapt a workerd fetch Request to vite's connect middleware stack.
async function dispatchToConnect(middlewares, request) {
  const { Readable, Writable } = await import("node:stream");
  const url = new URL(request.url);
  const bodyBuf = request.body ? Buffer.from(await request.arrayBuffer()) : null;

  const req = new Readable({ read() {} });
  if (bodyBuf) req.push(bodyBuf);
  req.push(null);
  req.url = url.pathname + url.search;
  req.method = request.method;
  req.headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
  req.headers.host = url.host;
  req.socket = { remoteAddress: "127.0.0.1", encrypted: false };
  req.connection = req.socket;
  req.httpVersion = "1.1";
  req.originalUrl = req.url;

  return await new Promise((resolve, reject) => {
    const chunks = [];
    let statusCode = 200;
    const headers = {};
    const res = new Writable({
      write(chunk, _enc, cb) { chunks.push(Buffer.from(chunk)); cb(); },
    });
    res.setHeader = (k, v) => { headers[k.toLowerCase()] = v; return res; };
    res.getHeader = (k) => headers[k.toLowerCase()];
    res.getHeaderNames = () => Object.keys(headers);
    res.removeHeader = (k) => { delete headers[k.toLowerCase()]; };
    res.hasHeader = (k) => k.toLowerCase() in headers;
    res.writeHead = (code, reasonOrHeaders, maybeHeaders) => {
      statusCode = code;
      const h = typeof reasonOrHeaders === "object" ? reasonOrHeaders : maybeHeaders;
      if (h) for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
      return res;
    };
    Object.defineProperty(res, "statusCode", { get: () => statusCode, set: (v) => { statusCode = v; } });
    res.headersSent = false;
    const origEnd = res.end.bind(res);
    res.end = (chunk, enc, cb) => {
      if (chunk && typeof chunk !== "function") chunks.push(Buffer.from(chunk, enc));
      origEnd(() => {});
      const body = Buffer.concat(chunks);
      const h = new Headers();
      for (const [k, v] of Object.entries(headers)) {
        if (Array.isArray(v)) for (const vv of v) h.append(k, String(vv));
        else h.set(k, String(v));
      }
      resolve(new Response(body.length ? body : null, { status: statusCode, headers: h }));
      if (typeof cb === "function") cb();
      return res;
    };
    middlewares(req, res, (err) => {
      if (err) reject(err);
      else resolve(new Response("vite middleware did not handle: " + req.url, { status: 404 }));
    });
  });
}

export default {
  async fetch(request, env, ctx) {
    globalThis.__VITE8 = env.VITE8 === "1";
    // background work (pump loops, optimizer tails) belongs to this request
    globalThis.__WAIT_UNTIL = ctx?.waitUntil ? (p) => { try { ctx.waitUntil(p); } catch {} } : undefined;
    const url = new URL(request.url);
    try {
      if (url.pathname === "/populate") {
        const r = await ensureVfs(env);
        const fs = await getFs();
        r.checks = {
          vitePkg: fs.existsSync("/tmp/app/node_modules/vite/package.json"),
          indexHtml: fs.existsSync("/tmp/app/index.html"),
        };
        return Response.json(r);
      }
      if (url.pathname === "/dev/rolldown-probe") {
        await ensureVfs(env);
        const fs = await getFs();
        fs.mkdirSync("/tmp/rdtest", { recursive: true });
        fs.writeFileSync("/tmp/rdtest/in.ts", "export const x: number = 41 + 1; console.log(x);");
        const stage = {};
        // wrap openSync to surface the failing path fs-core hides
        const origOpen = fs.openSync.bind(fs);
        const opens = [];
        fs.openSync = (p, ...a) => { opens.push(String(p)); try { return origOpen(p, ...a); } catch (e) { e.message += " PATH=" + String(p); throw e; } };
        try {
          stage.input = fs.existsSync("/tmp/rdtest/in.ts");
          const t0 = Date.now();
          let rd;
          try { rd = await import("rolldown"); }
          catch (e) { return Response.json({ ok: false, stage: { ...stage, importFailed: true }, error: String(e), errStack: (e && e.stack || "").split("\n").slice(0, 12) }, { status: 500 }); }
          stage.imported = true;
          stage.importMs = Date.now() - t0;
          // isolated: does pumpAsyncRuntime even return when nothing is pending?
          const binding = await import("/tmp/xnm/rolldown/dist/rolldown-binding.wasi-browser.js");
          stage.pumpProbe = "calling";
          binding.default.pumpAsyncRuntime(4);
          stage.pumpProbe = "returned";
          const t1 = Date.now();
          const buildP = rd.build({ input: "/tmp/rdtest/in.ts", cwd: "/tmp/rdtest", output: { dir: "/tmp/rdtest/out" } });
          const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error("build cap 20s; pump=" + JSON.stringify({ has: globalThis.__PUMP_HAS, iters: globalThis.__PUMP_ITERS, bailed: globalThis.__PUMP_BAILED }))), 20000));
          await Promise.race([buildP, timeoutP]);
          stage.buildMs = Date.now() - t1;
          const out = fs.readdirSync("/tmp/rdtest/out");
          return Response.json({ ok: true, stage, out, opensCount: opens.length, pump: { has: globalThis.__PUMP_HAS, iters: globalThis.__PUMP_ITERS, done: globalThis.__PUMP_DONE }, code: fs.readFileSync("/tmp/rdtest/out/" + out[0], "utf8").slice(0, 120) });
        } catch (e) {
          return Response.json({ ok: false, stage, error: String(e), opensTail: opens.slice(-8), diag: globalThis.__RD_DIAG ? { calls: globalThis.__RD_DIAG.calls.slice(-25), pumpIters: globalThis.__RD_DIAG.pumpIters, active: globalThis.__RD_DIAG.active } : null, lastImport: globalThis.__LAST_IMPORT, importCalls: globalThis.__IMPORT_CALLS, threw: globalThis.__IMPORT_THREW, grows: globalThis.__GROWS, lastGrow: globalThis.__LAST_GROW, wasiLast: globalThis.__WASI_LAST, wasiCalls: globalThis.__WASI_CALLS }, { status: 500 });
        }
      }
      if (url.pathname === "/dev/install") {
        // INSTALL_PACKAGE without npm: fetch the registry tarball, gunzip via
        // DecompressionStream, untar into memfs. No script runner exists, so
        // postinstall scripts are structurally impossible, not just disabled.
        await ensureVfs(env);
        const fs = await getFs();
        const name = url.searchParams.get("pkg");
        let version = url.searchParams.get("version") ?? "latest";
        const t0 = Date.now();
        const meta = await (await fetch("https://registry.npmjs.org/" + name)).json();
        if (meta["dist-tags"]?.[version]) version = meta["dist-tags"][version];
        const info = meta.versions?.[version];
        if (!info) return Response.json({ ok: false, error: "no such version: " + name + "@" + version }, { status: 404 });
        const tgz = await fetch(info.dist.tarball);
        const tarBytes = new Uint8Array(await new Response(tgz.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
        // minimal ustar reader
        const dec = new TextDecoder();
        const files = [];
        let off = 0;
        while (off + 512 <= tarBytes.length) {
          const block = tarBytes.subarray(off, off + 512);
          if (block.every((b) => b === 0)) break;
          const rawName = dec.decode(block.subarray(0, 100)).split("\0")[0];
          const prefix = dec.decode(block.subarray(345, 500)).split("\0")[0];
          const size = parseInt(dec.decode(block.subarray(124, 136)).trim() || "0", 8);
          const type = String.fromCharCode(block[156] || 48);
          const entryName = (prefix ? prefix + "/" : "") + rawName;
          off += 512;
          if (type === "0" || type === "\0" || type === "") {
            files.push([entryName, tarBytes.slice(off, off + size)]);
          }
          off += Math.ceil(size / 512) * 512;
        }
        const base = "/tmp/app/node_modules/" + name;
        let written = 0;
        for (const [entry, bytes] of files) {
          const rel = entry.replace(/^package\//, "");
          const p = base + "/" + rel;
          fs.mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
          fs.writeFileSync(p, bytes);
          written++;
        }
        // dev server may have cached "missing import" resolution
        if (devServer) {
          const g = devServer.environments?.client?.moduleGraph ?? devServer.moduleGraph;
          g?.invalidateAll?.();
        }
        return Response.json({ ok: true, name, version, files: written, ms: Date.now() - t0 });
      }
      if (url.pathname === "/bash") {
        await ensureVfs(env);
        const { getBash } = await import("/tmp/shims/bash.mjs");
        const bash = await getBash({ runBuild });
        const body = await request.json();
        const t0 = Date.now();
        const r = await bash.exec(body.cmd, body.opts ?? {});
        return Response.json({ ok: true, ms: Date.now() - t0, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr });
      }
      if (url.pathname === "/build") {
        const populate = await ensureVfs(env);
        const mode = url.searchParams.get("mode") ?? "production";
        const result = await runBuild(mode);
        return Response.json({ ok: true, populate, ...result });
      }
      if (url.pathname === "/dev/lexer") {
        globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
        globalThis.__HOST = env.HOST;
        globalThis.__wasmCompile = async (bytes) => env.UNSAFE_EVAL.newWasmModule(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
        const { init, parse } = await import("es-module-lexer");
        await init;
        const code = 'import { a } from "mod-a"; import b from "./b.js"; const c = await import("./dyn.js");';
        const [imports, exports] = parse(code);
        return Response.json({ imports: imports.map(i => ({ n: i.n, d: i.d, s: i.s, e: i.e })), exports });
      }
      if (url.pathname === "/dev/warmup") {
        // Everything the dev server does asynchronously (esbuild wasm init,
        // dep scan, prebundle, optimizer commit) must finish inside ONE
        // request: workerd cancels pending I/O when its request context dies.
        await ensureVfs(env);
        const t0 = Date.now();
        const server = await ensureDevServer();
        const esb = await import("esbuild");
        await esb.transform("let x: number = 1", { loader: "ts" }); // force wasm init now
        const tr = await server.transformRequest("/src/main.tsx");
        if (server.waitForRequestsIdle) await server.waitForRequestsIdle();
        // The optimizer prebundles at "crawl end" in the background; emulate a
        // browser fetching the dep files so the whole esbuild run + commit
        // finishes while this request context is still alive.
        const depUrls = [...(tr?.code ?? "").matchAll(/["'](\/node_modules\/\.vite\/deps\/[^"']+)["']/g)].map((m) => m[1]);
        const depResults = {};
        for (const dep of depUrls) {
          const res = await dispatchToConnect(server.middlewares, new Request(new URL(dep, "http://vite.local")));
          depResults[dep] = res.status;
        }
        await new Promise((r) => setTimeout(r, 300));
        return Response.json({ ok: true, ms: Date.now() - t0, mainLen: tr?.code?.length ?? null, depResults });
      }
      if (url.pathname === "/dev/write") {
        await ensureVfs(env);
        const server = await ensureDevServer();
        const fs = await getFs();
        const body = await request.json();
        fs.writeFileSync(body.path, body.content);
        // no file watcher in the isolate: we own the write path, so we
        // invalidate the module graph explicitly (push-based HMR)
        const envClient = server.environments?.client;
        const graph = envClient?.moduleGraph ?? server.moduleGraph;
        const mods = graph.getModulesByFile(body.path);
        let invalidated = 0;
        if (mods) for (const m of mods) { graph.invalidateModule(m); invalidated++; }
        const notified = hmrBroadcast({ type: "full-reload", path: body.path });
        return Response.json({ ok: true, invalidated, notified });
      }
      if (url.pathname === "/dev/transform") {
        await ensureVfs(env);
        const server = await ensureDevServer();
        const mod = url.searchParams.get("url") ?? "/src/main.tsx";
        const t0 = Date.now();
        const out = await server.transformRequest(mod);
        return Response.json({ ok: true, ms: Date.now() - t0, len: out?.code?.length ?? null, head: out?.code?.slice(0, 300) ?? null });
      }
      if (url.pathname === "/dev/start") {
        const populate = await ensureVfs(env);
        const t0 = Date.now();
        const server = await ensureDevServer();
        return Response.json({
          ok: true, populate, ms: Date.now() - t0,
          rootResolved: server.config.root,
        });
      }
      if (url.pathname === "/mem") {
        return Response.json(typeof process.memoryUsage === "function" ? process.memoryUsage() : { unavailable: true });
      }
      // Browser-facing dev server. Any path that isn't a control op above is
      // forwarded to vite's connect middleware running inside the isolate, so a
      // browser can hit workerd's port directly (http://127.0.0.1:5173) and use
      // the app exactly like a normal vite dev server. The legacy `/preview/*`
      // prefix (used by the verify:dev crawl) is stripped; everything else is
      // passed through verbatim. The HMR client connects to `/__hmr`.
      {
        await ensureVfs(env);
        if (request.headers.get("Upgrade") === "websocket") {
          const pair = new WebSocketPair();
          const [client, server] = Object.values(pair);
          server.accept();
          hmrSockets.add(server);
          server.addEventListener("close", () => hmrSockets.delete(server));
          // Writes arrive over this socket (a workerd accepted WebSocket can
          // only be used from its own request context; in production a Durable
          // Object owns all sockets and can broadcast across them). The write
          // handler runs in this context, so the push works.
          server.addEventListener("message", async (e) => {
            try {
              const m = JSON.parse(e.data);
              if (m.type === "write") {
                const fs = await getFs();
                fs.writeFileSync(m.path, m.content);
                const srv = await ensureDevServer();
                const envClient = srv.environments?.client;
                const graph = envClient?.moduleGraph ?? srv.moduleGraph;
                const mods = graph.getModulesByFile(m.path);
                let invalidated = 0;
                if (mods) for (const mod of mods) { graph.invalidateModule(mod); invalidated++; }
                server.send(JSON.stringify({ type: "full-reload", path: m.path, invalidated }));
              }
            } catch (err) {
              server.send(JSON.stringify({ type: "error", error: String(err) }));
            }
          });
          server.send(JSON.stringify({ type: "connected" }));
          return new Response(null, { status: 101, webSocket: client });
        }
        const server = await ensureDevServer();
        const pathname = url.pathname.startsWith("/preview")
          ? (url.pathname.slice("/preview".length) || "/")
          : url.pathname;
        const inner = new Request(new URL(pathname + url.search, "http://vite.local"), request);
        return await dispatchToConnect(server.middlewares, inner);
      }
    } catch (e) {
      return Response.json({ ok: false, error: String(e), stack: e?.stack ?? null }, { status: 500 });
    }
  },
};
