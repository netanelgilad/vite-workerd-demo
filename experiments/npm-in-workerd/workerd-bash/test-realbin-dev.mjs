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
  sh("scaffold", await exec("scaffold", "/tmp/proj"));
  sh("npm install", await exec("npm install", "/tmp/proj"));
  sh("npm run dev", await exec("npm run dev", "/tmp/proj"));

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

  // HMR: open the vite-hmr WebSocket the /@vite/client would, expect vite's 'connected'.
  let hmr = { connected: false };
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/`, "vite-hmr");
    hmr = await new Promise((resolve) => {
      const to = setTimeout(() => { try { ws.close(); } catch {} resolve({ connected: false, reason: "timeout" }); }, 8000);
      ws.addEventListener("message", (e) => {
        const msg = typeof e.data === "string" ? e.data : "";
        if (msg.includes("connected")) { clearTimeout(to); try { ws.close(); } catch {} resolve({ connected: true, msg: msg.slice(0, 60) }); }
      });
      ws.addEventListener("error", () => { clearTimeout(to); resolve({ connected: false, reason: "error" }); });
    });
  } catch (e) { hmr = { connected: false, reason: String(e).slice(0, 80) }; }

  console.log("\n=== browser checks ===");
  console.log("GET /        ->", JSON.stringify(home));
  console.log("GET /main.tsx->", JSON.stringify(main));
  console.log("HMR ws       ->", JSON.stringify(hmr));
  ok = home.isHtml && main.transformed && hmr.connected;
  console.log(ok ? "\n  -> PASS: shell's real-bin vite dev serves + transforms the app in the browser\n"
                 : "\n  -> FAIL: see above\n");
} catch (e) {
  console.error("ERROR:", e?.stack ?? e);
} finally {
  await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  process.exit(ok ? 0 : 1);
}
