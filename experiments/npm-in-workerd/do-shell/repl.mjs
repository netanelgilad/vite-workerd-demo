// Interactive REPL: a real "shell into the DO" experience. Reads a line from
// stdin, POSTs it to the DO's /exec endpoint, prints stdout/stderr, repeats.
// The DO keeps ONE shared native /tmp across every line (separate requests).
//
//   MINIFLARE_WORKERD_PATH=/tmp/workerd-fork-shared-bin node do-shell/repl.mjs
//
// Try:
//   pwd
//   npm install left-pad
//   ls node_modules
//   echo hi > /tmp/proj/note.txt
//   spawn read /tmp/proj/note.txt   # a sub-isolate reads the shared fs
//   exit
import readline from "node:readline";

import { createShellHarness } from "./shell-host.mjs";

const { mf, stats } = await createShellHarness({ verbose: process.env.VERBOSE === "1" });
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

const isTTY = process.stdin.isTTY;
const rl = readline.createInterface({ input: process.stdin, terminal: isTTY });

console.log("# Shell into the DO. Type commands; 'exit' to quit. Shared native /tmp persists across lines.");

async function handle(cmd) {
  if (cmd === "stats") { console.log(JSON.stringify(stats())); return; }
  // local `cd` so the prompt and cwd track (just-bash exec is stateless per call)
  if (cmd.startsWith("cd ")) {
    const target = cmd.slice(3).trim();
    cwd = target.startsWith("/") ? target : (cwd.replace(/\/$/, "") + "/" + target);
    return;
  }
  const r = await exec(cmd);
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.error) console.error("[ERROR] " + r.error.split("\n").slice(0, 8).join("\n"));
}

// Async iterate over input lines: each line is fully handled (await) before the
// next is read. Works for both interactive TTY and piped/scripted stdin.
const prompt = () => { if (isTTY) process.stdout.write(`do:${cwd}$ `); };
prompt();
for await (const line of rl) {
  const cmd = line.trim();
  if (!cmd) { prompt(); continue; }
  if (cmd === "exit" || cmd === "quit") break;
  if (!isTTY) console.log(`do:${cwd}$ ${cmd}`);
  try { await handle(cmd); } catch (e) { console.error("[host error] " + e); }
  prompt();
}

console.log("\nfallback stats:", JSON.stringify(stats()));
await mf.dispose();
process.exit(0);
