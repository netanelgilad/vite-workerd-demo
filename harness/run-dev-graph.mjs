import { createHarness } from "./host.mjs";
const { mf } = await createHarness();
const get = async (p) => {
  const res = await mf.dispatchFetch("http://localhost/preview" + p);
  return { status: res.status, type: res.headers.get("content-type"), text: await res.text() };
};
console.log("warmup:", (await (await mf.dispatchFetch("http://localhost/dev/warmup")).text()));

const html = await get("/");
console.log("--- index.html ---\n" + html.text);

// crawl: follow every /​-rooted import found in served JS, like a browser would
const seen = new Set();
const queue = ["/src/main.tsx", "/@vite/client"];
const results = [];
while (queue.length) {
  const u = queue.shift();
  if (seen.has(u)) continue;
  seen.add(u);
  const r = await get(u);
  results.push(`${r.status} ${String(r.type).split(";")[0]} ${String(r.text.length).padStart(7)}b  ${u}`);
  if (r.status === 200 && /javascript/.test(r.type ?? "")) {
    for (const m of r.text.matchAll(/from\s+"(\/[^"]+)"|import\s+"(\/[^"]+)"|import\("(\/[^"]+)"\)/g)) {
      const dep = m[1] ?? m[2] ?? m[3];
      if (dep && !seen.has(dep) && !dep.startsWith("/@id/__x00__")) queue.push(dep);
    }
  }
  if (seen.size > Number(process.env.CRAWL_MAX ?? 120)) break;
}
console.log(results.join("\n"));
process.exit(0);
