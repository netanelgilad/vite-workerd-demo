import { a as bindingifySourcemap, n as normalizeBindingError } from "./error-B5cMIevi.mjs";
import { TsconfigCache, collapseSourcemaps, enhancedTransform, enhancedTransformSync, minify, minifySync, resolveTsconfig } from "../rolldown-binding.wasi.cjs";
//#region src/utils/minify.ts
/**
* Minify asynchronously.
*
* Note: This function can be slower than {@linkcode minifySync} due to the overhead of spawning a thread.
*
* @category Utilities
* @experimental
*/
async function minify$1(filename, sourceText, options) {
	const inputMap = bindingifySourcemap(options?.inputMap);
	const result = await minify(filename, sourceText, options);
	if (result.map && inputMap) result.map = {
		version: 3,
		...collapseSourcemaps([inputMap, bindingifySourcemap(result.map)])
	};
	return result;
}
/**
* Minify synchronously.
*
* @category Utilities
* @experimental
*/
function minifySync$1(filename, sourceText, options) {
	const inputMap = bindingifySourcemap(options?.inputMap);
	const result = minifySync(filename, sourceText, options);
	if (result.map && inputMap) result.map = {
		version: 3,
		...collapseSourcemaps([inputMap, bindingifySourcemap(result.map)])
	};
	return result;
}
//#endregion
//#region src/utils/transform.ts
const yarnPnp$1 = typeof process === "object" && !!process.versions?.pnp;
function normalizeBindingWarning(warning) {
	if (warning.type === "JsError") return warning.field0;
	return {
		code: warning.field0.kind,
		message: warning.field0.message,
		id: warning.field0.id,
		exporter: warning.field0.exporter,
		loc: warning.field0.loc,
		pos: warning.field0.pos
	};
}
/**
* Transpile a JavaScript or TypeScript into a target ECMAScript version, asynchronously.
*
* Note: This function can be slower than `transformSync` due to the overhead of spawning a thread.
*
* @param filename The name of the file being transformed. If this is a
* relative path, consider setting the {@linkcode TransformOptions#cwd} option.
* @param sourceText The source code to transform.
* @param options The transform options including tsconfig and inputMap. See {@linkcode TransformOptions} for more information.
* @param cache Optional tsconfig cache for reusing resolved tsconfig across multiple transforms.
* Only used when `options.tsconfig` is `true`.
*
* @returns a promise that resolves to an object containing the transformed code,
* source maps, and any errors that occurred during parsing or transformation.
*
* @category Utilities
* @experimental
*/
async function transform(filename, sourceText, options, cache) {
	const result = await enhancedTransform(filename, sourceText, options, cache, yarnPnp$1);
	return {
		...result,
		errors: result.errors.map(normalizeBindingError),
		warnings: result.warnings.map(normalizeBindingWarning)
	};
}
/**
* Transpile a JavaScript or TypeScript into a target ECMAScript version.
*
* @param filename The name of the file being transformed. If this is a
* relative path, consider setting the {@linkcode TransformOptions#cwd} option.
* @param sourceText The source code to transform.
* @param options The transform options including tsconfig and inputMap. See {@linkcode TransformOptions} for more information.
* @param cache Optional tsconfig cache for reusing resolved tsconfig across multiple transforms.
* Only used when `options.tsconfig` is `true`.
*
* @returns an object containing the transformed code, source maps, and any errors
* that occurred during parsing or transformation.
*
* @category Utilities
* @experimental
*/
function transformSync(filename, sourceText, options, cache) {
	const result = enhancedTransformSync(filename, sourceText, options, cache, yarnPnp$1);
	return {
		...result,
		errors: result.errors.map(normalizeBindingError),
		warnings: result.warnings.map(normalizeBindingWarning)
	};
}
//#endregion
//#region src/utils/resolve-tsconfig.ts
const yarnPnp = typeof process === "object" && !!process.versions?.pnp;
/**
* Cache for tsconfig resolution to avoid redundant file system operations.
*
* The cache stores resolved tsconfig configurations keyed by their file paths.
* When transforming multiple files in the same project, tsconfig lookups are
* deduplicated, improving performance.
*
* @category Utilities
* @experimental
*/
var TsconfigCache$1 = class extends TsconfigCache {
	constructor() {
		super(yarnPnp);
	}
};
/** @hidden This is only expected to be used by Vite */
function resolveTsconfig$1(filename, cache) {
	return resolveTsconfig(filename, cache, yarnPnp);
}
//#endregion
export { minify$1 as a, transformSync as i, resolveTsconfig$1 as n, minifySync$1 as o, transform as r, TsconfigCache$1 as t };
