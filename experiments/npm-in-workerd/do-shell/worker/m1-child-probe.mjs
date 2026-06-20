// MILESTONE 1 worker (parent DO + child probe).
//
// The parent is a Durable Object that owns the shared native /tmp. On /probe it:
//   1. writes a marker file to /tmp via native node:fs
//   2. spawns a CHILD isolate via the Worker Loader with shareParentTmp:true
//   3. asks the child to (a) read the parent's marker over native fs and
//      (b) try to import a module that is NOT in the child's inline `modules`
//      map -> this tests whether the child can use the parent's module
//      FALLBACK SERVICE (the critical unknown).
import * as nodeFs from "node:fs";

const MARKER = "/tmp/m1-marker.txt";

function installGlobals(env) {
  globalThis.__UNSAFE_EVAL = env.UNSAFE_EVAL;
}

// The child worker's source. It is provided INLINE in the WorkerCode.modules
// map (so the entry itself never needs the fallback). Inside it:
//   - reads the parent's marker file via native node:fs  (proves shared /tmp)
//   - attempts a dynamic import of a bare specifier ("left-pad") that is NOT in
//     its modules map -> only resolvable if the child inherits the parent's
//     module fallback service.
const CHILD_SRC = `
import * as childFs from "node:fs";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const out = { where: "child" };
    // (a) shared /tmp read
    try {
      out.markerRead = childFs.readFileSync("/tmp/m1-marker.txt", "utf8");
      out.sharedTmpWorks = true;
    } catch (e) {
      out.sharedTmpWorks = false;
      out.markerError = String(e);
    }
    // child also WRITES a file, so the parent can confirm bidirectional sharing
    try {
      childFs.writeFileSync("/tmp/m1-from-child.txt", "hello-from-child");
      out.childWroteFile = true;
    } catch (e) { out.childWriteError = String(e); }
    // (b) module fallback test: import a bare module not in our modules map
    if (url.searchParams.get("fallback") === "1") {
      try {
        const m = await import("left-pad");
        const fn = m.default ?? m;
        out.fallbackImport = "OK";
        out.fallbackResult = fn("7", 5, "0");
      } catch (e) {
        out.fallbackImport = "FAILED";
        out.fallbackError = String(e);
      }
    }
    return Response.json(out);
  }
};
`;

export class Parent {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    installGlobals(this.env);
    const fs = nodeFs;
    const url = new URL(request.url);

    if (url.pathname === "/probe") {
      // 1. parent writes marker via native fs
      fs.writeFileSync(MARKER, "hello-from-parent-" + Date.now());
      const parentReadBack = fs.readFileSync(MARKER, "utf8");

      // 2. spawn child via Worker Loader
      const wantFallback = url.searchParams.get("fallback") === "1";
      const childId = "m1-child";
      const stub = this.env.LOADER.get(childId, () => ({
        compatibilityDate: "2026-06-01",
        compatibilityFlags: ["nodejs_compat", "enable_nodejs_fs_module"],
        allowExperimental: true,
        shareParentTmp: true,
        mainModule: "child.js",
        modules: {
          "child.js": CHILD_SRC,
        },
      }));

      // 3. invoke child entrypoint
      const childUrl = "http://child.local/run" + (wantFallback ? "?fallback=1" : "");
      let childResult;
      try {
        const ent = stub.getEntrypoint();
        const res = await ent.fetch(new Request(childUrl));
        childResult = await res.json();
      } catch (e) {
        childResult = { childInvokeError: String(e), stack: (e?.stack ?? "").split("\n").slice(0, 20) };
      }

      // 4. parent verifies child's write is visible
      let childFileSeenByParent = null;
      try { childFileSeenByParent = fs.readFileSync("/tmp/m1-from-child.txt", "utf8"); } catch (e) { childFileSeenByParent = "NOT-VISIBLE: " + e; }

      return Response.json({
        ok: true,
        parentWroteMarker: parentReadBack,
        child: childResult,
        childFileSeenByParent,
      });
    }

    return new Response("ops: /probe?fallback=1", { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    const id = env.PARENT.idFromName("singleton");
    return env.PARENT.get(id).fetch(request);
  },
};
