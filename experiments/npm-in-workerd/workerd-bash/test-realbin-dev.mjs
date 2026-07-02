// E2E: shell's real-bin `vite dev` (cwd-driven) serves the app in a browser.
//   MINIFLARE_WORKERD_PATH=~/Development/workerd-vfs.bin node test-realbin-dev.mjs
import { createShellHarness } from "./host.mjs";

const PORT = Number(process.env.PORT || 5193);
const { mf } = await createShellHarness({ verbose: false, port: PORT });
const exec = async (cmd, cwd) => (await mf.dispatchFetch("http://shell/exec", { method: "POST", body: JSON.stringify({ cmd, cwd }) })).json();
const sh = (l, r) => console.log(`$ ${l}\n  exit=${r.exitCode} ${r.stdout ? r.stdout.trim().split("\n").slice(-3).join(" / ") : ""}${r.stderr ? " ERR:" + r.stderr.slice(0, 200) : ""}`);

let ok = false;
try {
  await mf.ready;
  sh("scaffold", await exec("scaffold", "/root/proj"));
  sh("npm install", await exec("npm install", "/root/proj"));
  sh("npm run dev", await exec("npm run dev", "/root/proj"));

  const base = `http://127.0.0.1:${PORT}`;
  let home = { status: 0 }, main = { status: 0 };
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(base + "/", { headers: { "sec-fetch-dest": "document" } });
      const body = await r.text();
      home = { status: r.status, isHtml: /<div id="root"|@vite\/client/i.test(body), len: body.length };
      if (home.isHtml) break;
    } catch (e) { home = { status: 0, err: String(e) }; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  try {
    const r = await fetch(base + "/src/main.tsx");
    const body = await r.text();
    main = { status: r.status, transformed: /jsxDEV|createRoot|\/node_modules\/\.vite\/deps/i.test(body) };
  } catch (e) { main = { status: 0, err: String(e) }; }
  // Pull App.tsx into the module graph (HMR only fires for modules the browser loaded).
  await fetch(base + "/src/App.tsx").then((r) => r.text()).catch(() => {});

  // HMR: open the vite-hmr ws, wait for 'connected', then edit a component via the shell
  // (sed) and confirm vite pushes an HMR update referencing App.tsx — i.e. the watch works.
  const msgs = [];
  let connected = false, update = null;
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/`, "vite-hmr");
  ws.addEventListener("message", (e) => {
    const m = typeof e.data === "string" ? e.data : "";
    msgs.push(m.slice(0, 200));
    try { const j = JSON.parse(m); if (j.type === "connected") connected = true; if (j.type === "update" || j.type === "full-reload") update = j; } catch {}
  });
  await new Promise((r) => setTimeout(r, 1500)); // let it connect + receive 'connected'

  console.log("\n$ sed -i 's/ToDo/ToDo Live/' src/App.tsx   (cwd /root/proj)");
  const sedRes = await exec("sed -i 's/ToDo/ToDo Live/' src/App.tsx", "/root/proj");
  sh("sed App.tsx", sedRes);
  console.log("  HMR flush:", JSON.stringify(sedRes.hmr));

  for (let i = 0; i < 50 && !update; i++) await new Promise((r) => setTimeout(r, 200)); // up to 10s
  try { ws.close(); } catch {}

  console.log("\n=== browser checks ===");
  console.log("GET /        ->", JSON.stringify(home));
  console.log("GET /main.tsx->", JSON.stringify(main));
  console.log("HMR connected->", connected);
  console.log("HMR msgs recv->", JSON.stringify(msgs));
  console.log("HMR update   ->", update ? JSON.stringify(update).slice(0, 220) : "(none received)");
  ok = home.isHtml && main.transformed && connected && !!update;
  console.log(ok ? "\n  -> PASS: edit a component via sed -> vite pushes a live HMR update to the browser\n"
                 : "\n  -> FAIL: see above\n");
} catch (e) {
  console.error("ERROR:", e?.stack ?? e);
} finally {
  await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  process.exit(ok ? 0 : 1);
}
