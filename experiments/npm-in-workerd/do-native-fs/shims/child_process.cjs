// workerd child_process shim.
//
// workerd has no process model, so node:child_process.spawn() is the ONE missing
// OS primitive in the "run real npm inside a DO" stack. This shim provides it by
// mapping spawn() onto an ISOLATE-spawn over the DO's shared /tmp: the heavy lifting
// (parse `sh -c`, resolve the bin to a JS entry, run it in a Worker-Loader child,
// capture stdout/stderr/exit) is done by globalThis.__ISOLATE_SPAWN, which the DO
// installs before invoking npm. With this in place, real @npmcli/promise-spawn,
// @npmcli/run-script and libnpmexec run UNMODIFIED — we patch the missing syscall,
// not the packages that use it.
const { EventEmitter } = require("node:events");

function makeStream() {
  const s = new EventEmitter();
  s.readable = true;
  s.pipe = () => s;
  s.setEncoding = () => s;
  s.resume = () => s;
  s.pause = () => s;
  s.destroy = () => {};
  return s;
}

function spawn(file, args = [], options = {}) {
  const child = new EventEmitter();
  const stdout = makeStream();
  const stderr = makeStream();
  child.stdout = stdout;
  child.stderr = stderr;
  child.stdin = { write() { return true; }, end() {}, on() {}, once() {}, destroy() {} };
  child.pid = -1;
  child.killed = false;
  child.kill = () => { child.killed = true; return true; };

  const bridge = globalThis.__ISOLATE_SPAWN;
  if (typeof bridge !== "function") {
    queueMicrotask(() =>
      child.emit("error", new Error("child_process.spawn unsupported in this isolate: no __ISOLATE_SPAWN bridge installed")));
    return child;
  }

  Promise.resolve(bridge(file, args, options)).then((res) => {
    res = res || {};
    // Emit captured output (listeners attached synchronously by the caller after
    // spawn() returns, so emitting on this later microtask is safe).
    if (res.stdout) stdout.emit("data", Buffer.from(String(res.stdout)));
    stdout.emit("end");
    if (res.stderr) stderr.emit("data", Buffer.from(String(res.stderr)));
    stderr.emit("end");
    const code = res.code == null ? 0 : res.code;
    const signal = res.signal == null ? null : res.signal;
    child.emit("exit", code, signal);
    child.emit("close", code, signal);
  }).catch((e) => child.emit("error", e));

  return child;
}

const unsupported = (name) => () => { throw new Error(`child_process.${name} is not supported in this isolate`); };

module.exports = {
  spawn,
  spawnSync: unsupported("spawnSync"),
  exec: unsupported("exec"),
  execSync: unsupported("execSync"),
  execFile: unsupported("execFile"),
  execFileSync: unsupported("execFileSync"),
  fork: unsupported("fork"),
  ChildProcess: function ChildProcess() {},
};
module.exports.default = module.exports;
