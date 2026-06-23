// Non-interactive smoke test for the shell's real `npm create vite`.
//   MINIFLARE_WORKERD_PATH=~/Development/workerd-vfs.bin node test-npm-create.mjs
import { createShellHarness } from "./host.mjs";

const { mf } = await createShellHarness({ verbose: false });
async function exec(cmd) {
  const res = await mf.dispatchFetch("http://shell/exec", { method: "POST", body: JSON.stringify({ cmd }) });
  return res.json();
}

let ok = false;
try {
  console.log("$ npm create vite myapp -- --template react-ts");
  const r = await exec("npm create vite myapp -- --template react-ts");
  console.log("exitCode:", r.exitCode);
  if (r.stdout) console.log("--- stdout ---\n" + r.stdout);
  if (r.stderr) console.log("--- stderr ---\n" + r.stderr);

  console.log("\n$ ls myapp");
  const ls = await exec("ls myapp");
  console.log(ls.stdout + (ls.stderr || ""));

  console.log("$ cat myapp/package.json");
  const cat = await exec("cat myapp/package.json");
  console.log(cat.stdout.slice(0, 400) + (cat.stderr || ""));

  ok = r.exitCode === 0 && /package\.json/.test(ls.stdout) && /src/.test(ls.stdout);
  console.log(ok ? "\n  ->  PASS: real `npm create vite` scaffolded /tmp/proj/myapp in the shell\n"
                 : "\n  ->  scaffold incomplete; see above\n");
} catch (e) {
  console.error("ERROR:", e?.stack ?? e);
} finally {
  await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  process.exit(ok ? 0 : 1);
}
