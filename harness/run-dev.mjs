// Real vite dev server — but running inside workerd.
//
// Boots the isolate, drives the dep optimizer to completion once (workerd
// cancels pending I/O when a request context ends, so the prebundle must finish
// inside a single request), then leaves workerd listening on a real port. Open
// the printed URL in a browser and use the app like any vite dev server.
import { createHarness } from "./host.mjs";

const PORT = Number(process.env.PORT ?? 5173);
const { mf } = await createHarness({ port: PORT });

// Resolve the actual listening URL (miniflare may pick another port if taken).
const url = await mf.ready;
const origin = url.origin;

process.stdout.write("Booting vite dev server inside workerd (warming up deps)…\n");
const warm = await (await mf.dispatchFetch(origin + "/dev/warmup")).json();
if (!warm.ok) {
  console.error("warmup failed:", JSON.stringify(warm, null, 2));
  await mf.dispose();
  process.exit(1);
}

console.log(`\n  ➜  Local:   ${origin}/`);
console.log(`  ➜  vite ${"dev server"} running inside workerd  (warmup ${warm.ms}ms, deps prebundled: ${Object.keys(warm.depResults ?? {}).length})`);
console.log("\n  Open the URL above in a browser. Ctrl-C to stop.\n");

const shutdown = async () => { await mf.dispose(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
