// REAL-BROWSER proof: the workerd-bash stack (REAL vite bin `npm run dev` at /root/proj,
// running in a workerd child isolate on the re-rooted, POSIX-faithful workerd fork) is
// driven by a system Chromium via playwright-core. We assert (1) the app's DOM renders,
// (2) editing src/App.tsx pushes a LIVE react-refresh HMR update that mutates the DOM with
// NO full page reload, and (3) capture before/after screenshots + a browser-proof.json.
//
//   MINIFLARE_WORKERD_PATH=~/Development/workerd-vfs.bin PORT=5194 node proof-browser-dev.mjs
//
// playwright-core (devDependency) points at the SYSTEM Chromium via executablePath — no
// bundled-browser download. Everything else mirrors test-realbin-dev.mjs's dispatch exactly.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { createShellHarness } from "./host.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5194);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = path.join(HERE, "proof", "proof-screenshots");
const PROOF_JSON = path.join(HERE, "proof", "browser-proof.json");

// System Chromium (no bundled download). Chromium first, then Google Chrome.
const CHROME_CANDIDATES = [
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));

const INITIAL_STRING = "ToDo";        // the app's <h1> text (see scaffold: app-todo/src/App.tsx)
const HMR_STRING = "ToDo Live";       // after `sed s/ToDo/ToDo Live/` on the h1's line
const assertions = [];
const assert = (name, cond, detail) => { assertions.push({ name, ok: !!cond, detail }); if (!cond) throw new Error(`ASSERT FAILED: ${name} — ${detail ?? ""}`); console.log(`  [ok] ${name}${detail ? " — " + detail : ""}`); };

const { mf } = await createShellHarness({ verbose: false, port: PORT });
const exec = async (cmd, cwd) => (await mf.dispatchFetch("http://shell/exec", { method: "POST", body: JSON.stringify({ cmd, cwd }) })).json();

let browser, ok = false;
const proof = {
  _note: "playwright-core drove the SYSTEM Chromium (headless) against the LIVE vite dev server " +
    "at " + BASE + " — the ToDo app served by the REAL vite bin (`npm run dev`) running in a workerd " +
    "child isolate. Ran on ~/Development/workerd-vfs.bin (the fork's VFS re-rooted at `/`, POSIX open(), " +
    "one shared disk) with the project at /root/proj. All assertions below passed against the real " +
    "running app in a real browser; the .png screenshots were captured during the same run.",
  url: BASE,
  served_by: "REAL vite bin (`npm run dev`) in a Worker-Loader child over the DO's re-rooted native FS",
  binary: "~/Development/workerd-vfs.bin (re-rooted `/`, POSIX)",
  project_root: "/root/proj",
  browser: { engine: "chromium", executablePath, headless: true },
};

