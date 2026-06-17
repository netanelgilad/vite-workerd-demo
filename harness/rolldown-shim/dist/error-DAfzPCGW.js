import { parse, parseSync } from "./rolldown-binding.wasi-browser.js";
//#region src/types/sourcemap.ts
function bindingifySourcemap(map) {
	if (map == null) return;
	return { inner: typeof map === "string" ? map : {
		file: map.file ?? void 0,
		mappings: map.mappings,
		sourceRoot: "sourceRoot" in map ? map.sourceRoot ?? void 0 : void 0,
		sources: map.sources?.map((s) => s ?? void 0),
		sourcesContent: map.sourcesContent?.map((s) => s ?? void 0),
		names: map.names,
		x_google_ignoreList: map.x_google_ignoreList,
		debugId: "debugId" in map ? map.debugId : void 0
	} };
}
//#endregion
//#region ../../node_modules/.pnpm/oxc-parser@0.133.0/node_modules/oxc-parser/src-js/wrap.js
function wrap(result) {
	let program, module, comments, errors;
	return {
		get program() {
			if (!program) program = jsonParseAst(result.program);
			return program;
		},
		get module() {
			if (!module) module = result.module;
			return module;
		},
		get comments() {
			if (!comments) comments = result.comments;
			return comments;
		},
		get errors() {
			if (!errors) errors = result.errors;
			return errors;
		}
	};
}
function jsonParseAst(programJson) {
	const { node: program, fixes } = JSON.parse(programJson);
	for (const fixPath of fixes) applyFix(program, fixPath);
	return program;
}
function applyFix(program, fixPath) {
	let node = program;
	for (const key of fixPath) node = node[key];
	if (node.bigint) node.value = BigInt(node.bigint);
	else try {
		node.value = RegExp(node.regex.pattern, node.regex.flags);
	} catch {}
}
//#endregion
//#region src/utils/parse.ts
/**
* Parse JS/TS source asynchronously on a separate thread.
*
* Note that not all of the workload can happen on a separate thread.
* Parsing on Rust side does happen in a separate thread, but deserialization of the AST to JS objects
* has to happen on current thread. This synchronous deserialization work typically outweighs
* the asynchronous parsing by a factor of between 3 and 20.
*
* i.e. the majority of the workload cannot be parallelized by using this method.
*
* Generally {@linkcode parseSync} is preferable to use as it does not have the overhead of spawning a thread.
* If you need to parallelize parsing multiple files, it is recommended to use worker threads.
*
* @category Utilities
*/
async function parse$1(filename, sourceText, options) {
	return wrap(await parse(filename, sourceText, options));
}
/**
* Parse JS/TS source synchronously on current thread.
*
* This is generally preferable over {@linkcode parse} (async) as it does not have the overhead
* of spawning a thread, and the majority of the workload cannot be parallelized anyway
* (see {@linkcode parse} documentation for details).
*
* If you need to parallelize parsing multiple files, it is recommended to use worker threads
* with {@linkcode parseSync} rather than using {@linkcode parse}.
*
* @category Utilities
*/
function parseSync$1(filename, sourceText, options) {
	return wrap(parseSync(filename, sourceText, options));
}
//#endregion
//#region src/utils/error.ts
function unwrapBindingResult(container) {
	if (typeof container === "object" && container !== null && "isBindingErrors" in container && container.isBindingErrors) throw aggregateBindingErrorsIntoJsError(container.errors);
	return container;
}
function normalizeBindingResult(container) {
	if (typeof container === "object" && container !== null && "isBindingErrors" in container && container.isBindingErrors) return aggregateBindingErrorsIntoJsError(container.errors);
	return container;
}
function normalizeBindingError(e) {
	return e.type === "JsError" ? e.field0 : Object.assign(/* @__PURE__ */ new Error(), {
		code: e.field0.kind,
		kind: e.field0.kind,
		message: e.field0.message,
		id: e.field0.id,
		exporter: e.field0.exporter,
		loc: e.field0.loc,
		pos: e.field0.pos,
		stack: void 0
	});
}
function aggregateBindingErrorsIntoJsError(rawErrors) {
	const errors = rawErrors.map(normalizeBindingError);
	let summary = `Build failed with ${errors.length} error${errors.length < 2 ? "" : "s"}:\n`;
	for (let i = 0; i < errors.length; i++) {
		summary += "\n";
		if (i >= 5) {
			summary += "...";
			break;
		}
		summary += getErrorMessage(errors[i]);
	}
	const wrapper = new Error(summary);
	Object.defineProperty(wrapper, "errors", {
		configurable: true,
		enumerable: true,
		get: () => errors,
		set: (value) => Object.defineProperty(wrapper, "errors", {
			configurable: true,
			enumerable: true,
			value
		})
	});
	return wrapper;
}
function getErrorMessage(e) {
	if (Object.hasOwn(e, "kind")) return e.message;
	let s = "";
	if (e.plugin) s += `[plugin ${e.plugin}]`;
	const id = e.id ?? e.loc?.file;
	if (id) {
		s += " " + id;
		if (e.loc) s += `:${e.loc.line}:${e.loc.column}`;
	}
	if (s) s += "\n";
	const message = `${e.name ?? "Error"}: ${e.message}`;
	s += message;
	if (e.frame) s = joinNewLine(s, e.frame);
	if (e.stack) s = joinNewLine(s, e.stack.replace(message, ""));
	if (e.cause) {
		s = joinNewLine(s, "Caused by:");
		s = joinNewLine(s, getErrorMessage(e.cause).split("\n").map((line) => "  " + line).join("\n"));
	}
	return s;
}
function joinNewLine(s1, s2) {
	return s1.replace(/\n+$/, "") + "\n" + s2.replace(/^\n+/, "");
}
//#endregion
export { parse$1 as a, unwrapBindingResult as i, normalizeBindingError as n, parseSync$1 as o, normalizeBindingResult as r, bindingifySourcemap as s, aggregateBindingErrorsIntoJsError as t };
