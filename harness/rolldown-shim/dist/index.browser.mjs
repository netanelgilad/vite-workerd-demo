import { d as logMultipleWatcherOption } from "./normalize-string-or-regex-A9UIvc9j.js";
import { a as validateOption, c as arraify, l as RUNTIME_MODULE_ID, n as createBundlerOptions, o as PluginDriver, r as RolldownMagicString, s as LOG_LEVEL_WARN, t as RolldownBuild, u as VERSION } from "./rolldown-build-XdM92thc.js";
import { t as aggregateBindingErrorsIntoJsError } from "./error-DAfzPCGW.js";
import { BindingWatcher, shutdownAsyncRuntime } from "./rolldown-binding.wasi-browser.js";
//#region src/api/rolldown/index.ts
/**
* The API compatible with Rollup's `rollup` function.
*
* Unlike Rollup, the module graph is not built until the methods of the bundle object are called.
*
* @param input The input options object.
* @returns A Promise that resolves to a bundle object.
*
* @example
* ```js
* import { rolldown } from 'rolldown';
*
* let bundle, failed = false;
* try {
*   bundle = await rolldown({
*     input: 'src/main.js',
*   });
*   await bundle.write({
*     format: 'esm',
*   });
* } catch (e) {
*   console.error(e);
*   failed = true;
* }
* if (bundle) {
*   await bundle.close();
* }
* process.exitCode = failed ? 1 : 0;
* ```
*
* @category Programmatic APIs
*/
const rolldown = async (input) => {
	validateOption("input", input);
	return new RolldownBuild(await PluginDriver.callOptionsHook(input));
};
//#endregion
//#region src/api/build.ts
/**
* The API similar to esbuild's `build` function.
*
* @example
* ```js
* import { build } from 'rolldown';
*
* const result = await build({
*   input: 'src/main.js',
*   output: {
*     file: 'bundle.js',
*   },
* });
* console.log(result);
* ```
*
* @experimental
* @category Programmatic APIs
*/
async function build(options) {
	if (Array.isArray(options)) return Promise.all(options.map((opts) => build(opts)));
	else {
		const { output, write = true, ...inputOptions } = options;
		const build = await rolldown(inputOptions);
		try {
			if (write) return await build.write(output);
			else return await build.generate(output);
		} finally {
			await build.close();
		}
	}
}
//#endregion
//#region src/api/watch/watch-emitter.ts
var WatcherEmitter = class {
	listeners = /* @__PURE__ */ new Map();
	on(event, listener) {
		const listeners = this.listeners.get(event);
		if (listeners) listeners.push(listener);
		else this.listeners.set(event, [listener]);
		return this;
	}
	off(event, listener) {
		const listeners = this.listeners.get(event);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index !== -1) listeners.splice(index, 1);
		}
		return this;
	}
	clear(event) {
		this.listeners.delete(event);
	}
	/** Async emit — sequential dispatch so side effects from earlier handlers
	*  (e.g. `event.result.close()` triggering `closeBundle`) are visible to later handlers. */
	async emit(event, ...args) {
		const handlers = this.listeners.get(event);
		if (handlers?.length) for (const h of handlers) await h(...args);
	}
	async close() {}
};
//#endregion
//#region src/api/watch/watcher.ts
function createEventCallback(emitter) {
	return async (event) => {
		switch (event.eventKind()) {
			case "event": {
				const code = event.bundleEventKind();
				if (code === "BUNDLE_END") {
					const { duration, output, result } = event.bundleEndData();
					await emitter.emit("event", {
						code: "BUNDLE_END",
						duration,
						output: [output],
						result
					});
				} else if (code === "ERROR") {
					const data = event.bundleErrorData();
					await emitter.emit("event", {
						code: "ERROR",
						error: aggregateBindingErrorsIntoJsError(data.error),
						result: data.result
					});
				} else await emitter.emit("event", { code });
				break;
			}
			case "change": {
				const { path, kind } = event.watchChangeData();
				await emitter.emit("change", path, { event: kind });
				break;
			}
			case "restart":
				await emitter.emit("restart");
				break;
			case "close":
				await emitter.emit("close");
				break;
		}
	};
}
var Watcher = class {
	closed;
	inner;
	emitter;
	stopWorkers;
	constructor(emitter, inner, stopWorkers) {
		this.closed = false;
		this.inner = inner;
		this.emitter = emitter;
		const originClose = emitter.close.bind(emitter);
		emitter.close = async () => {
			await this.close();
			originClose();
		};
		this.stopWorkers = stopWorkers;
		process.nextTick(() => this.run());
	}
	async close() {
		if (this.closed) return;
		this.closed = true;
		for (const stop of this.stopWorkers) await stop?.();
		await this.inner.close();
		shutdownAsyncRuntime();
	}
	async run() {
		await this.inner.run();
		this.inner.waitForClose();
	}
};
async function createWatcher(emitter, input) {
	const options = arraify(input);
	const bundlerOptions = await Promise.all(options.map((option) => arraify(option.output || {}).map(async (output) => {
		return createBundlerOptions(await PluginDriver.callOptionsHook(option, true), output, true);
	})).flat());
	warnMultiplePollingOptions(bundlerOptions);
	const callback = createEventCallback(emitter);
	new Watcher(emitter, new BindingWatcher(bundlerOptions.map((option) => option.bundlerOptions), callback), bundlerOptions.map((option) => option.stopWorkers));
}
function warnMultiplePollingOptions(bundlerOptions) {
	let found = false;
	for (const option of bundlerOptions) {
		const watch = option.inputOptions.watch;
		const watcher = watch && typeof watch === "object" ? watch.watcher ?? watch.notify : void 0;
		if (watcher && (watcher.usePolling != null || watcher.pollInterval != null)) {
			if (found) {
				option.onLog(LOG_LEVEL_WARN, logMultipleWatcherOption());
				return;
			}
			found = true;
		}
	}
}
//#endregion
//#region src/api/watch/index.ts
/**
* The API compatible with Rollup's `watch` function.
*
* This function will rebuild the bundle when it detects that the individual modules have changed on disk.
*
* Note that when using this function, it is your responsibility to call `event.result.close()` in response to the `BUNDLE_END` event to avoid resource leaks.
*
* @param input The watch options object or the list of them.
* @returns A watcher object.
*
* @example
* ```js
* import { watch } from 'rolldown';
*
* const watcher = watch({ /* ... *\/ });
* watcher.on('event', (event) => {
*   if (event.code === 'BUNDLE_END') {
*     console.log(event.duration);
*     event.result.close();
*   }
* });
*
* // Stop watching
* watcher.close();
* ```
*
* @experimental
* @category Programmatic APIs
*/
function watch(input) {
	const emitter = new WatcherEmitter();
	createWatcher(emitter, input);
	return emitter;
}
//#endregion
//#region src/utils/define-config.ts
function defineConfig(config) {
	return config;
}
//#endregion
export { RUNTIME_MODULE_ID, RolldownMagicString, VERSION, build, defineConfig, rolldown, watch };
