import { m as BindingReplacePluginConfig } from "./shared/binding-BhK3B-Zu.mjs";
import { t as BuiltinPlugin } from "./shared/utils-m0ogxd-4.mjs";
import { t as esmExternalRequirePlugin } from "./shared/constructors-CtnJN4Sg.mjs";

//#region src/builtin-plugin/replace-plugin.d.ts
/**
* Replaces targeted strings in files while bundling.
*
* @example
* **Basic usage**
* ```js
* replacePlugin({
*   'process.env.NODE_ENV': JSON.stringify('production'),
*    __buildVersion: 15
* })
* ```
* @example
* **With options**
* ```js
* replacePlugin({
*   'process.env.NODE_ENV': JSON.stringify('production'),
*   __buildVersion: 15
* }, {
*   preventAssignment: false,
* })
* ```
*
* @see https://rolldown.rs/builtin-plugins/replace
* @category Builtin Plugins
*/
declare function replacePlugin(values?: BindingReplacePluginConfig["values"], options?: Omit<BindingReplacePluginConfig, "values">): BuiltinPlugin;
//#endregion
export { esmExternalRequirePlugin, replacePlugin };