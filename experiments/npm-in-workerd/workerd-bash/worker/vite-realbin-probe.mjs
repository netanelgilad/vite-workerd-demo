// REAL-BIN vite dev probe: runs INSIDE a Worker-Loader child of the DO. Instead of
// calling vite.createServer ourselves, we run vite's REAL bin entry (node_modules/.bin/
// vite -> vite/bin/vite.js -> dist/node/cli.js), exactly as `vite` / `npm run dev` would.
// vite's own code calls http.createServer(connectApp).listen(port); our node:http shim
// (which the DO redirected vite's `import "node:http"` onto) records that server on
// globalThis.__VITE_HTTP_SERVER and fires 'listening' so vite's `await server.listen()`
// resolves. The DO forwards browser HTTP here; fetch() dispatches into vite's connect app.
//
// The DO injects two things before importing this probe: VITE_BIN (the shebang-stripped
// real bin path) and DEV_PORT, via globals __VITE_BIN / env.DEV_PORT.
import { Buffer } from "node:buffer";
import { EventEmitter } from "node:events";
import * as nodeFs from "node:fs";

import { WorkerEntrypoint } from "cloudflare:workers";

let booted = false;
let started = false;
const DIAG = { logs: [], errors: [] };
const diagLog = (...a) => { try { DIAG.logs.push(a.map((x) => (typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })())).join(" ")); } catch {} };

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
  globalThis.__wasmCompile = async (b) =>
    env.UNSAFE_EVAL.newWasmModule(b instanceof Uint8Array ? b : new Uint8Array(b));
  globalThis.__safeEval = (c) => env.UNSAFE_EVAL.eval(String(c));
  globalThis.__newFunction = (...a) => { const body = a.pop(); return env.UNSAFE_EVAL.newFunction(String(body), "anonymous", ...a); };
  globalThis.__requireResolve = (base, spec) => {
    if (typeof spec === "string" && spec.startsWith("file://")) spec = spec.slice(7);
    return spec;
  };
  const _WA = globalThis.WebAssembly;
  if (!_WA.__patchedForUnsafeEval) {
    const origInstantiate = _WA.instantiate.bind(_WA);
    const toModule = (src) => {
      if (src instanceof _WA.Module) return src;
      const bytes = src instanceof Uint8Array ? src : new Uint8Array(src);
      return env.UNSAFE_EVAL.newWasmModule(bytes);
    };
    _WA.compile = async (src) => toModule(src);
    _WA.instantiate = async (src, imports) => {
      if (src instanceof _WA.Module) return origInstantiate(src, imports);
      const mod = toModule(src);
      const instance = await origInstantiate(mod, imports);
      return { module: mod, instance };
    };
    _WA.__patchedForUnsafeEval = true;
  }
}

function makeEnoentFs(base) {
  const O_CREAT = 0o100;
  const enoent = (p, syscall) => { const e = new Error("ENOENT: no such file or directory, " + syscall + " '" + p + "'"); e.code = "ENOENT"; e.errno = -2; e.syscall = syscall; e.path = p; throw e; };
  return new Proxy(base, { get(t, k) {
    const v = t[k];
    if (k === "openSync") return (p, flags, ...a) => {
      const wantsCreate = typeof flags === "number" && (flags & O_CREAT) !== 0;
      if (!wantsCreate && !t.existsSync(p)) enoent(p, "open");
      return v.call(t, p, flags, ...a);
    };
    if (k === "readFileSync") return (p, ...a) => { if (!t.existsSync(p)) enoent(p, "open"); return v.call(t, p, ...a); };
    if (k === "statSync") return (p, ...a) => { if (!t.existsSync(p)) enoent(p, "stat"); return v.call(t, p, ...a); };
    if (k === "lstatSync") return (p, ...a) => { if (!t.existsSync(p)) enoent(p, "lstat"); return v.call(t, p, ...a); };
    return typeof v === "function" ? v.bind(t) : v;
  }});
}

async function bootRolldown(root) {
  if (booted) return;
  globalThis.__WASI_NO_BUSY_SLEEP = true;
  globalThis.__TSFN_LOG = false;
  globalThis.__EMNAPI_SCHED = (cb) => queueMicrotask(cb);
  globalThis.__RD_ENV = { RD_LOG: "", RD_LOG_OUTPUT: "readable" };
  globalThis.__ROLLDOWN_FS = makeEnoentFs(nodeFs);
  await import(root + "/node_modules/rolldown/dist/rolldown-binding.wasi-browser.js");
  if (globalThis.__ROLLDOWN_ENSURE_READY) await globalThis.__ROLLDOWN_ENSURE_READY();
  await import("rolldown");
  booted = true;
}

