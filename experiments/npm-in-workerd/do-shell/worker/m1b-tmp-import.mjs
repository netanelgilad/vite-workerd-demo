// MILESTONE 1b: can a Worker-Loader CHILD import() a module from a file path in
// the SHARED /tmp (i.e. resolve code that npm wrote to /tmp via native fs),
// WITHOUT a module fallback service? If yes, a child could run installed code.
import * as nodeFs from "node:fs";

function installGlobals(env) { globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL; }

const CHILD_SRC = `
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const spec = url.searchParams.get("spec");
    const out = { where: "child", spec };
    try {
      const m = await import(spec);
      out.importedKeys = Object.keys(m);
      out.value = (m.default ?? m.run ?? (()=> "no-fn"))();
      out.importOK = true;
    } catch (e) {
      out.importOK = false;
      out.importError = String(e);
    }
    return Response.json(out);
  }
};
`;

export class Parent {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    installGlobals(this.env);
    const fs = nodeFs;
    const url = new URL(request.url);
    if (url.pathname === "/probe") {
      // parent writes a tiny ESM module into the shared /tmp
      fs.mkdirSync("/tmp/mod", { recursive: true });
      fs.writeFileSync("/tmp/mod/hello.mjs", "export default () => 'computed-in-shared-tmp-module';\n");
      // also a CJS file
      fs.writeFileSync("/tmp/mod/hello.cjs", "module.exports = () => 'cjs-in-shared-tmp';\n");

      const spec = url.searchParams.get("spec") || "/tmp/mod/hello.mjs";
      const stub = this.env.LOADER.get("m1b-child", () => ({
        compatibilityDate: "2026-06-01",
        compatibilityFlags: ["nodejs_compat", "enable_nodejs_fs_module"],
        allowExperimental: true,
        shareParentTmp: true,
        mainModule: "child.js",
        modules: { "child.js": CHILD_SRC },
      }));
      let childResult;
      try {
        const res = await stub.getEntrypoint().fetch(new Request("http://child.local/run?spec=" + encodeURIComponent(spec)));
        childResult = await res.json();
      } catch (e) { childResult = { childInvokeError: String(e) }; }
      return Response.json({ ok: true, spec, child: childResult });
    }
    return new Response("ops: /probe?spec=", { status: 404 });
  }
}
export default {
  async fetch(request, env) { return env.PARENT.get(env.PARENT.idFromName("singleton")).fetch(request); },
};
