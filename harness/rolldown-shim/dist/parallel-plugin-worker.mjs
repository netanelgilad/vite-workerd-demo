import { n as PluginContextData, r as bindingifyPlugin } from "./shared/bindingify-input-options-BKrzu-Ci.mjs";
import { parentPort, workerData } from "node:worker_threads";
import { registerPlugins } from "./rolldown-binding.wasi.cjs";
//#region src/parallel-plugin-worker.ts
const { registryId, pluginInfos, threadNumber } = workerData;
(async () => {
	try {
		registerPlugins(registryId, await Promise.all(pluginInfos.map(async (pluginInfo) => {
			const definePluginImpl = (await import(pluginInfo.fileUrl)).default;
			const plugin = await definePluginImpl(pluginInfo.options, { threadNumber });
			return {
				index: pluginInfo.index,
				plugin: bindingifyPlugin(plugin, {}, {}, new PluginContextData(() => {}, {}, [], []), [], () => {}, "info", false)
			};
		})));
		parentPort.postMessage({ type: "success" });
	} catch (error) {
		parentPort.postMessage({
			type: "error",
			error
		});
	} finally {
		parentPort.unref();
	}
})();
//#endregion
export {};
