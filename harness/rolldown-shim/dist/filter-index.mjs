import { a as id, c as interpreter, d as not, f as or, g as isPromiseLike, h as arraify, i as exprInterpreter, l as interpreterImpl, m as query, n as code, o as importerId, p as queries, r as exclude, s as include, t as and, u as moduleType } from "./shared/composable-filters-BcLvc0mh.mjs";
//#region ../../node_modules/.pnpm/@rolldown+pluginutils@1.0.0/node_modules/@rolldown/pluginutils/dist/filter/filter-vite-plugins.js
/**
* Filters out Vite plugins that have `apply: 'serve'` set.
*
* Since Rolldown operates in build mode, plugins marked with `apply: 'serve'`
* are intended only for Vite's dev server and should be excluded from the build process.
*
* @param plugins - Array of plugins (can include nested arrays)
* @returns Filtered array with serve-only plugins removed
*
* @example
* ```ts
* import { defineConfig } from 'rolldown';
* import { filterVitePlugins } from '@rolldown/pluginutils';
* import viteReact from '@vitejs/plugin-react';
*
* export default defineConfig({
*   plugins: filterVitePlugins([
*     viteReact(),
*     {
*       name: 'dev-only',
*       apply: 'serve', // This will be filtered out
*       // ...
*     }
*   ])
* });
* ```
*/
function filterVitePlugins(plugins) {
	if (!plugins) return [];
	const pluginArray = Array.isArray(plugins) ? plugins : [plugins];
	const result = [];
	for (const plugin of pluginArray) {
		if (!plugin) continue;
		if (Array.isArray(plugin)) {
			result.push(...filterVitePlugins(plugin));
			continue;
		}
		const pluginWithApply = plugin;
		if ("apply" in pluginWithApply) {
			const applyValue = pluginWithApply.apply;
			if (typeof applyValue === "function") try {
				if (applyValue({}, {
					command: "build",
					mode: "production"
				})) result.push(plugin);
			} catch {
				result.push(plugin);
			}
			else if (applyValue === "serve") continue;
			else result.push(plugin);
		} else result.push(plugin);
	}
	return result;
}
//#endregion
//#region ../../node_modules/.pnpm/@rolldown+pluginutils@1.0.0/node_modules/@rolldown/pluginutils/dist/filter/simple-filters.js
/**
* Constructs a RegExp that matches the exact string specified.
*
* This is useful for plugin hook filters.
*
* @param str the string to match.
* @param flags flags for the RegExp.
*
* @example
* ```ts
* import { exactRegex } from '@rolldown/pluginutils';
* const plugin = {
*   name: 'plugin',
*   resolveId: {
*     filter: { id: exactRegex('foo') },
*     handler(id) {} // will only be called for `foo`
*   }
* }
* ```
*/
function exactRegex(str, flags) {
	return new RegExp(`^${escapeRegex(str)}$`, flags);
}
/**
* Constructs a RegExp that matches a value that has the specified prefix.
*
* This is useful for plugin hook filters.
*
* @param str the string to match.
* @param flags flags for the RegExp.
*
* @example
* ```ts
* import { prefixRegex } from '@rolldown/pluginutils';
* const plugin = {
*   name: 'plugin',
*   resolveId: {
*     filter: { id: prefixRegex('foo') },
*     handler(id) {} // will only be called for IDs starting with `foo`
*   }
* }
* ```
*/
function prefixRegex(str, flags) {
	return new RegExp(`^${escapeRegex(str)}`, flags);
}
const escapeRegexRE = /[-/\\^$*+?.()|[\]{}]/g;
function escapeRegex(str) {
	return str.replace(escapeRegexRE, "\\$&");
}
function makeIdFiltersToMatchWithQuery(input) {
	if (!Array.isArray(input)) return makeIdFilterToMatchWithQuery(input);
	return input.map((i) => makeIdFilterToMatchWithQuery(i));
}
function makeIdFilterToMatchWithQuery(input) {
	if (typeof input === "string") return `${input}{?*,}`;
	return makeRegexIdFilterToMatchWithQuery(input);
}
function makeRegexIdFilterToMatchWithQuery(input) {
	return new RegExp(input.source.replace(/(?<!\\)\$/g, "(?:\\?.*)?$"), input.flags);
}
//#endregion
//#region src/plugin/with-filter.ts
function withFilterImpl(pluginOption, filterObjectList) {
	if (isPromiseLike(pluginOption)) return pluginOption.then((p) => withFilter(p, filterObjectList));
	if (pluginOption == false || pluginOption == null) return pluginOption;
	if (Array.isArray(pluginOption)) return pluginOption.map((p) => withFilter(p, filterObjectList));
	let plugin = pluginOption;
	let filterObjectIndex = findMatchedFilterObject(plugin.name, filterObjectList);
	if (filterObjectIndex === -1) return plugin;
	let filterObject = filterObjectList[filterObjectIndex];
	Object.keys(plugin).forEach((key) => {
		switch (key) {
			case "transform":
			case "resolveId":
			case "load":
				if (!plugin[key]) return;
				if (typeof plugin[key] === "object") plugin[key].filter = filterObject[key] ?? plugin[key].filter;
				else plugin[key] = {
					handler: plugin[key],
					filter: filterObject[key]
				};
				break;
			default: break;
		}
	});
	return plugin;
}
/**
* A helper function to add plugin hook filters to a plugin or an array of plugins.
*
* @example
* ```ts
* import yaml from '@rollup/plugin-yaml';
* import { defineConfig } from 'rolldown';
* import { withFilter } from 'rolldown/filter';
*
* export default defineConfig({
*   plugins: [
*     // Run the transform hook of the `yaml` plugin
*     // only for modules which end in `.yaml`
*     withFilter(
*       yaml({}),
*       { transform: { id: /\.yaml$/ } },
*     ),
*   ],
* });
* ```
*
* @category Config
*/
function withFilter(pluginOption, filterObject) {
	return withFilterImpl(pluginOption, arraify(filterObject));
}
function findMatchedFilterObject(pluginName, overrideFilterObjectList) {
	if (overrideFilterObjectList.length === 1 && overrideFilterObjectList[0].pluginNamePattern === void 0) return 0;
	for (let i = 0; i < overrideFilterObjectList.length; i++) for (let j = 0; j < (overrideFilterObjectList[i].pluginNamePattern ?? []).length; j++) {
		let pattern = overrideFilterObjectList[i].pluginNamePattern[j];
		if (typeof pattern === "string" && pattern === pluginName) return i;
		else if (pattern instanceof RegExp && pattern.test(pluginName)) return i;
	}
	return -1;
}
//#endregion
export { and, code, exactRegex, exclude, exprInterpreter, filterVitePlugins, id, importerId, include, interpreter, interpreterImpl, makeIdFiltersToMatchWithQuery, moduleType, not, or, prefixRegex, queries, query, withFilter };