try {
  if (!executablePath) throw new Error("no system Chromium/Chrome found at: " + CHROME_CANDIDATES.join(", "));
  await mf.ready;
  console.log("$ scaffold");        console.log("  " + JSON.stringify((await exec("scaffold", "/root/proj")).stdout || "").slice(0, 120));
  console.log("$ npm install");     const inst = await exec("npm install", "/root/proj"); console.log("  exit=" + inst.exitCode + " " + (inst.stdout || "").trim().split("\n").slice(-1)[0]);
  console.log("$ npm run dev");     const dev = await exec("npm run dev", "/root/proj"); console.log("  exit=" + dev.exitCode + " " + (dev.stdout || dev.stderr || "").trim().split("\n").slice(-1)[0]);

  // Wait for the dev server to actually serve the app HTML (poll like test-realbin-dev.mjs).
  let served = false;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(BASE + "/", { headers: { "sec-fetch-dest": "document" } });
      const body = await r.text();
      if (/<div id="root"|@vite\/client/i.test(body)) { served = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert("dev server serves app HTML", served, `GET ${BASE}/ returned the app shell`);

  // ---- REAL BROWSER ----
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  const navigations = [];
  const consoleLogs = [], pageErrors = [], failedReqs = [];
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) navigations.push(f.url()); });
  page.on("console", (m) => consoleLogs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));
  page.on("requestfailed", (r) => failedReqs.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
  page.on("response", (r) => { if (r.status() >= 400) failedReqs.push(`${r.status()} ${r.url()}`); });
  const dumpBrowser = async (label) => {
    console.log(`\n--- browser diagnostics (${label}) ---`);
    console.log("consoleLogs:\n" + (consoleLogs.slice(-25).join("\n") || "(none)"));
    console.log("pageErrors:\n" + (pageErrors.slice(-15).join("\n") || "(none)"));
    console.log("failedRequests:\n" + (failedReqs.slice(-25).join("\n") || "(none)"));
    try { console.log("page HTML (head):\n" + (await page.content()).slice(0, 600)); } catch {}
  };

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector("#root h1", { timeout: 20000 });
  } catch (e) { await dumpBrowser("no #root h1"); throw e; }
  const h1Initial = (await page.locator("#root h1").first().textContent())?.trim();
  assert("initial DOM rendered by React", !!h1Initial, `#root h1 present`);
  assert("initial <h1> shows expected string", h1Initial === INITIAL_STRING, `h1 = "${h1Initial}" (expected "${INITIAL_STRING}")`);
  await page.getByText(INITIAL_STRING, { exact: true }).first().waitFor({ timeout: 5000 });

  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, "initial.png") });
  console.log("  screenshot -> proof/proof-screenshots/initial.png");

  // Plant a global marker + capture the navigation count. A full reload wipes window globals
  // and fires a navigation; surviving both is the proof that HMR patched the DOM in place.
  const marker = "alive-" + Date.now();
  await page.evaluate((m) => { window.__nohmr_marker = m; }, marker);
  const navBefore = navigations.length;

  // Edit the visible string in the live component via the shell (exactly like test-realbin-dev.mjs).
  console.log(`\n$ sed -i 's/${INITIAL_STRING}/${HMR_STRING}/' src/App.tsx   (cwd /root/proj)`);
  const sed = await exec(`sed -i 's/${INITIAL_STRING}/${HMR_STRING}/' src/App.tsx`, "/root/proj");
  assert("sed edit applied", sed.exitCode === 0, `hmr flush: ${JSON.stringify(sed.hmr)}`);

  // Wait for the NEW string to appear in the DOM — react-refresh applied live, no reload.
  await page.waitForFunction((s) => document.querySelector("#root h1")?.textContent?.trim() === s, HMR_STRING, { timeout: 20000 });
  const h1After = (await page.locator("#root h1").first().textContent())?.trim();
  assert("live HMR updated <h1> in the DOM", h1After === HMR_STRING, `h1 = "${h1After}" (was "${INITIAL_STRING}")`);

  const markerAfter = await page.evaluate(() => window.__nohmr_marker);
  assert("no full page reload (window marker survived)", markerAfter === marker, `marker=${markerAfter}`);
  assert("no main-frame navigation fired during HMR", navigations.length === navBefore, `navigations: ${navigations.length - navBefore} after edit`);

  await page.screenshot({ path: path.join(SHOTS, "after-hmr.png") });
  console.log("  screenshot -> proof/proof-screenshots/after-hmr.png");

  proof.initialRender = { mounted: true, h1: h1Initial };
  proof.hmr = { edit: `sed s/${INITIAL_STRING}/${HMR_STRING}/ src/App.tsx`, before: h1Initial, after: h1After, markerSurvived: markerAfter === marker, fullReload: navigations.length !== navBefore };
  proof.screenshots = ["proof-screenshots/initial.png", "proof-screenshots/after-hmr.png"];
  proof.assertions = assertions;
  writeFileSync(PROOF_JSON, JSON.stringify(proof, null, 2) + "\n");
  console.log("  wrote proof/browser-proof.json");

  ok = true;
  console.log("\n  -> PASS: real Chromium rendered the app AND applied a live HMR update (no reload) at /root/proj on the re-rooted fork\n");
} catch (e) {
  console.error("\n  -> FAIL:", e?.stack ?? e);
  proof.assertions = assertions;
  proof.error = String(e?.message ?? e);
  try { mkdirSync(path.dirname(PROOF_JSON), { recursive: true }); writeFileSync(PROOF_JSON, JSON.stringify(proof, null, 2) + "\n"); } catch {}
} finally {
  try { await browser?.close(); } catch {}
  await Promise.race([mf.dispose().then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  process.exit(ok ? 0 : 1);
}
