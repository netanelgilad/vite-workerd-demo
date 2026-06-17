// In-heap filesystem for the isolate. workerd's own node:fs VFS is
// per-request (writes vanish between requests and are invisible to module
// evaluation), so the project tree lives in a memfs volume in module state,
// which persists for the isolate's lifetime. Served in place of node:fs.
import { createFsFromVolume, Volume } from "memfs";

// One shared volume for the whole isolate, even if this module is instantiated
// more than once (workerd keeps separate ESM-import and CJS-require instances
// of the same file; without a global singleton the driver's writes and npm's
// reads would land in two different volumes).
export const vol = globalThis.__MEMFS_VOL ?? (globalThis.__MEMFS_VOL = new Volume());
const mfs = createFsFromVolume(vol);

// vite probes fs.realpathSync.native on startup
if (mfs.realpathSync && !mfs.realpathSync.native) {
  mfs.realpathSync.native = (...args) => mfs.realpathSync(...args);
}
if (mfs.realpath && !mfs.realpath.native) {
  mfs.realpath.native = (...args) => mfs.realpath(...args);
}

// memfs cannot open the root dir '/' as an fd (returns ENOENT); WASI/preopen
// code sometimes does. Return a synthetic read-only fd for it.
const __origOpenSync = mfs.openSync.bind(mfs);
let __rootFd = 2147483000;
mfs.openSync = (p, flags, mode) => {
  if (p === "/" || p === "//") { try { return __origOpenSync("/tmp", flags ?? "r", mode); } catch { return __rootFd--; } }
  return __origOpenSync(p, flags, mode);
};

export default mfs;
export const promises = mfs.promises;
export const constants = mfs.constants ?? {};

export const accessSync = mfs.accessSync.bind(mfs);
export const access = mfs.access.bind(mfs);
export const appendFileSync = mfs.appendFileSync.bind(mfs);
export const appendFile = mfs.appendFile.bind(mfs);
export const chmodSync = mfs.chmodSync.bind(mfs);
export const chmod = mfs.chmod.bind(mfs);
export const closeSync = mfs.closeSync.bind(mfs);
export const close = mfs.close.bind(mfs);
export const copyFileSync = mfs.copyFileSync.bind(mfs);
export const copyFile = mfs.copyFile.bind(mfs);
export const createReadStream = mfs.createReadStream.bind(mfs);
export const createWriteStream = mfs.createWriteStream.bind(mfs);
export const existsSync = mfs.existsSync.bind(mfs);
export const exists = mfs.exists.bind(mfs);
export const fstatSync = mfs.fstatSync.bind(mfs);
export const fstat = mfs.fstat.bind(mfs);
export const lstatSync = mfs.lstatSync.bind(mfs);
export const lstat = mfs.lstat.bind(mfs);
export const mkdirSync = mfs.mkdirSync.bind(mfs);
export const mkdir = mfs.mkdir.bind(mfs);
export const mkdtempSync = mfs.mkdtempSync.bind(mfs);
export const mkdtemp = mfs.mkdtemp.bind(mfs);
export const openSync = mfs.openSync.bind(mfs);
export const open = mfs.open.bind(mfs);
export const readFileSync = mfs.readFileSync.bind(mfs);
export const readFile = mfs.readFile.bind(mfs);
export const readSync = mfs.readSync.bind(mfs);
export const read = mfs.read.bind(mfs);
export const readdirSync = mfs.readdirSync.bind(mfs);
export const readdir = mfs.readdir.bind(mfs);
export const readlinkSync = mfs.readlinkSync.bind(mfs);
export const readlink = mfs.readlink.bind(mfs);
export const realpathSync = mfs.realpathSync;
export const realpath = mfs.realpath;
export const renameSync = mfs.renameSync.bind(mfs);
export const rename = mfs.rename.bind(mfs);
export const rmSync = mfs.rmSync.bind(mfs);
export const rm = mfs.rm.bind(mfs);
export const rmdirSync = mfs.rmdirSync.bind(mfs);
export const rmdir = mfs.rmdir.bind(mfs);
export const statSync = mfs.statSync.bind(mfs);
export const stat = mfs.stat.bind(mfs);
export const symlinkSync = mfs.symlinkSync.bind(mfs);
export const symlink = mfs.symlink.bind(mfs);
export const truncateSync = mfs.truncateSync.bind(mfs);
export const truncate = mfs.truncate.bind(mfs);
export const unlinkSync = mfs.unlinkSync.bind(mfs);
export const unlink = mfs.unlink.bind(mfs);
export const utimesSync = mfs.utimesSync.bind(mfs);
export const utimes = mfs.utimes.bind(mfs);
export const watch = mfs.watch.bind(mfs);
export const watchFile = mfs.watchFile.bind(mfs);
export const unwatchFile = mfs.unwatchFile.bind(mfs);
export const writeFileSync = mfs.writeFileSync.bind(mfs);
export const writeFile = mfs.writeFile.bind(mfs);
export const writeSync = mfs.writeSync.bind(mfs);
export const write = mfs.write.bind(mfs);
export const Stats = mfs.Stats;
export const Dirent = mfs.Dirent;
export const ReadStream = mfs.ReadStream;
export const WriteStream = mfs.WriteStream;
