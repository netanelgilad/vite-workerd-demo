// just-bash inside the isolate, over THE shared memfs volume.
//
// Implements just-bash's IFileSystem on top of the same memfs instance that
// Vite (via the fs shim) and Rolldown (via its WASI fs option) use — one
// filesystem, three consumers, plus now a shell. Registers toolchain commands
// (vite-build, npm) that dispatch to the in-isolate JS APIs instead of
// spawning processes (there are none to spawn).
import path from "node:path";

import mfs from "/tmp/shims/fs.mjs";

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

export class MemfsAdapter {
  resolvePath(base, p) {
    return path.isAbsolute(p) ? path.normalize(p) : path.normalize(path.join(base, p));
  }
  async readFile(p, options) {
    const enc = typeof options === "string" ? options : options?.encoding;
    return mfs.readFileSync(p, (enc ?? "utf8"));
  }
  async readFileBuffer(p) {
    const b = mfs.readFileSync(p);
    return b instanceof Uint8Array ? b : new TextEncoder().encode(String(b));
  }
  async writeFile(p, content, options) {
    mfs.mkdirSync(path.dirname(p), { recursive: true });
    mfs.writeFileSync(p, content, typeof options === "string" ? options : options?.encoding ? options.encoding : undefined);
  }
  async appendFile(p, content, options) {
    mfs.appendFileSync(p, content, typeof options === "string" ? options : undefined);
  }
  async exists(p) {
    return mfs.existsSync(p);
  }
  async stat(p) {
    return toStat(mfs.statSync(p));
  }
  async lstat(p) {
    return toStat(mfs.lstatSync(p));
  }
  async mkdir(p, options) {
    mfs.mkdirSync(p, { recursive: options?.recursive ?? false });
  }
  async readdir(p) {
    return mfs.readdirSync(p).map(String);
  }
  async readdirWithFileTypes(p) {
    return mfs.readdirSync(p, { withFileTypes: true }).map((d) => ({
      name: String(d.name),
      isFile: d.isFile(),
      isDirectory: d.isDirectory(),
      isSymbolicLink: d.isSymbolicLink(),
    }));
  }
  async rm(p, options) {
    mfs.rmSync(p, { recursive: options?.recursive ?? false, force: options?.force ?? false });
  }
  async cp(src, dest, options) {
    const st = mfs.statSync(src);
    if (st.isDirectory()) {
      if (!options?.recursive) throw new Error(`cp: -r not specified; omitting directory '${src}'`);
      mfs.mkdirSync(dest, { recursive: true });
      for (const e of mfs.readdirSync(src)) await this.cp(path.join(src, String(e)), path.join(dest, String(e)), options);
    } else {
      mfs.mkdirSync(path.dirname(dest), { recursive: true });
      mfs.writeFileSync(dest, mfs.readFileSync(src));
    }
  }
  async mv(src, dest) {
    mfs.renameSync(src, dest);
  }
  getAllPaths() {
    const out = [];
    const walk = (d) => {
      for (const e of mfs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, String(e.name));
        out.push(p);
        if (e.isDirectory()) walk(p);
      }
    };
    try { walk("/"); } catch { try { walk("/tmp"); } catch {} }
    return out;
  }
  async chmod(p, mode) {
    mfs.chmodSync(p, mode);
  }
  async symlink(target, linkPath) {
    mfs.symlinkSync(target, linkPath);
  }
  async link(existingPath, newPath) {
    mfs.linkSync(existingPath, newPath);
  }
  async readlink(p) {
    return String(mfs.readlinkSync(p));
  }
  async realpath(p) {
    return String(mfs.realpathSync(p));
  }
  async utimes(p, atime, mtime) {
    mfs.utimesSync(p, atime, mtime);
  }
}

// ---- toolchain commands (no processes — JS APIs over the same volume) ----

async function makeToolchainCommands({ runBuild }) {
  const { defineCommand } = await import("just-bash");

  // `vite build [--mode m]` — dispatches to the in-isolate Vite JS API
  const vite = defineCommand("vite", async (args) => {
    if (args[0] === "build") {
      const modeIdx = args.indexOf("--mode");
      const mode = modeIdx !== -1 ? args[modeIdx + 1] : "production";
      try {
        const result = await runBuild(mode);
        const files = Object.keys(result.dist).map((f) => `  dist/${f}`).join("\n");
        return { stdout: `vite build (in-isolate, rolldown-wasm) ok in ${result.ms}ms\n${files}\n`, stderr: "", exitCode: 0 };
      } catch (e) {
        return { stdout: "", stderr: `vite build failed: ${e}\n`, exitCode: 1 };
      }
    }
    return { stdout: "", stderr: `vite: only 'build' is wired in the isolate shell (got: ${args.join(" ")})\n`, exitCode: 2 };
  });

  // `npm run <script>` — parse package.json scripts, re-exec through the shell
  const npm = defineCommand("npm", async (args, ctx) => {
    if (args[0] === "run" && args[1]) {
      let pkg;
      try { pkg = JSON.parse(mfs.readFileSync("/tmp/app/package.json", "utf8")); }
      catch { return { stdout: "", stderr: "npm: no package.json at /tmp/app\n", exitCode: 1 }; }
      const script = pkg.scripts?.[args[1]];
      if (!script) return { stdout: "", stderr: `npm: missing script: ${args[1]}\n`, exitCode: 1 };
      const r = await bashInstance.exec(script, { cwd: "/tmp/app" });
      return { stdout: `> ${script}\n` + r.stdout, stderr: r.stderr, exitCode: r.exitCode };
    }
    return { stdout: "", stderr: "npm: only 'npm run <script>' is supported in the isolate shell\n", exitCode: 2 };
  });

  // typecheck is a separate concern (typescript API); succeed so npm scripts flow
  const tsc = defineCommand("tsc", async () => ({ stdout: "tsc: skipped in isolate shell (typecheck runs via driver op)\n", stderr: "", exitCode: 0 }));

  return [vite, npm, tsc];
}

let bashInstance;
export async function getBash({ runBuild }) {
  if (!bashInstance) {
    const { Bash } = await import("just-bash");
    bashInstance = new Bash({ fs: new MemfsAdapter(), cwd: "/tmp/app", defenseInDepth: false });
    for (const cmd of await makeToolchainCommands({ runBuild })) bashInstance.registerCommand(cmd);
  }
  return bashInstance;
}
