// just-bash IFileSystem adapter over workerd's NATIVE node:fs (the DO's shared
// /tmp). Adapted from harness/shims/bash.mjs (which used memfs) — same interface,
// but backed by real node:fs so the shell, npm install, and any sub-isolate all
// see ONE filesystem (the DO's persisted /tmp).
import * as fs from "node:fs";
import path from "node:path";

function toStat(s) {
  return {
    isFile: s.isFile(),
    isDirectory: s.isDirectory(),
    isSymbolicLink: s.isSymbolicLink(),
    mode: Number(s.mode) & 0o777,
    size: Number(s.size),
    mtime: new Date(Number(s.mtimeMs ?? Date.now())),
  };
}

export class NativeFsAdapter {
  resolvePath(base, p) {
    return path.isAbsolute(p) ? path.normalize(p) : path.normalize(path.join(base, p));
  }
  async readFile(p, options) {
    const enc = typeof options === "string" ? options : options?.encoding;
    return fs.readFileSync(p, enc ?? "utf8");
  }
  async readFileBuffer(p) {
    const b = fs.readFileSync(p);
    return b instanceof Uint8Array ? b : new TextEncoder().encode(String(b));
  }
  async writeFile(p, content, options) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, typeof options === "string" ? options : options?.encoding ? options.encoding : undefined);
  }
  async appendFile(p, content, options) {
    fs.appendFileSync(p, content, typeof options === "string" ? options : undefined);
  }
  async exists(p) { return fs.existsSync(p); }
  async stat(p) { return toStat(fs.statSync(p)); }
  async lstat(p) { return toStat(fs.lstatSync(p)); }
  async mkdir(p, options) { fs.mkdirSync(p, { recursive: options?.recursive ?? false }); }
  async readdir(p) { return fs.readdirSync(p).map(String); }
  async readdirWithFileTypes(p) {
    return fs.readdirSync(p, { withFileTypes: true }).map((d) => ({
      name: String(d.name),
      isFile: d.isFile(),
      isDirectory: d.isDirectory(),
      isSymbolicLink: d.isSymbolicLink(),
    }));
  }
  async rm(p, options) {
    fs.rmSync(p, { recursive: options?.recursive ?? false, force: options?.force ?? false });
  }
  async cp(src, dest, options) {
    const st = fs.statSync(src);
    if (st.isDirectory()) {
      if (!options?.recursive) throw new Error(`cp: -r not specified; omitting directory '${src}'`);
      fs.mkdirSync(dest, { recursive: true });
      for (const e of fs.readdirSync(src)) await this.cp(path.join(src, String(e)), path.join(dest, String(e)), options);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, fs.readFileSync(src));
    }
  }
  async mv(src, dest) { fs.renameSync(src, dest); }
  getAllPaths() {
    const out = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, String(e.name));
        out.push(p);
        if (e.isDirectory()) walk(p);
      }
    };
    try { walk("/tmp"); } catch {}
    return out;
  }
  async chmod(p, mode) { fs.chmodSync(p, mode); }
  async symlink(target, linkPath) { fs.symlinkSync(target, linkPath); }
  async link(a, b) { fs.linkSync(a, b); }
  async readlink(p) { return String(fs.readlinkSync(p)); }
  async realpath(p) { return String(fs.realpathSync(p)); }
  async utimes(p, atime, mtime) { fs.utimesSync(p, atime, mtime); }
}
