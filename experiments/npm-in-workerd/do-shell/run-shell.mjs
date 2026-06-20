// Non-interactive shell demo: send a sequence of lines to the DO's /exec
// endpoint and print the transcript. Proves the shell runs over the DO's shared
// native /tmp across separate requests.
import { createShellHarness } from "./shell-host.mjs";

const verbose = process.env.VERBOSE === "1";
const { mf, stats } = await createShellHarness({ verbose });

async function exec(cmd, cwd) {
  const res = await mf.dispatchFetch("http://do.local/exec", {
    method: "POST",
    body: JSON.stringify({ cmd, cwd }),
    headers: { "content-type": "application/json" },
  });
  const j = await res.json();
  return j;
}

const SCRIPT = process.argv.slice(2);
const lines = SCRIPT.length
  ? SCRIPT
  : [
      "pwd",
      "echo hello world",
      "mkdir -p /tmp/proj/sub",
      "echo 'line1' > /tmp/proj/sub/a.txt",
      "echo 'line2' >> /tmp/proj/sub/a.txt",
      "cat /tmp/proj/sub/a.txt",
      "ls /tmp/proj/sub",
      "echo piped | cat",
      "cat /tmp/proj/sub/a.txt | wc -l",
    ];

await mf.dispatchFetch("http://do.local/init");
console.log("# DO shell transcript (each line is a SEPARATE request to the DO over shared /tmp)\n");
for (const line of lines) {
  const r = await exec(line);
  const out = (r.stdout ?? "").replace(/\n$/, "");
  const err = (r.stderr ?? "").replace(/\n$/, "");
  console.log(`do:/tmp/proj$ ${line}`);
  if (out) console.log(out);
  if (err) console.log("[stderr] " + err);
  if (r.error) console.log("[ERROR] " + r.error.split("\n").slice(0, 6).join("\n"));
}
console.log("\nfallback stats:", JSON.stringify(stats()));
await mf.dispose();