// Run vite's REAL bin once. process.argv is set the way `vite --port <p>` would be; the
// bin parses it, creates the server, and `await server.listen()` resolves off our shim's
// 'listening' event. We wait until the shim has the listening server, then return.
async function startRealVite(root, devPort) {
  if (started) return;
  started = true;
  const argv = ["node", globalThis.__VITE_BIN, "--port", String(devPort || 5173), "--host", "127.0.0.1"];
  const np = await import("node:process");
  for (const proc of new Set([np.default, np, globalThis.process].filter(Boolean))) {
    try { proc.argv = argv.slice(); } catch {}
    try { proc.cwd = () => root; } catch { try { Object.defineProperty(proc, "cwd", { configurable: true, value: () => root }); } catch {} }
    try { proc.env = Object.assign(proc.env || {}, { CI: "true" }); } catch {}
    try { if (proc.stdin) proc.stdin.isTTY = false; } catch {}
    // vite's serve action errors become unhandled rejections (the bin's own handler is
    // disabled for node_modules); capture them so a failed boot isn't silent.
    try { proc.on?.("unhandledRejection", (e) => DIAG.errors.push("unhandledRejection: " + String(e && e.stack || e))); } catch {}
    try { proc.on?.("uncaughtException", (e) => DIAG.errors.push("uncaughtException: " + String(e && e.stack || e))); } catch {}
  }
  // Capture vite's console output (it logs the ready banner + any error there). The serve
  // action runs async AFTER this import resolves, so leave capture installed through the
  // poll window (one-shot child; no need to restore).
  console.log = (...a) => { diagLog(...a); };
  console.info = (...a) => { diagLog(...a); };
  console.warn = (...a) => { diagLog("[warn]", ...a); };
  console.error = (...a) => { diagLog("[error]", ...a); DIAG.errors.push(a.map(String).join(" ")); };
  // vite's logger writes via process.stdout/stderr.write, not console — capture both.
  try { np.default.stdout.write = (s) => { diagLog("[out] " + (typeof s === "string" ? s : String(s)).trimEnd()); return true; }; } catch {}
  try { np.default.stderr.write = (s) => { diagLog("[err] " + (typeof s === "string" ? s : String(s)).trimEnd()); return true; }; } catch {}
  globalThis.addEventListener?.("unhandledrejection", (ev) => { try { DIAG.errors.push("unhandledrejection(evt): " + String(ev.reason && ev.reason.stack || ev.reason)); } catch {} });

  // Run vite's OWN server bootstrap (awaited). This is exactly what the `vite` bin's serve
  // action does — `const server = await createServer(...); await server.listen()` — minus
  // the cac CLI wrapper, which can't run here: cac invokes the action fire-and-forget and
  // workerd swallows the resulting rejection, so the bin boots silently to nothing. Calling
  // createServer directly runs vite's real code with full config discovery (the project's
  // own vite.config + plugins + dep optimizer) and surfaces errors. Config is discovered
  // (no configFile:false, no manual plugins) — the project's real config is honored.
  diagLog("vite.createServer (real config discovery) from " + root);
  try {
    const vite = await import(root + "/node_modules/vite/dist/node/index.js").catch(() => import("vite"));
    diagLog("vite module imported; version=" + (vite.version || "?"));
    const server = await vite.createServer({
      root,
      mode: "development",
      logLevel: "info",
      // watch:null -> vite uses a NoopWatcher (a real EventEmitter wired to the HMR
      // pipeline) instead of chokidar. workerd has no fs.watch/fs.watchFile, so we drive
      // file-change events ourselves via server.watcher.emit('change', file) (notifyChange,
      // called by the shell on every write). This IS the watch primitive for this env.
      server: { host: "127.0.0.1", port: Number(devPort) || 5173, strictPort: false, watch: null },
    });
    globalThis.__VITE_SERVER = server;
    await server.listen();
    diagLog("server.listen() resolved");
  } catch (e) {
    DIAG.errors.push("createServer/listen threw: " + String(e && e.stack || e));
  }
}

