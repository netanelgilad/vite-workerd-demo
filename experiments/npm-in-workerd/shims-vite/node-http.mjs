// node:http shim for workerd — provides the ONE missing primitive that lets the REAL
// vite CLI bin serve in an isolate: a listening HTTP server.
//
// workerd has no inbound-socket model (no real http.Server.listen / node:net), so vite's
// `http.createServer(connectApp).listen(port)` has nowhere to bind. This shim records the
// server + its request listener (vite's connect app) and exposes it on globalThis; the
// child's WorkerEntrypoint.fetch dispatches incoming workerd Requests into the connect app
// (via the proven req/res adapter). vite's own code (createServer, the dep optimizer in
// initServer, printUrls) runs UNMODIFIED — we supply the primitive, not a vite rewrite.
//
// The entire `await server.listen()` chain in vite blocks on exactly one thing: the
// server's 'listening' event. So listen() schedules that emit and records the port for
// httpServer.address() (which vite reads to print the Local: URL).
import { EventEmitter } from "node:events";

export const STATUS_CODES = {
  100: "Continue", 101: "Switching Protocols", 102: "Processing", 103: "Early Hints",
  200: "OK", 201: "Created", 202: "Accepted", 203: "Non-Authoritative Information",
  204: "No Content", 205: "Reset Content", 206: "Partial Content",
  301: "Moved Permanently", 302: "Found", 303: "See Other", 304: "Not Modified",
  307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 406: "Not Acceptable", 408: "Request Timeout",
  409: "Conflict", 410: "Gone", 411: "Length Required", 412: "Precondition Failed",
  413: "Payload Too Large", 414: "URI Too Long", 415: "Unsupported Media Type",
  416: "Range Not Satisfiable", 417: "Expectation Failed", 421: "Misdirected Request",
  422: "Unprocessable Entity", 425: "Too Early", 426: "Upgrade Required",
  428: "Precondition Required", 429: "Too Many Requests",
  431: "Request Header Fields Too Large", 451: "Unavailable For Legal Reasons",
  500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway",
  503: "Service Unavailable", 504: "Gateway Timeout", 505: "HTTP Version Not Supported",
};

export class Server extends EventEmitter {
  constructor(optsOrListener, maybeListener) {
    super();
    this.setMaxListeners(0);
    this._port = 0;
    this._host = "127.0.0.1";
    this._listening = false;
    const listener = typeof optsOrListener === "function" ? optsOrListener : maybeListener;
    if (typeof listener === "function") this.on("request", listener);
    // The child's fetch bridge picks the server up here once vite has created it.
    globalThis.__VITE_HTTP_SERVER = this;
  }

  // listen(port[, host][, backlog][, cb]) | listen(options[, cb]) | listen(cb)
  listen(...args) {
    let port, cb;
    for (const a of args) {
      if (typeof a === "function") cb = a;
      else if (typeof a === "number" && port == null) port = a;
      else if (typeof a === "string" && port == null && a !== "" && !Number.isNaN(Number(a))) port = Number(a);
      else if (a && typeof a === "object" && a.port != null) port = Number(a.port);
    }
    this._port = port || this._port || 5173;
    this._listening = true;
    if (cb) this.once("listening", cb);
    // vite's whole `await server.listen()` resolves off this event.
    queueMicrotask(() => this.emit("listening"));
    return this;
  }

  address() { return { address: this._host, family: "IPv4", port: this._port }; }

  close(cb) {
    this._listening = false;
    if (globalThis.__VITE_HTTP_SERVER === this) globalThis.__VITE_HTTP_SERVER = null;
    queueMicrotask(() => { this.emit("close"); if (typeof cb === "function") cb(); });
    return this;
  }

  setTimeout(_ms, cb) { if (typeof cb === "function") this.on("timeout", cb); return this; }
  ref() { return this; }
  unref() { return this; }
  get listening() { return this._listening; }
}

export function createServer(optsOrListener, maybeListener) {
  return new Server(optsOrListener, maybeListener);
}

export function get() { throw new Error("http.get is not supported in this isolate"); }
export function request() { throw new Error("http.request is not supported in this isolate"); }

const ServerResponse = class ServerResponse {};
const IncomingMessage = class IncomingMessage {};
const Agent = class Agent {};
const globalAgent = new Agent();
const METHODS = ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "CONNECT", "TRACE"];

export { ServerResponse, IncomingMessage, Agent, globalAgent, METHODS };
export default { STATUS_CODES, createServer, get, request, Server, ServerResponse, IncomingMessage, Agent, globalAgent, METHODS };
