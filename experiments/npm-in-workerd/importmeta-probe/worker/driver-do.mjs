// FAST probe (no npm install): write an ESM module + a sibling CJS dep to the DO's /tmp,
// import the module in a VFS child, and read back import.meta.url + a fileURLToPath round
// trip + createRequire(import.meta.url) + new URL(rel, import.meta.url). Validates the
// workerd loader fix (legacy-registry import.meta initializer) end to end.
import * as nodeFs from "node:fs";
function installGlobals(env) { globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL; }
const CHILD_FLAGS = ["nodejs_compat", "nodejs_compat_v2", "experimental", "enable_nodejs_fs_module"];
function probeChild() {
  return {
    compatibilityDate: "2026-06-01",
    compatibilityFlags: CHILD_FLAGS,
    allowExperimental: true,
    shareParentTmp: true,
    vfsModuleFallback: true,
    mainModule: "main.js",
    modules: { "main.js": `export { default } from "/tmp/proj/probe.mjs";` },
  };
}
export class NpmChildRunner {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    installGlobals(this.env);
    const fs = nodeFs;
    fs.mkdirSync("/tmp/proj", { recursive: true });
    fs.writeFileSync("/tmp/proj/dep.cjs", "module.exports = 42;");
    fs.writeFileSync("/tmp/proj/probe.mjs", `
      import { WorkerEntrypoint } from "cloudflare:workers";
      import { fileURLToPath } from "node:url";
      import { createRequire } from "node:module";
      export default class extends WorkerEntrypoint {
        async probe() {
          const out = { metaUrl: import.meta.url };
          try { out.fileURLToPath = fileURLToPath(import.meta.url); } catch (e) { out.fileURLToPathErr = String(e); }
          try { out.newUrlRelative = new URL("./sibling.js", import.meta.url).href; } catch (e) { out.newUrlErr = String(e); }
          try { out.createRequire = createRequire(import.meta.url)("./dep.cjs"); } catch (e) { out.createRequireErr = String(e); }
          return out;
        }
      }
    `);
    try {
      const result = await this.env.LOADER.get("probe-child", () => probeChild()).getEntrypoint().probe();
      return Response.json({ ok: true, result });
    } catch (e) {
      return Response.json({ ok: false, error: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 20) }, { status: 500 });
    }
  }
}
export default { async fetch(request, env) { return env.RUNNER.get(env.RUNNER.idFromName("s")).fetch(request); } };
