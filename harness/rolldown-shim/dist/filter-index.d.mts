import { B as exclude, F as FilterExpressionKind, G as interpreter, H as id, I as QueryFilterObject, J as not, K as interpreterImpl, L as TopLevelFilterExpression, N as withFilter, P as FilterExpression, R as and, U as importerId, V as exprInterpreter, W as include, X as queries, Y as or, Z as query, q as moduleType, z as code } from "./shared/define-config-D4nAGxn1.mjs";

//#region ../../node_modules/.pnpm/@rolldown+pluginutils@1.0.0/node_modules/@rolldown/pluginutils/dist/filter/filter-vite-plugins.d.ts
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
declare function filterVitePlugins<T = any>(plugins: T | T[] | null | undefined | false): T[];
//#endregion
//#region ../../node_modules/.pnpm/@rolldown+pluginutils@1.0.0/node_modules/@rolldown/pluginutils/dist/filter/simple-filters.d.ts
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
declare function exactRegex(str: string, flags?: string): RegExp;
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
declare function prefixRegex(str: string, flags?: string): RegExp;
type WidenString<T> = T extends string ? string : T;
/**
 * Converts a id filter to match with an id with a query.
 *
 * @param input the id filters to convert.
 *
 * @example
 * ```ts
 * import { makeIdFiltersToMatchWithQuery } from '@rolldown/pluginutils';
 * const plugin = {
 *   name: 'plugin',
 *   transform: {
 *     filter: { id: makeIdFiltersToMatchWithQuery(['**' + '/*.js', /\.ts$/]) },
 *     // The handler will be called for IDs like:
 *     // - foo.js
 *     // - foo.js?foo
 *     // - foo.txt?foo.js
 *     // - foo.ts
 *     // - foo.ts?foo
 *     // - foo.txt?foo.ts
 *     handler(code, id) {}
 *   }
 * }
 * ```
 */
declare function makeIdFiltersToMatchWithQuery<T extends string | RegExp>(input: T): WidenString<T>;
declare function makeIdFiltersToMatchWithQuery<T extends string | RegExp>(input: readonly T[]): WidenString<T>[];
declare function makeIdFiltersToMatchWithQuery(input: string | RegExp | readonly (string | RegExp)[]): string | RegExp | (string | RegExp)[];
//#endregion
export { FilterExpression, FilterExpressionKind, QueryFilterObject, TopLevelFilterExpression, and, code, exactRegex, exclude, exprInterpreter, filterVitePlugins, id, importerId, include, interpreter, interpreterImpl, makeIdFiltersToMatchWithQuery, moduleType, not, or, prefixRegex, queries, query, withFilter };