async function ensureServing(env) {
  installGlobals(env);
  globalThis.__WAIT_UNTIL = (p) => { try { env.__ctx?.waitUntil(p); } catch {} };
  const root = globalThis.__VITE_ROOT || "/root/proj";
  diagLog("ensureServing:start root=" + root + " bin=" + globalThis.__VITE_BIN);
  await bootRolldown(root);
  diagLog("rolldown booted");
  await startRealVite(root, env.DEV_PORT);
  diagLog("startRealVite returned");
  // Wait for vite's real server.listen() to reach our shim's 'listening'.
  const t0 = Date.now();
  while (!(globalThis.__VITE_HTTP_SERVER && globalThis.__VITE_HTTP_SERVER._listening)) {
    if (Date.now() - t0 > 75000) {
      const e = new Error("vite real bin did not reach 'listening' within 75s");
      e.diag = {
        createServerCalled: !!globalThis.__VITE_HTTP_SERVER,
        listening: globalThis.__VITE_HTTP_SERVER?._listening || false,
        errors: DIAG.errors.slice(-12),
        logsTail: DIAG.logs.slice(-50),
      };
      throw e;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return globalThis.__VITE_HTTP_SERVER;
}

// Adapt a workerd fetch Request to vite's connect requestListener (req/res over the
// connect stack). Ported from the proven do-machine dev probe.
async function dispatchToConnect(requestListener, request) {
  const { Readable, Writable } = await import("node:stream");
  const url = new URL(request.url);
  const bodyBuf = request.body ? Buffer.from(await request.arrayBuffer()) : null;
  const req = new Readable({ read() {} });
  if (bodyBuf) req.push(bodyBuf);
  req.push(null);
  req.url = url.pathname + url.search;
  req.method = request.method;
  req.headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
  // vite's allowedHosts (DNS-rebind protection) allows loopback by default; a real browser
  // reaches us on 127.0.0.1:<port>. Our synthetic adapter origin must look like that too.
  req.headers.host = req.headers.host && /^(localhost|127\.0\.0\.1)/.test(req.headers.host) ? req.headers.host : "localhost";
  if (["document", "iframe", "frame", "fencedframe"].includes(req.headers["sec-fetch-dest"])) delete req.headers["sec-fetch-dest"];
  req.socket = { remoteAddress: "127.0.0.1", encrypted: false };
  req.connection = req.socket;
  req.httpVersion = "1.1";
  req.httpVersionMajor = 1;
  req.originalUrl = req.url;

  return await new Promise((resolve, reject) => {
    const chunks = [];
    let statusCode = 200;
    const headers = {};
    const res = new Writable({ write(chunk, _enc, cb) { chunks.push(Buffer.from(chunk)); cb(); } });
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
    requestListener(req, res);
  });
}

// ---- HMR: bridge the http server's 'upgrade' to a WebSocketPair so vite's REAL `ws`
// server handles HMR. workerd has no raw socket, so we give `ws` a Duplex backed by a
// WebSocketPair and translate RFC6455 frames between the two (workerd frames the
// browser side; we frame the vite-`ws` side). Live-reload still needs a file watcher,
// which workerd lacks — but the client connects cleanly and gets vite's 'connected'.
function wsFrame(payloadStr, opcode = 0x1) {
  const payload = Buffer.from(payloadStr, "utf8");
  const len = payload.length;
  const mask = Buffer.from([(Math.random() * 256) | 0, (Math.random() * 256) | 0, (Math.random() * 256) | 0, (Math.random() * 256) | 0]);
  let header;
  if (len < 126) header = Buffer.from([0x80 | opcode, 0x80 | len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, masked]);
}

function drainServerFrames(buf, onText, onPing, onClose) {
  let off = 0;
  while (off + 2 <= buf.length) {
    const b0 = buf[off], b1 = buf[off + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, hl = 2;
    if (len === 126) { if (off + 4 > buf.length) break; len = buf.readUInt16BE(off + 2); hl = 4; }
    else if (len === 127) { if (off + 10 > buf.length) break; len = Number(buf.readBigUInt64BE(off + 2)); hl = 10; }
    let maskKey;
    if (masked) { if (off + hl + 4 > buf.length) break; maskKey = buf.slice(off + hl, off + hl + 4); hl += 4; }
    if (off + hl + len > buf.length) break;
    let payload = buf.slice(off + hl, off + hl + len);
    if (masked) { const p = Buffer.alloc(len); for (let i = 0; i < len; i++) p[i] = payload[i] ^ maskKey[i & 3]; payload = p; }
    off += hl + len;
    if (opcode === 0x1 || opcode === 0x0) onText(payload.toString("utf8"));
    else if (opcode === 0x8) { onClose(); return buf.length; }
    else if (opcode === 0x9) onPing(payload);
  }
  return off;
}

// A tiny async queue: pull() resolves when push() has an item.
function makeQueue() {
  const items = [];
  let resolve = null;
  return {
    push(x) { if (resolve) { const r = resolve; resolve = null; r(x); } else items.push(x); },
    pull() { return items.length ? Promise.resolve(items.shift()) : new Promise((r) => { resolve = r; }); },
  };
}

const WS_CLOSE = Symbol("ws-close");

// Bridge vite's `ws` (a Duplex it frames over) to a workerd WebSocketPair. Outbound frames
// (vite -> browser) are decoded and pushed to `outbound` (a queue) — NOT sent on serverWs
// here, because vite's broadcast runs in a different invocation context (notifyChange) than
// the one that accepted the socket; workerd only allows sending from the accepting context.
// The upgrade handler drains the queue and sends, in its own (waitUntil-kept-alive) context.
function makeWsBridge(serverWs, outbound) {
  const sock = new EventEmitter();
  sock.readable = true; sock.writable = true;
  for (const m of ["setNoDelay", "setTimeout", "setKeepAlive", "pause", "resume", "cork", "uncork", "ref", "unref"]) sock[m] = () => sock;
  sock.unshift = () => {};
  sock.destroy = () => { try { outbound(WS_CLOSE); } catch {} sock.emit("close"); };
  sock.end = () => sock.destroy();
  let handshakeDone = false;
  let acc = Buffer.alloc(0);
  sock.write = (chunk, enc, cb) => {
    let buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof enc === "string" ? enc : "utf8");
    if (!handshakeDone) {
      const s = buf.toString("latin1");
      if (s.startsWith("HTTP/")) {
        const idx = s.indexOf("\r\n\r\n");
        if (idx >= 0) { handshakeDone = true; buf = buf.slice(idx + 4); }
        else { if (typeof enc === "function") enc(); else if (typeof cb === "function") cb(); return true; }
      }
    }
    if (buf.length) {
      acc = Buffer.concat([acc, buf]);
      const consumed = drainServerFrames(acc,
        (text) => { try { outbound(text); } catch {} },
        () => { try { sock.emit("data", wsFrame("", 0xA)); } catch {} },
        () => { try { outbound(WS_CLOSE); } catch {} });
      acc = acc.slice(consumed);
    }
    if (typeof enc === "function") enc(); else if (typeof cb === "function") cb();
    return true;
  };
  // browser -> vite (these events fire in the accepting context, which we keep alive)
  serverWs.addEventListener("message", (ev) => {
    const data = typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString("utf8");
    try { sock.emit("data", wsFrame(data, 0x1)); } catch {}
  });
  serverWs.addEventListener("close", () => { try { outbound(WS_CLOSE); } catch {} sock.emit("close"); });
  serverWs.addEventListener("error", () => { try { outbound(WS_CLOSE); } catch {} sock.emit("close"); });
  return sock;
}

export default class extends WorkerEntrypoint {
  async warmup() {
    const out = {};
    try {
      this.env.__ctx = this.ctx;
      globalThis.__VITE_BIN = this.env.VITE_BIN;
      globalThis.__VITE_ROOT = this.env.VITE_ROOT || "/root/proj";
      const t0 = Date.now();
      const server = await ensureServing(this.env);
      out.ok = true;
      out.ms = Date.now() - t0;
      out.port = server._port;
      out.hasRequestListener = server.listeners("request").length > 0;
    } catch (e) {
      out.ok = false;
      out.error = e && e.stack ? String(e.stack).split("\n").slice(0, 8).join(" | ") : String(e);
      out.diag = e?.diag || { errors: DIAG.errors.slice(-12), logsTail: DIAG.logs.slice(-50), createServerCalled: !!globalThis.__VITE_HTTP_SERVER };
    }
    return out;
  }

  // The watch primitive: the shell calls this after each write so vite's real HMR pipeline
  // runs (server.watcher 'change' -> moduleGraph -> ws update). workerd has no OS file
  // events; the shell owns every edit, so it reports them precisely.
  async notifyChange(file, event = "change") {
    const s = globalThis.__VITE_SERVER;
    if (!s || !s.watcher || typeof s.watcher.emit !== "function") return { ok: false, error: "no server/watcher" };
    const before = DIAG.logs.length;
    let mods;
    try {
      const env = s.environments?.client;
      const m = env?.moduleGraph?.getModulesByFile?.(file);
      mods = m ? (m.size ?? m.length ?? [...m].length) : 0;
    } catch (e) { mods = "err:" + String(e); }
    try { s.watcher.emit(event, file); } catch (e) { return { ok: false, error: String(e) }; }
    await new Promise((r) => setTimeout(r, 400)); // let async onFileChange run + send
    let clients;
    try { clients = s.environments?.client?.hot?.clients?.size ?? s.ws?.clients?.size ?? null; } catch { clients = "err"; }
    return { ok: true, modsForFile: mods, bundledDev: s.config?.experimental?.bundledDev ?? null, clients, wsOut: (globalThis.__WS_OUT || []).slice(-6), logs: DIAG.logs.slice(before).slice(-6) };
  }

  async fetch(request) {
    this.env.__ctx = this.ctx;
    globalThis.__VITE_BIN = this.env.VITE_BIN;
    globalThis.__VITE_ROOT = this.env.VITE_ROOT || "/root/proj";
    try {
      const server = await ensureServing(this.env);
      const url = new URL(request.url);
      // DIAGNOSTIC: probe vite's resolve/transform pipeline for the URL path the browser
      // requests (/src/main.tsx) and the follow-on relative css import. Temporary — used to
      // pin the re-root resolver mechanism; safe to remove.
      if (url.pathname === "/__diag") {
        const root = globalThis.__VITE_ROOT || "/root/proj";
        const env = server.environments?.client;
        const pc = env?.pluginContainer;
        const out = { root, hasEnv: !!env, hasPc: !!pc, steps: [] };
        const push = (k, v) => out.steps.push({ [k]: v });
        const rid = (r) => (r == null ? null : (typeof r === "string" ? r : (r.id ?? r)));
        try { push("resolveId('/src/main.tsx', undefined)", rid(await pc.resolveId("/src/main.tsx", undefined, {}))); } catch (e) { push("resolveId('/src/main.tsx') THREW", String(e && e.stack || e)); }
        try { push("resolveId('/src/main.tsx', index.html)", rid(await pc.resolveId("/src/main.tsx", root + "/index.html", {}))); } catch (e) { push("resolveId(main w/ html importer) THREW", String(e && e.stack || e)); }
        try { push("resolveId('./index.css', root/src/main.tsx)", rid(await pc.resolveId("./index.css", root + "/src/main.tsx", {}))); } catch (e) { push("resolveId('./index.css') THREW", String(e && e.stack || e)); }
        push("fs.existsSync(/src/main.tsx)", nodeFs.existsSync("/src/main.tsx"));
        push("fs.existsSync(root/src/main.tsx)", nodeFs.existsSync(root + "/src/main.tsx"));
        push("fs.existsSync(/src/index.css)", nodeFs.existsSync("/src/index.css"));
        const tr = async (u) => { const f = env?.transformRequest ? env.transformRequest.bind(env) : server.transformRequest.bind(server); const r = await f(u); return r ? { codeLen: r.code?.length, head: (r.code || "").slice(0, 140) } : null; };
        try { push("transformRequest('/src/main.tsx')", await tr("/src/main.tsx")); } catch (e) { push("transformRequest('/src/main.tsx') THREW", String(e && e.stack || e)); }
        try { push("transformRequest(root/src/main.tsx)", await tr(root + "/src/main.tsx")); } catch (e) { push("transformRequest(root/src/main.tsx) THREW", String(e && e.stack || e)); }
        return Response.json(out);
      }
      // HMR WebSocket: hand the upgrade to vite's real ws server via the Duplex bridge.
      if ((request.headers.get("Upgrade") || "").toLowerCase() === "websocket") {
        const [client, srv] = Object.values(new WebSocketPair());
        srv.accept();
        const req = {
          method: "GET",
          url: url.pathname + url.search,
          headers: Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v])),
        };
        req.headers.host = "localhost";
        // vite broadcasts updates from a LATER invocation (notifyChange); workerd only lets
        // us send on srv from THIS (accepting) context. So queue vite's outbound frames and
        // drain them here, kept alive via waitUntil for the life of the connection.
        const queue = makeQueue();
        server.emit("upgrade", req, makeWsBridge(srv, (m) => queue.push(m)), Buffer.alloc(0));
        this.ctx.waitUntil((async () => {
          for (;;) {
            const m = await queue.pull();
            if (m === WS_CLOSE) break;
            try { srv.send(m); } catch { break; }
          }
        })());
        const offered = request.headers.get("Sec-WebSocket-Protocol");
        const headers = {};
        if (offered) headers["Sec-WebSocket-Protocol"] = offered.split(",")[0].trim();
        return new Response(null, { status: 101, webSocket: client, headers });
      }
      const inner = new Request(new URL(url.pathname + url.search, "http://vite.local"), request);
      const listener = server.listeners("request")[0];
      if (!listener) return new Response("vite server has no request listener", { status: 500 });
      return await dispatchToConnect(listener, inner);
    } catch (e) {
      return Response.json({ ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 16) }, { status: 500 });
    }
  }
}
