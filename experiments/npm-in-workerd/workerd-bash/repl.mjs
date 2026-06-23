#!/usr/bin/env node
// workerd-bash: an interactive shell INTO a workerd v8 isolate (a Durable Object)
// over its shared NATIVE /tmp. You type commands; they run inside the isolate.
// Culminates in `vite dev` serving the ToDo app — installed from public npm and
// run from /tmp — on a reachable port you open in your browser.
//
//   ONE COMMAND:  ./repl.mjs        (or:  npm start  /  npx workerd-bash)
//
// The launcher locates the workerd FORK binary itself (no env needed):
//   1. $MINIFLARE_WORKERD_PATH  (explicit override)
//   2. ~/Development/workerd-vfs.bin   (the stable fork build)
//   3. /tmp/workerd-vfsmod-bin
//   ...else a clear error telling you how to build the fork.
//
// Try, in order:
//   help
//   pwd ; ls ; echo hi > note.txt ; cat note.txt
//   npm install            # @netanelgilad/vite + ToDo deps from public npm (slow/flaky — retry if it hangs)
//   scaffold               # write the ToDo app source into /tmp/proj
//   vite build             # build from /tmp in a child isolate
//   vite dev               # boot the dev server; prints a URL to open in your browser
//   exit
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

// --- locate the fork binary and wire MINIFLARE_WORKERD_PATH before miniflare loads ---
function locateWorkerd() {
  const candidates = [
    process.env.MINIFLARE_WORKERD_PATH,
    path.join(os.homedir(), "Development", "workerd-vfs.bin"),
    "/tmp/workerd-vfsmod-bin",
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

const workerd = locateWorkerd();
if (!workerd) {
  console.error(
    "workerd-bash: could not find the workerd FORK binary.\n" +
    "  Looked at: $MINIFLARE_WORKERD_PATH, ~/Development/workerd-vfs.bin, /tmp/workerd-vfsmod-bin\n\n" +
    "  This demo needs the VFS-module-loading fork (branch feat/vfs-module-loading).\n" +
    "  Build it, then either copy it to ~/Development/workerd-vfs.bin or set\n" +
    "  MINIFLARE_WORKERD_PATH=/path/to/workerd  and re-run."
  );
  process.exit(2);
}
process.env.MINIFLARE_WORKERD_PATH = workerd;

// miniflare reads MINIFLARE_WORKERD_PATH at import time -> import host.mjs AFTER setting it.
const { createShellHarness } = await import("./host.mjs");

const PORT = Number(process.env.PORT ?? 5190);
const { mf, stats } = await createShellHarness({ verbose: process.env.VERBOSE === "1", port: PORT });
await mf.ready;
await mf.dispatchFetch("http://do.local/init");

let cwd = "/tmp/proj";
async function exec(cmd) {
  const res = await mf.dispatchFetch("http://do.local/exec", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cmd, cwd }),
  });
  return res.json();
}

const HELP = `workerd-bash — a shell INTO a workerd v8 isolate over its shared native /tmp.

  filesystem (just-bash, real native /tmp inside the isolate):
    pwd  ls  cat  echo  mkdir  rm  cd  | pipes  > redirects
  toolchain:
    npm install [pkgs...]   install into /tmp/proj/node_modules from public npm.
                            no args -> @netanelgilad/vite + the ToDo app's deps.
    npm ls                  list installed packages
    scaffold                write the ToDo app source into /tmp/proj
    vite build              build the app from /tmp in a child isolate
    vite dev                boot the dev server (from /tmp, in a child) and print a URL
    npm run dev             alias for vite dev
  shell:
    help    this text
    exit    quit (stops the isolate + dev server)

  typical flow:  npm install  ->  vite dev  ->  open the printed URL in your browser`;

const isTTY = !!process.stdin.isTTY;
// `output` is REQUIRED for readline to echo your keystrokes in terminal mode — without it
// typing is invisible. Pass it explicitly.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: isTTY });

console.log(`# workerd-bash — fork binary: ${workerd}`);
console.log(`# you are inside a workerd Durable Object's native /tmp. Type 'help'. Dev server port: ${PORT}.`);

async function handle(cmd) {
  if (cmd === "help" || cmd === "?") { console.log(HELP); return; }
  if (cmd === "stats") { console.log(JSON.stringify(stats())); return; }
  // local `cd` so the prompt + cwd track (just-bash exec is stateless per call)
  if (cmd === "cd" || cmd.startsWith("cd ")) {
    const target = cmd === "cd" ? "/tmp/proj" : cmd.slice(3).trim();
    cwd = target.startsWith("/") ? path.normalize(target) : path.normalize(cwd.replace(/\/$/, "") + "/" + target);
    return;
  }
  const r = await exec(cmd);
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.error) console.error("[ERROR] " + r.error.split("\n").slice(0, 12).join("\n"));
}

const setPrompt = () => rl.setPrompt(`workerd:${cwd}$ `);

// Event-based loop (more robust than `for await`, which pauses input between lines and can
// swallow echo). readline echoes input itself in terminal mode. Commands are SERIALIZED via
// a queue so that fast input / a piped script runs one-at-a-time and in order (otherwise
// async handlers race and `exit` can dispose mid-command).
const queue = [];
let draining = false;
let inputEnded = false;
let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n# bye — fallback stats: " + JSON.stringify(stats()));
  // dispose can hang on a shared-tmp child; cap it then hard-exit.
  await Promise.race([mf.dispose(), new Promise((r) => setTimeout(r, 3000))]);
  process.exit(0);
}

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const cmd = queue.shift();
    if (cmd === "exit" || cmd === "quit") { inputEnded = true; break; }
    if (!isTTY) console.log(`workerd:${cwd}$ ${cmd}`);
    try { await handle(cmd); } catch (e) { console.error("[host error] " + e); }
    setPrompt();
    rl.prompt();
  }
  draining = false;
  if (inputEnded) await shutdown(); // dispose only AFTER the queue is drained
}

setPrompt();
rl.prompt();
rl.on("line", (line) => {
  const cmd = line.trim();
  if (!cmd) { if (!draining) rl.prompt(); return; }
  queue.push(cmd);
  drain();
});
// EOF (Ctrl-D) or end of a piped script: finish queued commands, then shut down.
rl.on("close", () => { inputEnded = true; drain(); });
