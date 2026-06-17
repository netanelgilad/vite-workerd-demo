import { c as logCycleLoading, f as logNoFileSystemInBrowser, g as getCodeFrame, h as locate, i as bindingifyManifestPlugin, l as logInputHookInOutputPlugin, m as logPluginError, n as BuiltinPlugin, o as augmentCodeLocation, p as logParseError, r as bindingifyBuiltInPlugin, s as error, t as normalizedStringOrRegex, u as logInvalidLogPosition } from "./normalize-string-or-regex-A9UIvc9j.js";
import { i as unwrapBindingResult, o as parseSync$1, s as bindingifySourcemap$1, t as aggregateBindingErrorsIntoJsError } from "./error-DAfzPCGW.js";
import { BindingAttachDebugInfo, BindingBundler, BindingChunkModuleOrderBy, BindingLogLevel, BindingMagicString, BindingPluginOrder, BindingPropertyReadSideEffects, BindingPropertyWriteSideEffects, shutdownAsyncRuntime, startAsyncRuntime } from "./rolldown-binding.wasi-browser.js";
//#region ../../node_modules/.pnpm/pathe@2.0.3/node_modules/pathe/dist/shared/pathe.M-eThtNZ.mjs
let _lazyMatch = () => {
	var __lib__ = (() => {
		var m = Object.defineProperty, V = Object.getOwnPropertyDescriptor, G = Object.getOwnPropertyNames, T = Object.prototype.hasOwnProperty, q = (r, e) => {
			for (var n in e) m(r, n, {
				get: e[n],
				enumerable: true
			});
		}, H = (r, e, n, a) => {
			if (e && typeof e == "object" || typeof e == "function") for (let t of G(e)) !T.call(r, t) && t !== n && m(r, t, {
				get: () => e[t],
				enumerable: !(a = V(e, t)) || a.enumerable
			});
			return r;
		}, J = (r) => H(m({}, "__esModule", { value: true }), r), w = {};
		q(w, { default: () => re });
		var A = (r) => Array.isArray(r), d = (r) => typeof r == "function", Q = (r) => r.length === 0, W = (r) => typeof r == "number", K = (r) => typeof r == "object" && r !== null, X = (r) => r instanceof RegExp, b = (r) => typeof r == "string", h = (r) => r === void 0, Y = (r) => {
			const e = /* @__PURE__ */ new Map();
			return (n) => {
				const a = e.get(n);
				if (a) return a;
				const t = r(n);
				return e.set(n, t), t;
			};
		}, rr = (r, e, n = {}) => {
			const a = {
				cache: {},
				input: r,
				index: 0,
				indexMax: 0,
				options: n,
				output: []
			};
			if (v(e)(a) && a.index === r.length) return a.output;
			throw new Error(`Failed to parse at index ${a.indexMax}`);
		}, i = (r, e) => A(r) ? er(r, e) : b(r) ? ar(r, e) : nr(r, e), er = (r, e) => {
			const n = {};
			for (const a of r) {
				if (a.length !== 1) throw new Error(`Invalid character: "${a}"`);
				const t = a.charCodeAt(0);
				n[t] = true;
			}
			return (a) => {
				const t = a.index, o = a.input;
				for (; a.index < o.length && o.charCodeAt(a.index) in n;) a.index += 1;
				const u = a.index;
				if (u > t) {
					if (!h(e) && !a.options.silent) {
						const s = a.input.slice(t, u), c = d(e) ? e(s, o, String(t)) : e;
						h(c) || a.output.push(c);
					}
					a.indexMax = Math.max(a.indexMax, a.index);
				}
				return true;
			};
		}, nr = (r, e) => {
			const n = r.source, a = r.flags.replace(/y|$/, "y"), t = new RegExp(n, a);
			return g((o) => {
				t.lastIndex = o.index;
				const u = t.exec(o.input);
				if (u) {
					if (!h(e) && !o.options.silent) {
						const s = d(e) ? e(...u, o.input, String(o.index)) : e;
						h(s) || o.output.push(s);
					}
					return o.index += u[0].length, o.indexMax = Math.max(o.indexMax, o.index), true;
				} else return false;
			});
		}, ar = (r, e) => (n) => {
			if (n.input.startsWith(r, n.index)) {
				if (!h(e) && !n.options.silent) {
					const t = d(e) ? e(r, n.input, String(n.index)) : e;
					h(t) || n.output.push(t);
				}
				return n.index += r.length, n.indexMax = Math.max(n.indexMax, n.index), true;
			} else return false;
		}, C = (r, e, n, a) => {
			const t = v(r);
			return g(_(M((o) => {
				let u = 0;
				for (; u < n;) {
					const s = o.index;
					if (!t(o) || (u += 1, o.index === s)) break;
				}
				return u >= e;
			})));
		}, tr = (r, e) => C(r, 0, 1), f = (r, e) => C(r, 0, Infinity), x = (r, e) => {
			const n = r.map(v);
			return g(_(M((a) => {
				for (let t = 0, o = n.length; t < o; t++) if (!n[t](a)) return false;
				return true;
			})));
		}, l = (r, e) => {
			const n = r.map(v);
			return g(_((a) => {
				for (let t = 0, o = n.length; t < o; t++) if (n[t](a)) return true;
				return false;
			}));
		}, M = (r, e = false) => {
			const n = v(r);
			return (a) => {
				const t = a.index, o = a.output.length, u = n(a);
				return (!u || e) && (a.index = t, a.output.length !== o && (a.output.length = o)), u;
			};
		}, _ = (r, e) => {
			return v(r);
		}, g = (() => {
			let r = 0;
			return (e) => {
				const n = v(e), a = r += 1;
				return (t) => {
					var o;
					if (t.options.memoization === false) return n(t);
					const u = t.index, s = (o = t.cache)[a] || (o[a] = /* @__PURE__ */ new Map()), c = s.get(u);
					if (c === false) return false;
					if (W(c)) return t.index = c, true;
					if (c) return t.index = c.index, c.output?.length && t.output.push(...c.output), true;
					{
						const Z = t.output.length;
						if (n(t)) {
							const D = t.index, U = t.output.length;
							if (U > Z) {
								const ee = t.output.slice(Z, U);
								s.set(u, {
									index: D,
									output: ee
								});
							} else s.set(u, D);
							return true;
						} else return s.set(u, false), false;
					}
				};
			};
		})(), E = (r) => {
			let e;
			return (n) => (e || (e = v(r())), e(n));
		}, v = Y((r) => {
			if (d(r)) return Q(r) ? E(r) : r;
			if (b(r) || X(r)) return i(r);
			if (A(r)) return x(r);
			if (K(r)) return l(Object.values(r));
			throw new Error("Invalid rule");
		}), P = "abcdefghijklmnopqrstuvwxyz", ir = (r) => {
			let e = "";
			for (; r > 0;) e = P[(r - 1) % 26] + e, r = Math.floor((r - 1) / 26);
			return e;
		}, O = (r) => {
			let e = 0;
			for (let n = 0, a = r.length; n < a; n++) e = e * 26 + P.indexOf(r[n]) + 1;
			return e;
		}, S = (r, e) => {
			if (e < r) return S(e, r);
			const n = [];
			for (; r <= e;) n.push(r++);
			return n;
		}, or = (r, e, n) => S(r, e).map((a) => String(a).padStart(n, "0")), R = (r, e) => S(O(r), O(e)).map(ir), p = (r) => r, z = (r) => ur((e) => rr(e, r, { memoization: false }).join("")), ur = (r) => {
			const e = {};
			return (n) => e[n] ?? (e[n] = r(n));
		}, sr = i(/^\*\*\/\*$/, ".*"), cr = i(/^\*\*\/(\*)?([ a-zA-Z0-9._-]+)$/, (r, e, n) => `.*${e ? "" : "(?:^|/)"}${n.replaceAll(".", "\\.")}`), lr = i(/^\*\*\/(\*)?([ a-zA-Z0-9._-]*)\{([ a-zA-Z0-9._-]+(?:,[ a-zA-Z0-9._-]+)*)\}$/, (r, e, n, a) => `.*${e ? "" : "(?:^|/)"}${n.replaceAll(".", "\\.")}(?:${a.replaceAll(",", "|").replaceAll(".", "\\.")})`), y = i(/\\./, p), pr = i(/[$.*+?^(){}[\]\|]/, (r) => `\\${r}`), vr = i(/./, p), fr = l([i(/^(?:!!)*!(.*)$/, (r, e) => `(?!^${L(e)}$).*?`), i(/^(!!)+/, "")]), j = l([
			i(/\/(\*\*\/)+/, "(?:/.+/|/)"),
			i(/^(\*\*\/)+/, "(?:^|.*/)"),
			i(/\/(\*\*)$/, "(?:/.*|$)"),
			i(/\*\*/, ".*")
		]), N = l([i(/\*\/(?!\*\*\/)/, "[^/]*/"), i(/\*/, "[^/]*")]), k = i("?", "[^/]"), $r = i("[", p), wr = i("]", p), Ar = i(/[!^]/, "^/"), br = i(/[a-z]-[a-z]|[0-9]-[0-9]/i, p), Er = l([
			y,
			i(/[$.*+?^(){}[\|]/, (r) => `\\${r}`),
			br,
			i(/[^\]]/, p)
		]), B = x([
			$r,
			tr(Ar),
			f(Er),
			wr
		]), Pr = i("{", "(?:"), Or = i("}", ")"), I = x([
			Pr,
			l([
				i(/(\d+)\.\.(\d+)/, (r, e, n) => or(+e, +n, Math.min(e.length, n.length)).join("|")),
				i(/([a-z]+)\.\.([a-z]+)/, (r, e, n) => R(e, n).join("|")),
				i(/([A-Z]+)\.\.([A-Z]+)/, (r, e, n) => R(e.toLowerCase(), n.toLowerCase()).join("|").toUpperCase())
			]),
			Or
		]), kr = i("{", "(?:"), Br = i("}", ")"), Ir = i(",", "|"), Fr = i(/[$.*+?^(){[\]\|]/, (r) => `\\${r}`), Lr = i(/[^}]/, p), F = x([
			kr,
			f(l([
				j,
				N,
				k,
				B,
				I,
				E(() => F),
				y,
				Fr,
				Ir,
				Lr
			])),
			Br
		]), L = z(f(l([
			sr,
			cr,
			lr,
			fr,
			j,
			N,
			k,
			B,
			I,
			F,
			y,
			pr,
			vr
		]))), Tr = i(/\\./, p), qr = i(/./, p), Yr = z(f(l([
			Tr,
			i(/\*\*\*+/, "*"),
			i(/([^/{[(!])\*\*/, (r, e) => `${e}*`),
			i(/(^|.)\*\*(?=[^*/)\]}])/, (r, e) => `${e}*`),
			qr
		]))), $ = (r, e) => {
			const n = Array.isArray(r) ? r : [r];
			if (!n.length) return false;
			const a = n.map($.compile), t = n.every((s) => /(\/(?:\*\*)?|\[\/\])$/.test(s)), o = e.replace(/[\\\/]+/g, "/").replace(/\/$/, t ? "/" : "");
			return a.some((s) => s.test(o));
		};
		$.compile = (r) => new RegExp(`^${L(Yr(r))}$`, "s");
		var re = $;
		return J(w);
	})();
	return __lib__.default || __lib__;
};
let _match;
const zeptomatch = (path, pattern) => {
	if (!_match) {
		_match = _lazyMatch();
		_lazyMatch = null;
	}
	return _match(path, pattern);
};
const _DRIVE_LETTER_START_RE = /^[A-Za-z]:\//;
function normalizeWindowsPath(input = "") {
	if (!input) return input;
	return input.replace(/\\/g, "/").replace(_DRIVE_LETTER_START_RE, (r) => r.toUpperCase());
}
const _UNC_REGEX = /^[/\\]{2}/;
const _IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/;
const _DRIVE_LETTER_RE = /^[A-Za-z]:$/;
const _ROOT_FOLDER_RE = /^\/([A-Za-z]:)?$/;
const _EXTNAME_RE = /.(\.[^./]+|\.)$/;
const _PATH_ROOT_RE = /^[/\\]|^[a-zA-Z]:[/\\]/;
const normalize = function(path) {
	if (path.length === 0) return ".";
	path = normalizeWindowsPath(path);
	const isUNCPath = path.match(_UNC_REGEX);
	const isPathAbsolute = isAbsolute(path);
	const trailingSeparator = path[path.length - 1] === "/";
	path = normalizeString(path, !isPathAbsolute);
	if (path.length === 0) {
		if (isPathAbsolute) return "/";
		return trailingSeparator ? "./" : ".";
	}
	if (trailingSeparator) path += "/";
	if (_DRIVE_LETTER_RE.test(path)) path += "/";
	if (isUNCPath) {
		if (!isPathAbsolute) return `//./${path}`;
		return `//${path}`;
	}
	return isPathAbsolute && !isAbsolute(path) ? `/${path}` : path;
};
const join = function(...segments) {
	let path = "";
	for (const seg of segments) {
		if (!seg) continue;
		if (path.length > 0) {
			const pathTrailing = path[path.length - 1] === "/";
			const segLeading = seg[0] === "/";
			if (pathTrailing && segLeading) path += seg.slice(1);
			else path += pathTrailing || segLeading ? seg : `/${seg}`;
		} else path += seg;
	}
	return normalize(path);
};
function cwd() {
	if (typeof process !== "undefined" && typeof process.cwd === "function") return process.cwd().replace(/\\/g, "/");
	return "/";
}
const resolve = function(...arguments_) {
	arguments_ = arguments_.map((argument) => normalizeWindowsPath(argument));
	let resolvedPath = "";
	let resolvedAbsolute = false;
	for (let index = arguments_.length - 1; index >= -1 && !resolvedAbsolute; index--) {
		const path = index >= 0 ? arguments_[index] : cwd();
		if (!path || path.length === 0) continue;
		resolvedPath = `${path}/${resolvedPath}`;
		resolvedAbsolute = isAbsolute(path);
	}
	resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);
	if (resolvedAbsolute && !isAbsolute(resolvedPath)) return `/${resolvedPath}`;
	return resolvedPath.length > 0 ? resolvedPath : ".";
};
function normalizeString(path, allowAboveRoot) {
	let res = "";
	let lastSegmentLength = 0;
	let lastSlash = -1;
	let dots = 0;
	let char = null;
	for (let index = 0; index <= path.length; ++index) {
		if (index < path.length) char = path[index];
		else if (char === "/") break;
		else char = "/";
		if (char === "/") {
			if (lastSlash === index - 1 || dots === 1);
			else if (dots === 2) {
				if (res.length < 2 || lastSegmentLength !== 2 || res[res.length - 1] !== "." || res[res.length - 2] !== ".") {
					if (res.length > 2) {
						const lastSlashIndex = res.lastIndexOf("/");
						if (lastSlashIndex === -1) {
							res = "";
							lastSegmentLength = 0;
						} else {
							res = res.slice(0, lastSlashIndex);
							lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
						}
						lastSlash = index;
						dots = 0;
						continue;
					} else if (res.length > 0) {
						res = "";
						lastSegmentLength = 0;
						lastSlash = index;
						dots = 0;
						continue;
					}
				}
				if (allowAboveRoot) {
					res += res.length > 0 ? "/.." : "..";
					lastSegmentLength = 2;
				}
			} else {
				if (res.length > 0) res += `/${path.slice(lastSlash + 1, index)}`;
				else res = path.slice(lastSlash + 1, index);
				lastSegmentLength = index - lastSlash - 1;
			}
			lastSlash = index;
			dots = 0;
		} else if (char === "." && dots !== -1) ++dots;
		else dots = -1;
	}
	return res;
}
const isAbsolute = function(p) {
	return _IS_ABSOLUTE_RE.test(p);
};
const toNamespacedPath = function(p) {
	return normalizeWindowsPath(p);
};
const extname = function(p) {
	if (p === "..") return "";
	const match = _EXTNAME_RE.exec(normalizeWindowsPath(p));
	return match && match[1] || "";
};
const relative = function(from, to) {
	const _from = resolve(from).replace(_ROOT_FOLDER_RE, "$1").split("/");
	const _to = resolve(to).replace(_ROOT_FOLDER_RE, "$1").split("/");
	if (_to[0][1] === ":" && _from[0][1] === ":" && _from[0] !== _to[0]) return _to.join("/");
	const _fromCopy = [..._from];
	for (const segment of _fromCopy) {
		if (_to[0] !== segment) break;
		_from.shift();
		_to.shift();
	}
	return [..._from.map(() => ".."), ..._to].join("/");
};
const dirname = function(p) {
	const segments = normalizeWindowsPath(p).replace(/\/$/, "").split("/").slice(0, -1);
	if (segments.length === 1 && _DRIVE_LETTER_RE.test(segments[0])) segments[0] += "/";
	return segments.join("/") || (isAbsolute(p) ? "/" : ".");
};
const format = function(p) {
	const ext = p.ext ? p.ext.startsWith(".") ? p.ext : `.${p.ext}` : "";
	const segments = [
		p.root,
		p.dir,
		p.base ?? (p.name ?? "") + ext
	].filter(Boolean);
	return normalizeWindowsPath(p.root ? resolve(...segments) : segments.join("/"));
};
const basename = function(p, extension) {
	const segments = normalizeWindowsPath(p).split("/");
	let lastSegment = "";
	for (let i = segments.length - 1; i >= 0; i--) {
		const val = segments[i];
		if (val) {
			lastSegment = val;
			break;
		}
	}
	return extension && lastSegment.endsWith(extension) ? lastSegment.slice(0, -extension.length) : lastSegment;
};
const parse$1 = function(p) {
	const root = _PATH_ROOT_RE.exec(p)?.[0]?.replace(/\\/g, "/") || "";
	const base = basename(p);
	const extension = extname(base);
	return {
		root,
		dir: dirname(p),
		base,
		ext: extension,
		name: base.slice(0, base.length - extension.length)
	};
};
const matchesGlob = (path, pattern) => {
	return zeptomatch(pattern, normalize(path));
};
const _path = {
	__proto__: null,
	basename,
	dirname,
	extname,
	format,
	isAbsolute,
	join,
	matchesGlob,
	normalize,
	normalizeString,
	parse: parse$1,
	relative,
	resolve,
	sep: "/",
	toNamespacedPath
};
//#endregion
//#region ../../node_modules/.pnpm/pathe@2.0.3/node_modules/pathe/dist/index.mjs
const delimiter = /* @__PURE__ */ (() => globalThis.process?.platform === "win32" ? ";" : ":")();
const _platforms = {
	posix: void 0,
	win32: void 0
};
const mix = (del = delimiter) => {
	return new Proxy(_path, { get(_, prop) {
		if (prop === "delimiter") return del;
		if (prop === "posix") return posix;
		if (prop === "win32") return win32;
		return _platforms[prop] || _path[prop];
	} });
};
const posix = /* @__PURE__ */ mix(":");
const win32 = /* @__PURE__ */ mix(";");
//#endregion
//#region src/constants/version.ts
/**
* The version of Rolldown.
* @example `'1.0.0'`
*
* @category Plugin APIs
*/
const VERSION = "1.0.3";
//#endregion
//#region src/constants/index.ts
/**
* Runtime helper module ID
*/
const RUNTIME_MODULE_ID = "\0rolldown/runtime.js";
//#endregion
//#region src/utils/misc.ts
function arraify(value) {
	return Array.isArray(value) ? value : [value];
}
function unimplemented(info) {
	if (info) throw new Error(`unimplemented: ${info}`);
	throw new Error("unimplemented");
}
function unreachable(info) {
	if (info) throw new Error(`unreachable: ${info}`);
	throw new Error("unreachable");
}
function unsupported(info) {
	throw new Error(`UNSUPPORTED: ${info}`);
}
function noop(..._args) {}
//#endregion
//#region src/log/logging.ts
const LOG_LEVEL_SILENT = "silent";
const LOG_LEVEL_WARN = "warn";
const LOG_LEVEL_INFO = "info";
const LOG_LEVEL_DEBUG = "debug";
const logLevelPriority = {
	[LOG_LEVEL_DEBUG]: 0,
	[LOG_LEVEL_INFO]: 1,
	[LOG_LEVEL_WARN]: 2,
	[LOG_LEVEL_SILENT]: 3
};
//#endregion
//#region src/log/log-handler.ts
const normalizeLog = (log) => typeof log === "string" ? { message: log } : typeof log === "function" ? normalizeLog(log()) : log;
function getLogHandler(level, code, logger, pluginName, logLevel) {
	if (logLevelPriority[level] < logLevelPriority[logLevel]) return noop;
	return (log, pos) => {
		if (pos != null) logger(LOG_LEVEL_WARN, logInvalidLogPosition(pluginName));
		log = normalizeLog(log);
		if (log.code && !log.pluginCode) log.pluginCode = log.code;
		log.code = code;
		log.plugin = pluginName;
		logger(level, log);
	};
}
//#endregion
//#region src/log/logger.ts
function getLogger(plugins, onLog, logLevel, watchMode) {
	const minimalPriority = logLevelPriority[logLevel];
	const logger = (level, log, skipped = /* @__PURE__ */ new Set()) => {
		if (logLevelPriority[level] < minimalPriority) return;
		for (const plugin of getSortedPlugins("onLog", plugins)) {
			if (skipped.has(plugin)) continue;
			const { onLog: pluginOnLog } = plugin;
			if (pluginOnLog) {
				const getLogHandler = (level) => {
					if (logLevelPriority[level] < minimalPriority) return () => {};
					return (log) => logger(level, normalizeLog(log), new Set(skipped).add(plugin));
				};
				if (("handler" in pluginOnLog ? pluginOnLog.handler : pluginOnLog).call({
					debug: getLogHandler("debug"),
					error: (log) => error(normalizeLog(log)),
					info: getLogHandler("info"),
					meta: {
						rollupVersion: "4.23.0",
						rolldownVersion: VERSION,
						watchMode
					},
					warn: getLogHandler("warn"),
					pluginName: plugin.name || "unknown"
				}, level, log) === false) return;
			}
		}
		onLog(level, log);
	};
	return logger;
}
const getOnLog = (config, logLevel, printLog = defaultPrintLog) => {
	const { onwarn, onLog } = config;
	const defaultOnLog = getDefaultOnLog(printLog, onwarn);
	if (onLog) {
		const minimalPriority = logLevelPriority[logLevel];
		return (level, log) => onLog(level, addLogToString(log), (level, handledLog) => {
			if (level === "error") return error(normalizeLog(handledLog));
			if (logLevelPriority[level] >= minimalPriority) defaultOnLog(level, normalizeLog(handledLog));
		});
	}
	return defaultOnLog;
};
const getDefaultOnLog = (printLog, onwarn) => onwarn ? (level, log) => {
	if (level === "warn") onwarn(addLogToString(log), (warning) => printLog(LOG_LEVEL_WARN, normalizeLog(warning)));
	else printLog(level, log);
} : printLog;
const addLogToString = (log) => {
	Object.defineProperty(log, "toString", {
		value: () => getExtendedLogMessage(log),
		writable: true
	});
	return log;
};
const defaultPrintLog = (level, log) => {
	const message = getExtendedLogMessage(log);
	switch (level) {
		case LOG_LEVEL_WARN: return console.warn(message);
		case LOG_LEVEL_DEBUG: return console.debug(message);
		default: return console.info(message);
	}
};
const getExtendedLogMessage = (log) => {
	let prefix = "";
	if (log.plugin) prefix += `(${log.plugin} plugin) `;
	if (log.loc) prefix += `${relativeId(log.loc.file)} (${log.loc.line}:${log.loc.column}) `;
	return prefix + log.message;
};
function relativeId(id) {
	if (!posix.isAbsolute(id)) return id;
	return posix.relative(posix.resolve(), id);
}
//#endregion
//#region src/utils/normalize-hook.ts
function normalizeHook(hook) {
	if (typeof hook === "function" || typeof hook === "string") return {
		handler: hook,
		options: {},
		meta: {}
	};
	if (typeof hook === "object" && hook !== null) {
		const { handler, order, ...options } = hook;
		return {
			handler,
			options,
			meta: { order }
		};
	}
	unreachable("Invalid hook type");
}
//#endregion
//#region src/constants/plugin.ts
const ENUMERATED_INPUT_PLUGIN_HOOK_NAMES = [
	"options",
	"buildStart",
	"resolveId",
	"load",
	"transform",
	"moduleParsed",
	"buildEnd",
	"onLog",
	"resolveDynamicImport",
	"closeBundle",
	"closeWatcher",
	"watchChange"
];
const ENUMERATED_OUTPUT_PLUGIN_HOOK_NAMES = [
	"augmentChunkHash",
	"outputOptions",
	"renderChunk",
	"renderStart",
	"renderError",
	"writeBundle",
	"generateBundle"
];
const ENUMERATED_PLUGIN_HOOK_NAMES = [
	...ENUMERATED_INPUT_PLUGIN_HOOK_NAMES,
	...ENUMERATED_OUTPUT_PLUGIN_HOOK_NAMES,
	"footer",
	"banner",
	"intro",
	"outro"
];
ENUMERATED_PLUGIN_HOOK_NAMES[0], ENUMERATED_PLUGIN_HOOK_NAMES[0], ENUMERATED_PLUGIN_HOOK_NAMES[1], ENUMERATED_PLUGIN_HOOK_NAMES[1], ENUMERATED_PLUGIN_HOOK_NAMES[2], ENUMERATED_PLUGIN_HOOK_NAMES[2], ENUMERATED_PLUGIN_HOOK_NAMES[3], ENUMERATED_PLUGIN_HOOK_NAMES[3], ENUMERATED_PLUGIN_HOOK_NAMES[4], ENUMERATED_PLUGIN_HOOK_NAMES[4], ENUMERATED_PLUGIN_HOOK_NAMES[5], ENUMERATED_PLUGIN_HOOK_NAMES[5], ENUMERATED_PLUGIN_HOOK_NAMES[6], ENUMERATED_PLUGIN_HOOK_NAMES[6], ENUMERATED_PLUGIN_HOOK_NAMES[7], ENUMERATED_PLUGIN_HOOK_NAMES[7], ENUMERATED_PLUGIN_HOOK_NAMES[8], ENUMERATED_PLUGIN_HOOK_NAMES[8], ENUMERATED_PLUGIN_HOOK_NAMES[9], ENUMERATED_PLUGIN_HOOK_NAMES[9], ENUMERATED_PLUGIN_HOOK_NAMES[10], ENUMERATED_PLUGIN_HOOK_NAMES[10], ENUMERATED_PLUGIN_HOOK_NAMES[11], ENUMERATED_PLUGIN_HOOK_NAMES[11], ENUMERATED_PLUGIN_HOOK_NAMES[12], ENUMERATED_PLUGIN_HOOK_NAMES[12], ENUMERATED_PLUGIN_HOOK_NAMES[13], ENUMERATED_PLUGIN_HOOK_NAMES[13], ENUMERATED_PLUGIN_HOOK_NAMES[14], ENUMERATED_PLUGIN_HOOK_NAMES[14], ENUMERATED_PLUGIN_HOOK_NAMES[15], ENUMERATED_PLUGIN_HOOK_NAMES[15], ENUMERATED_PLUGIN_HOOK_NAMES[16], ENUMERATED_PLUGIN_HOOK_NAMES[16], ENUMERATED_PLUGIN_HOOK_NAMES[17], ENUMERATED_PLUGIN_HOOK_NAMES[17], ENUMERATED_PLUGIN_HOOK_NAMES[18], ENUMERATED_PLUGIN_HOOK_NAMES[18], ENUMERATED_PLUGIN_HOOK_NAMES[19], ENUMERATED_PLUGIN_HOOK_NAMES[19], ENUMERATED_PLUGIN_HOOK_NAMES[20], ENUMERATED_PLUGIN_HOOK_NAMES[20], ENUMERATED_PLUGIN_HOOK_NAMES[21], ENUMERATED_PLUGIN_HOOK_NAMES[21], ENUMERATED_PLUGIN_HOOK_NAMES[22], ENUMERATED_PLUGIN_HOOK_NAMES[22];
//#endregion
//#region src/utils/async-flatten.ts
async function asyncFlatten(array) {
	do
		array = (await Promise.all(array)).flat(Infinity);
	while (array.some((v) => v?.then));
	return array;
}
//#endregion
//#region src/utils/normalize-plugin-option.ts
const normalizePluginOption = async (plugins) => (await asyncFlatten([plugins])).filter(Boolean);
function checkOutputPluginOption(plugins, onLog) {
	for (const plugin of plugins) for (const hook of ENUMERATED_INPUT_PLUGIN_HOOK_NAMES) if (hook in plugin) {
		delete plugin[hook];
		onLog(LOG_LEVEL_WARN, logInputHookInOutputPlugin(plugin.name, hook));
	}
	return plugins;
}
function normalizePlugins(plugins, anonymousPrefix) {
	for (const [index, plugin] of plugins.entries()) {
		if ("_parallel" in plugin) continue;
		if (plugin instanceof BuiltinPlugin) continue;
		if (!plugin.name) plugin.name = `${anonymousPrefix}${index + 1}`;
	}
	return plugins;
}
const ANONYMOUS_PLUGIN_PREFIX = "at position ";
const ANONYMOUS_OUTPUT_PLUGIN_PREFIX = "at output position ";
//#endregion
//#region src/plugin/minimal-plugin-context.ts
var MinimalPluginContextImpl = class {
	pluginName;
	hookName;
	info;
	warn;
	debug;
	meta;
	constructor(onLog, logLevel, pluginName, watchMode, hookName) {
		this.pluginName = pluginName;
		this.hookName = hookName;
		this.debug = getLogHandler(LOG_LEVEL_DEBUG, "PLUGIN_LOG", onLog, pluginName, logLevel);
		this.info = getLogHandler(LOG_LEVEL_INFO, "PLUGIN_LOG", onLog, pluginName, logLevel);
		this.warn = getLogHandler(LOG_LEVEL_WARN, "PLUGIN_WARNING", onLog, pluginName, logLevel);
		this.meta = {
			rollupVersion: "4.23.0",
			rolldownVersion: VERSION,
			watchMode
		};
	}
	error(e) {
		return error(logPluginError(normalizeLog(e), this.pluginName, { hook: this.hookName }));
	}
};
//#endregion
//#region src/plugin/plugin-driver.ts
var PluginDriver = class {
	static async callOptionsHook(inputOptions, watchMode = false) {
		const logLevel = inputOptions.logLevel || "info";
		const plugins = getSortedPlugins("options", getObjectPlugins(await normalizePluginOption(inputOptions.plugins)));
		const logger = getLogger(plugins, getOnLog(inputOptions, logLevel), logLevel, watchMode);
		for (const plugin of plugins) {
			const name = plugin.name || "unknown";
			const options = plugin.options;
			if (options) {
				const { handler } = normalizeHook(options);
				const result = await handler.call(new MinimalPluginContextImpl(logger, logLevel, name, watchMode, "onLog"), inputOptions);
				if (result) inputOptions = result;
			}
		}
		return inputOptions;
	}
	static callOutputOptionsHook(rawPlugins, outputOptions, onLog, logLevel, watchMode) {
		const sortedPlugins = getSortedPlugins("outputOptions", getObjectPlugins(rawPlugins));
		for (const plugin of sortedPlugins) {
			const name = plugin.name || "unknown";
			const options = plugin.outputOptions;
			if (options) {
				const { handler } = normalizeHook(options);
				const result = handler.call(new MinimalPluginContextImpl(onLog, logLevel, name, watchMode), outputOptions);
				if (result) outputOptions = result;
			}
		}
		return outputOptions;
	}
};
function getObjectPlugins(plugins) {
	return plugins.filter((plugin) => {
		if (!plugin) return;
		if ("_parallel" in plugin) return;
		if (plugin instanceof BuiltinPlugin) return;
		return plugin;
	});
}
function getSortedPlugins(hookName, plugins) {
	const pre = [];
	const normal = [];
	const post = [];
	for (const plugin of plugins) {
		const hook = plugin[hookName];
		if (hook) {
			if (typeof hook === "object") {
				if (hook.order === "pre") {
					pre.push(plugin);
					continue;
				}
				if (hook.order === "post") {
					post.push(plugin);
					continue;
				}
			}
			normal.push(plugin);
		}
	}
	return [
		...pre,
		...normal,
		...post
	];
}
const DEFAULT_CONFIG = {
	lang: void 0,
	message: void 0,
	abortEarly: void 0,
	abortPipeEarly: void 0
};
/**
* Returns the global configuration.
*
* @param config The config to merge.
*
* @returns The configuration.
*/
/* @__NO_SIDE_EFFECTS__ */
function getGlobalConfig(config$1) {
	if (!config$1 && true) return DEFAULT_CONFIG;
	return {
		lang: config$1?.lang ?? void 0,
		message: config$1?.message,
		abortEarly: config$1?.abortEarly ?? void 0,
		abortPipeEarly: config$1?.abortPipeEarly ?? void 0
	};
}
/**
* Stringifies an unknown input to a literal or type string.
*
* @param input The unknown input.
*
* @returns A literal or type string.
*
* @internal
*/
/* @__NO_SIDE_EFFECTS__ */
function _stringify(input) {
	const type = typeof input;
	if (type === "string") return `"${input}"`;
	if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
	if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
	return type;
}
/**
* Adds an issue to the dataset.
*
* @param context The issue context.
* @param label The issue label.
* @param dataset The input dataset.
* @param config The configuration.
* @param other The optional props.
*
* @internal
*/
function _addIssue(context, label, dataset, config$1, other) {
	const input = other && "input" in other ? other.input : dataset.value;
	const expected = other?.expected ?? context.expects ?? null;
	const received = other?.received ?? /* @__PURE__ */ _stringify(input);
	const issue = {
		kind: context.kind,
		type: context.type,
		input,
		expected,
		received,
		message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
		requirement: context.requirement,
		path: other?.path,
		issues: other?.issues,
		lang: config$1.lang,
		abortEarly: config$1.abortEarly,
		abortPipeEarly: config$1.abortPipeEarly
	};
	const isSchema = context.kind === "schema";
	const message$1 = other?.message ?? context.message ?? (context.reference, issue.lang, void 0) ?? (isSchema ? (issue.lang, void 0) : null) ?? config$1.message ?? (issue.lang, void 0);
	if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
	if (isSchema) dataset.typed = false;
	if (dataset.issues) dataset.issues.push(issue);
	else dataset.issues = [issue];
}
const _standardCache = /* @__PURE__ */ new WeakMap();
/**
* Returns the Standard Schema properties.
*
* @param context The schema context.
*
* @returns The Standard Schema properties.
*/
/* @__NO_SIDE_EFFECTS__ */
function _getStandardProps(context) {
	let cached = _standardCache.get(context);
	if (!cached) {
		cached = {
			version: 1,
			vendor: "valibot",
			validate(value$1) {
				return context["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig());
			}
		};
		_standardCache.set(context, cached);
	}
	return cached;
}
/**
* Disallows inherited object properties and prevents object prototype
* pollution by disallowing certain keys.
*
* @param object The object to check.
* @param key The key to check.
*
* @returns Whether the key is allowed.
*
* @internal
*/
/* @__NO_SIDE_EFFECTS__ */
function _isValidObjectKey(object$1, key) {
	return Object.prototype.hasOwnProperty.call(object$1, key) && key !== "__proto__" && key !== "prototype" && key !== "constructor";
}
/**
* Joins multiple `expects` values with the given separator.
*
* @param values The `expects` values.
* @param separator The separator.
*
* @returns The joined `expects` property.
*
* @internal
*/
/* @__NO_SIDE_EFFECTS__ */
function _joinExpects(values$1, separator) {
	const list = [...new Set(values$1)];
	if (list.length > 1) return `(${list.join(` ${separator} `)})`;
	return list[0] ?? "never";
}
/**
* A Valibot error with useful information.
*/
var ValiError = class extends Error {
	/**
	* Creates a Valibot error with useful information.
	*
	* @param issues The error issues.
	*/
	constructor(issues) {
		super(issues[0].message);
		this.name = "ValiError";
		this.issues = issues;
	}
};
/* @__NO_SIDE_EFFECTS__ */
function args(schema) {
	return {
		kind: "transformation",
		type: "args",
		reference: args,
		async: false,
		schema,
		"~run"(dataset, config$1) {
			const func = dataset.value;
			dataset.value = (...args_) => {
				const argsDataset = this.schema["~run"]({ value: args_ }, config$1);
				if (argsDataset.issues) throw new ValiError(argsDataset.issues);
				return func(...argsDataset.value);
			};
			return dataset;
		}
	};
}
/**
* Creates an await transformation action.
*
* @returns An await action.
*/
/* @__NO_SIDE_EFFECTS__ */
function awaitAsync() {
	return {
		kind: "transformation",
		type: "await",
		reference: awaitAsync,
		async: true,
		async "~run"(dataset) {
			dataset.value = await dataset.value;
			return dataset;
		}
	};
}
/**
* Creates a description metadata action.
*
* @param description_ The description text.
*
* @returns A description action.
*/
/* @__NO_SIDE_EFFECTS__ */
function description(description_) {
	return {
		kind: "metadata",
		type: "description",
		reference: description,
		description: description_
	};
}
/* @__NO_SIDE_EFFECTS__ */
function returns(schema) {
	return {
		kind: "transformation",
		type: "returns",
		reference: returns,
		async: false,
		schema,
		"~run"(dataset, config$1) {
			const func = dataset.value;
			dataset.value = (...args_) => {
				const returnsDataset = this.schema["~run"]({ value: func(...args_) }, config$1);
				if (returnsDataset.issues) throw new ValiError(returnsDataset.issues);
				return returnsDataset.value;
			};
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function returnsAsync(schema) {
	return {
		kind: "transformation",
		type: "returns",
		reference: returnsAsync,
		async: false,
		schema,
		"~run"(dataset, config$1) {
			const func = dataset.value;
			dataset.value = async (...args_) => {
				const returnsDataset = await this.schema["~run"]({ value: await func(...args_) }, config$1);
				if (returnsDataset.issues) throw new ValiError(returnsDataset.issues);
				return returnsDataset.value;
			};
			return dataset;
		}
	};
}
const ABORT_EARLY_CONFIG = { abortEarly: true };
/**
* Returns the fallback value of the schema.
*
* @param schema The schema to get it from.
* @param dataset The output dataset if available.
* @param config The config if available.
*
* @returns The fallback value.
*/
/* @__NO_SIDE_EFFECTS__ */
function getFallback(schema, dataset, config$1) {
	return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
/**
* Returns the default value of the schema.
*
* @param schema The schema to get it from.
* @param dataset The input dataset if available.
* @param config The config if available.
*
* @returns The default value.
*/
/* @__NO_SIDE_EFFECTS__ */
function getDefault(schema, dataset, config$1) {
	return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
/**
* Checks if the input matches the schema. By using a type predicate, this
* function can be used as a type guard.
*
* @param schema The schema to be used.
* @param input The input to be tested.
*
* @returns Whether the input matches the schema.
*/
/* @__NO_SIDE_EFFECTS__ */
function is(schema, input) {
	return !schema["~run"]({ value: input }, ABORT_EARLY_CONFIG).issues;
}
/**
* Creates an any schema.
*
* Hint: This schema function exists only for completeness and is not
* recommended in practice. Instead, `unknown` should be used to accept
* unknown data.
*
* @returns An any schema.
*/
/* @__NO_SIDE_EFFECTS__ */
function any() {
	return {
		kind: "schema",
		type: "any",
		reference: any,
		expects: "any",
		async: false,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset) {
			dataset.typed = true;
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function array(item, message$1) {
	return {
		kind: "schema",
		type: "array",
		reference: array,
		expects: "Array",
		async: false,
		item,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			const input = dataset.value;
			if (Array.isArray(input)) {
				dataset.typed = true;
				dataset.value = [];
				for (let key = 0; key < input.length; key++) {
					const value$1 = input[key];
					const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
					if (itemDataset.issues) {
						const pathItem = {
							type: "array",
							origin: "value",
							input,
							key,
							value: value$1
						};
						for (const issue of itemDataset.issues) {
							if (issue.path) issue.path.unshift(pathItem);
							else issue.path = [pathItem];
							dataset.issues?.push(issue);
						}
						if (!dataset.issues) dataset.issues = itemDataset.issues;
						if (config$1.abortEarly) {
							dataset.typed = false;
							break;
						}
					}
					if (!itemDataset.typed) dataset.typed = false;
					dataset.value.push(itemDataset.value);
				}
			} else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function boolean(message$1) {
	return {
		kind: "schema",
		type: "boolean",
		reference: boolean,
		expects: "boolean",
		async: false,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (typeof dataset.value === "boolean") dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function custom(check$1, message$1) {
	return {
		kind: "schema",
		type: "custom",
		reference: custom,
		expects: "unknown",
		async: false,
		check: check$1,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (this.check(dataset.value)) dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function function_(message$1) {
	return {
		kind: "schema",
		type: "function",
		reference: function_,
		expects: "Function",
		async: false,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (typeof dataset.value === "function") dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function instance(class_, message$1) {
	return {
		kind: "schema",
		type: "instance",
		reference: instance,
		expects: class_.name,
		async: false,
		class: class_,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (dataset.value instanceof this.class) dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function literal(literal_, message$1) {
	return {
		kind: "schema",
		type: "literal",
		reference: literal,
		expects: /* @__PURE__ */ _stringify(literal_),
		async: false,
		literal: literal_,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (dataset.value === this.literal) dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function never(message$1) {
	return {
		kind: "schema",
		type: "never",
		reference: never,
		expects: "never",
		async: false,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			_addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function nullish(wrapped, default_) {
	return {
		kind: "schema",
		type: "nullish",
		reference: nullish,
		expects: `(${wrapped.expects} | null | undefined)`,
		async: false,
		wrapped,
		default: default_,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (dataset.value === null || dataset.value === void 0) {
				if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault(this, dataset, config$1);
				if (dataset.value === null || dataset.value === void 0) {
					dataset.typed = true;
					return dataset;
				}
			}
			return this.wrapped["~run"](dataset, config$1);
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function number(message$1) {
	return {
		kind: "schema",
		type: "number",
		reference: number,
		expects: "number",
		async: false,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (typeof dataset.value === "number" && !isNaN(dataset.value)) dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function object(entries$1, message$1) {
	return {
		kind: "schema",
		type: "object",
		reference: object,
		expects: "Object",
		async: false,
		entries: entries$1,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			const input = dataset.value;
			if (input && typeof input === "object") {
				dataset.typed = true;
				dataset.value = {};
				for (const key in this.entries) {
					const valueSchema = this.entries[key];
					if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
						const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault(valueSchema);
						const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
						if (valueDataset.issues) {
							const pathItem = {
								type: "object",
								origin: "value",
								input,
								key,
								value: value$1
							};
							for (const issue of valueDataset.issues) {
								if (issue.path) issue.path.unshift(pathItem);
								else issue.path = [pathItem];
								dataset.issues?.push(issue);
							}
							if (!dataset.issues) dataset.issues = valueDataset.issues;
							if (config$1.abortEarly) {
								dataset.typed = false;
								break;
							}
						}
						if (!valueDataset.typed) dataset.typed = false;
						dataset.value[key] = valueDataset.value;
					} else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
					else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
						_addIssue(this, "key", dataset, config$1, {
							input: void 0,
							expected: `"${key}"`,
							path: [{
								type: "object",
								origin: "key",
								input,
								key,
								value: input[key]
							}]
						});
						if (config$1.abortEarly) break;
					}
				}
			} else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function optional(wrapped, default_) {
	return {
		kind: "schema",
		type: "optional",
		reference: optional,
		expects: `(${wrapped.expects} | undefined)`,
		async: false,
		wrapped,
		default: default_,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (dataset.value === void 0) {
				if (this.default !== void 0) dataset.value = /* @__PURE__ */ getDefault(this, dataset, config$1);
				if (dataset.value === void 0) {
					dataset.typed = true;
					return dataset;
				}
			}
			return this.wrapped["~run"](dataset, config$1);
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function promise(message$1) {
	return {
		kind: "schema",
		type: "promise",
		reference: promise,
		expects: "Promise",
		async: false,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (dataset.value instanceof Promise) dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function record(key, value$1, message$1) {
	return {
		kind: "schema",
		type: "record",
		reference: record,
		expects: "Object",
		async: false,
		key,
		value: value$1,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			const input = dataset.value;
			if (input && typeof input === "object") {
				dataset.typed = true;
				dataset.value = {};
				for (const entryKey in input) if (/* @__PURE__ */ _isValidObjectKey(input, entryKey)) {
					const entryValue = input[entryKey];
					const keyDataset = this.key["~run"]({ value: entryKey }, config$1);
					if (keyDataset.issues) {
						const pathItem = {
							type: "object",
							origin: "key",
							input,
							key: entryKey,
							value: entryValue
						};
						for (const issue of keyDataset.issues) {
							issue.path = [pathItem];
							dataset.issues?.push(issue);
						}
						if (!dataset.issues) dataset.issues = keyDataset.issues;
						if (config$1.abortEarly) {
							dataset.typed = false;
							break;
						}
					}
					const valueDataset = this.value["~run"]({ value: entryValue }, config$1);
					if (valueDataset.issues) {
						const pathItem = {
							type: "object",
							origin: "value",
							input,
							key: entryKey,
							value: entryValue
						};
						for (const issue of valueDataset.issues) {
							if (issue.path) issue.path.unshift(pathItem);
							else issue.path = [pathItem];
							dataset.issues?.push(issue);
						}
						if (!dataset.issues) dataset.issues = valueDataset.issues;
						if (config$1.abortEarly) {
							dataset.typed = false;
							break;
						}
					}
					if (!keyDataset.typed || !valueDataset.typed) dataset.typed = false;
					if (keyDataset.typed) dataset.value[keyDataset.value] = valueDataset.value;
				}
			} else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function strictObject(entries$1, message$1) {
	return {
		kind: "schema",
		type: "strict_object",
		reference: strictObject,
		expects: "Object",
		async: false,
		entries: entries$1,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			const input = dataset.value;
			if (input && typeof input === "object") {
				dataset.typed = true;
				dataset.value = {};
				for (const key in this.entries) {
					const valueSchema = this.entries[key];
					if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
						const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault(valueSchema);
						const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
						if (valueDataset.issues) {
							const pathItem = {
								type: "object",
								origin: "value",
								input,
								key,
								value: value$1
							};
							for (const issue of valueDataset.issues) {
								if (issue.path) issue.path.unshift(pathItem);
								else issue.path = [pathItem];
								dataset.issues?.push(issue);
							}
							if (!dataset.issues) dataset.issues = valueDataset.issues;
							if (config$1.abortEarly) {
								dataset.typed = false;
								break;
							}
						}
						if (!valueDataset.typed) dataset.typed = false;
						dataset.value[key] = valueDataset.value;
					} else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
					else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
						_addIssue(this, "key", dataset, config$1, {
							input: void 0,
							expected: `"${key}"`,
							path: [{
								type: "object",
								origin: "key",
								input,
								key,
								value: input[key]
							}]
						});
						if (config$1.abortEarly) break;
					}
				}
				if (!dataset.issues || !config$1.abortEarly) {
					for (const key in input) if (!(key in this.entries)) {
						_addIssue(this, "key", dataset, config$1, {
							input: key,
							expected: "never",
							path: [{
								type: "object",
								origin: "key",
								input,
								key,
								value: input[key]
							}]
						});
						break;
					}
				}
			} else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function string(message$1) {
	return {
		kind: "schema",
		type: "string",
		reference: string,
		expects: "string",
		async: false,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (typeof dataset.value === "string") dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function tuple(items, message$1) {
	return {
		kind: "schema",
		type: "tuple",
		reference: tuple,
		expects: "Array",
		async: false,
		items,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			const input = dataset.value;
			if (Array.isArray(input)) {
				dataset.typed = true;
				dataset.value = [];
				for (let key = 0; key < this.items.length; key++) {
					const value$1 = input[key];
					const itemDataset = this.items[key]["~run"]({ value: value$1 }, config$1);
					if (itemDataset.issues) {
						const pathItem = {
							type: "array",
							origin: "value",
							input,
							key,
							value: value$1
						};
						for (const issue of itemDataset.issues) {
							if (issue.path) issue.path.unshift(pathItem);
							else issue.path = [pathItem];
							dataset.issues?.push(issue);
						}
						if (!dataset.issues) dataset.issues = itemDataset.issues;
						if (config$1.abortEarly) {
							dataset.typed = false;
							break;
						}
					}
					if (!itemDataset.typed) dataset.typed = false;
					dataset.value.push(itemDataset.value);
				}
			} else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function undefined_(message$1) {
	return {
		kind: "schema",
		type: "undefined",
		reference: undefined_,
		expects: "undefined",
		async: false,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (dataset.value === void 0) dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/**
* Returns the sub issues of the provided datasets for the union issue.
*
* @param datasets The datasets.
*
* @returns The sub issues.
*
* @internal
*/
/* @__NO_SIDE_EFFECTS__ */
function _subIssues(datasets) {
	let issues;
	if (datasets) for (const dataset of datasets) if (issues) for (const issue of dataset.issues) issues.push(issue);
	else issues = dataset.issues;
	return issues;
}
/* @__NO_SIDE_EFFECTS__ */
function union(options, message$1) {
	return {
		kind: "schema",
		type: "union",
		reference: union,
		expects: /* @__PURE__ */ _joinExpects(options.map((option) => option.expects), "|"),
		async: false,
		options,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			let validDataset;
			let typedDatasets;
			let untypedDatasets;
			for (const schema of this.options) {
				const optionDataset = schema["~run"]({ value: dataset.value }, config$1);
				if (optionDataset.typed) if (optionDataset.issues) if (typedDatasets) typedDatasets.push(optionDataset);
				else typedDatasets = [optionDataset];
				else {
					validDataset = optionDataset;
					break;
				}
				else if (untypedDatasets) untypedDatasets.push(optionDataset);
				else untypedDatasets = [optionDataset];
			}
			if (validDataset) return validDataset;
			if (typedDatasets) {
				if (typedDatasets.length === 1) return typedDatasets[0];
				_addIssue(this, "type", dataset, config$1, { issues: /* @__PURE__ */ _subIssues(typedDatasets) });
				dataset.typed = true;
			} else if (untypedDatasets?.length === 1) return untypedDatasets[0];
			else _addIssue(this, "type", dataset, config$1, { issues: /* @__PURE__ */ _subIssues(untypedDatasets) });
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function unionAsync(options, message$1) {
	return {
		kind: "schema",
		type: "union",
		reference: unionAsync,
		expects: /* @__PURE__ */ _joinExpects(options.map((option) => option.expects), "|"),
		async: true,
		options,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		async "~run"(dataset, config$1) {
			let validDataset;
			let typedDatasets;
			let untypedDatasets;
			for (const schema of this.options) {
				const optionDataset = await schema["~run"]({ value: dataset.value }, config$1);
				if (optionDataset.typed) if (optionDataset.issues) if (typedDatasets) typedDatasets.push(optionDataset);
				else typedDatasets = [optionDataset];
				else {
					validDataset = optionDataset;
					break;
				}
				else if (untypedDatasets) untypedDatasets.push(optionDataset);
				else untypedDatasets = [optionDataset];
			}
			if (validDataset) return validDataset;
			if (typedDatasets) {
				if (typedDatasets.length === 1) return typedDatasets[0];
				_addIssue(this, "type", dataset, config$1, { issues: /* @__PURE__ */ _subIssues(typedDatasets) });
				dataset.typed = true;
			} else if (untypedDatasets?.length === 1) return untypedDatasets[0];
			else _addIssue(this, "type", dataset, config$1, { issues: /* @__PURE__ */ _subIssues(untypedDatasets) });
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function void_(message$1) {
	return {
		kind: "schema",
		type: "void",
		reference: void_,
		expects: "void",
		async: false,
		message: message$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			if (dataset.value === void 0) dataset.typed = true;
			else _addIssue(this, "type", dataset, config$1);
			return dataset;
		}
	};
}
/**
* Creates a modified copy of an object schema that does not contain the
* selected entries.
*
* @param schema The schema to omit from.
* @param keys The selected entries.
*
* @returns An object schema.
*/
/* @__NO_SIDE_EFFECTS__ */
function omit(schema, keys) {
	const entries$1 = { ...schema.entries };
	for (const key of keys) delete entries$1[key];
	return {
		...schema,
		entries: entries$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function partial(schema, keys) {
	const entries$1 = {};
	for (const key in schema.entries) entries$1[key] = !keys || keys.includes(key) ? /* @__PURE__ */ optional(schema.entries[key]) : schema.entries[key];
	return {
		...schema,
		entries: entries$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function pipe(...pipe$1) {
	return {
		...pipe$1[0],
		pipe: pipe$1,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		"~run"(dataset, config$1) {
			for (const item of pipe$1) if (item.kind !== "metadata") {
				if (dataset.issues && (item.kind === "schema" || item.kind === "transformation")) {
					dataset.typed = false;
					break;
				}
				if (!dataset.issues || !config$1.abortEarly && !config$1.abortPipeEarly) dataset = item["~run"](dataset, config$1);
			}
			return dataset;
		}
	};
}
/* @__NO_SIDE_EFFECTS__ */
function pipeAsync(...pipe$1) {
	return {
		...pipe$1[0],
		pipe: pipe$1,
		async: true,
		get "~standard"() {
			return /* @__PURE__ */ _getStandardProps(this);
		},
		async "~run"(dataset, config$1) {
			for (const item of pipe$1) if (item.kind !== "metadata") {
				if (dataset.issues && (item.kind === "schema" || item.kind === "transformation")) {
					dataset.typed = false;
					break;
				}
				if (!dataset.issues || !config$1.abortEarly && !config$1.abortPipeEarly) dataset = await item["~run"](dataset, config$1);
			}
			return dataset;
		}
	};
}
/**
* Parses an unknown input based on a schema.
*
* @param schema The schema to be used.
* @param input The input to be parsed.
* @param config The parse configuration.
*
* @returns The parse result.
*/
/* @__NO_SIDE_EFFECTS__ */
function safeParse(schema, input, config$1) {
	const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig(config$1));
	return {
		typed: dataset.typed,
		success: !dataset.issues,
		output: dataset.value,
		issues: dataset.issues
	};
}
//#endregion
//#region src/utils/style-text.ts
function styleText(...args) {
	return args[1];
}
//#endregion
//#region src/utils/validator.ts
const StringOrRegExpSchema = /* @__PURE__ */ union([/* @__PURE__ */ string(), /* @__PURE__ */ instance(RegExp)]);
function vFunction() {
	return /* @__PURE__ */ function_();
}
const LogLevelSchema = /* @__PURE__ */ union([
	/* @__PURE__ */ literal("debug"),
	/* @__PURE__ */ literal("info"),
	/* @__PURE__ */ literal("warn")
]);
const LogLevelOptionSchema = /* @__PURE__ */ union([LogLevelSchema, /* @__PURE__ */ literal("silent")]);
const LogLevelWithErrorSchema = /* @__PURE__ */ union([LogLevelSchema, /* @__PURE__ */ literal("error")]);
const RollupLogSchema = /* @__PURE__ */ any();
const RollupLogWithStringSchema = /* @__PURE__ */ union([RollupLogSchema, /* @__PURE__ */ string()]);
const InputOptionSchema = /* @__PURE__ */ union([
	/* @__PURE__ */ string(),
	/* @__PURE__ */ array(/* @__PURE__ */ string()),
	/* @__PURE__ */ record(/* @__PURE__ */ string(), /* @__PURE__ */ string())
]);
const ExternalOptionFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([
	/* @__PURE__ */ string(),
	/* @__PURE__ */ optional(/* @__PURE__ */ string()),
	/* @__PURE__ */ boolean()
])), /* @__PURE__ */ returns(/* @__PURE__ */ nullish(/* @__PURE__ */ boolean())));
const ExternalOptionSchema = /* @__PURE__ */ union([
	StringOrRegExpSchema,
	/* @__PURE__ */ array(StringOrRegExpSchema),
	ExternalOptionFunctionSchema
]);
const ModuleTypesSchema = /* @__PURE__ */ record(/* @__PURE__ */ string(), /* @__PURE__ */ union([
	/* @__PURE__ */ literal("asset"),
	/* @__PURE__ */ literal("base64"),
	/* @__PURE__ */ literal("binary"),
	/* @__PURE__ */ literal("copy"),
	/* @__PURE__ */ literal("css"),
	/* @__PURE__ */ literal("dataurl"),
	/* @__PURE__ */ literal("empty"),
	/* @__PURE__ */ literal("js"),
	/* @__PURE__ */ literal("json"),
	/* @__PURE__ */ literal("jsx"),
	/* @__PURE__ */ literal("text"),
	/* @__PURE__ */ literal("ts"),
	/* @__PURE__ */ literal("tsx")
]));
const TransformOptionsSchema = /* @__PURE__ */ object({
	assumptions: /* @__PURE__ */ optional(/* @__PURE__ */ object({
		ignoreFunctionLength: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		noDocumentAll: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		objectRestNoSymbols: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		pureGetters: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		setPublicClassFields: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
	})),
	typescript: /* @__PURE__ */ optional(/* @__PURE__ */ object({
		jsxPragma: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
		jsxPragmaFrag: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
		onlyRemoveTypeImports: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		allowNamespaces: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		allowDeclareFields: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		removeClassFieldsWithoutInitializer: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		optimizeConstEnums: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		optimizeEnums: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		declaration: /* @__PURE__ */ optional(/* @__PURE__ */ object({
			stripInternal: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
			sourcemap: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
		})),
		rewriteImportExtensions: /* @__PURE__ */ optional(/* @__PURE__ */ union([
			/* @__PURE__ */ literal("rewrite"),
			/* @__PURE__ */ literal("remove"),
			/* @__PURE__ */ boolean()
		]))
	})),
	helpers: /* @__PURE__ */ optional(/* @__PURE__ */ object({ mode: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ literal("Runtime"), /* @__PURE__ */ literal("External")])) })),
	decorator: /* @__PURE__ */ optional(/* @__PURE__ */ object({
		legacy: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		emitDecoratorMetadata: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		strictNullChecks: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
	})),
	jsx: /* @__PURE__ */ optional(/* @__PURE__ */ union([
		/* @__PURE__ */ literal(false),
		/* @__PURE__ */ literal("preserve"),
		/* @__PURE__ */ literal("react"),
		/* @__PURE__ */ literal("react-jsx"),
		/* @__PURE__ */ strictObject({
			runtime: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ literal("classic"), /* @__PURE__ */ literal("automatic")])), /* @__PURE__ */ description("Which runtime to use")),
			development: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Development specific information")),
			throwIfNamespace: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Toggles whether to throw an error when a tag name uses an XML namespace")),
			pure: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Mark JSX elements and top-level React method calls as pure for tree shaking.")),
			importSource: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Import the factory of element and fragment if mode is classic")),
			pragma: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Jsx element transformation")),
			pragmaFrag: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Jsx fragment transformation")),
			refresh: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ any()])), /* @__PURE__ */ description("Enable react fast refresh"))
		})
	])),
	target: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ string(), /* @__PURE__ */ array(/* @__PURE__ */ string())])), /* @__PURE__ */ description("The JavaScript target environment")),
	define: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ record(/* @__PURE__ */ string(), /* @__PURE__ */ string())), /* @__PURE__ */ description("Define global variables (syntax: key:value,key2:value2)")),
	inject: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ record(/* @__PURE__ */ string(), /* @__PURE__ */ union([/* @__PURE__ */ string(), /* @__PURE__ */ tuple([/* @__PURE__ */ string(), /* @__PURE__ */ string()])]))), /* @__PURE__ */ description("Inject import statements on demand")),
	dropLabels: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())), /* @__PURE__ */ description("Remove labeled statements with these label names")),
	plugins: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ object({
		styledComponents: /* @__PURE__ */ optional(/* @__PURE__ */ any()),
		taggedTemplateEscape: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
	})), /* @__PURE__ */ description("Third-party plugins to use"))
});
const WatcherFileWatcherOptionsSchema = /* @__PURE__ */ strictObject({
	usePolling: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Use polling-based file watching instead of native OS events")),
	pollInterval: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ number()), /* @__PURE__ */ description("Poll interval in milliseconds (only used when usePolling is true)")),
	compareContentsForPolling: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Compare file contents for poll-based watchers (only used when usePolling is true)")),
	useDebounce: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Use debounced event delivery at the filesystem level")),
	debounceDelay: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ number()), /* @__PURE__ */ description("Debounce delay in milliseconds (only used when useDebounce is true)")),
	debounceTickRate: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ number()), /* @__PURE__ */ description("Tick rate in milliseconds for debouncer (only used when useDebounce is true)"))
});
const WatcherOptionsSchema = /* @__PURE__ */ strictObject({
	chokidar: /* @__PURE__ */ optional(/* @__PURE__ */ never(`The "watch.chokidar" option is deprecated, please use "watch.watcher" instead of it`)),
	exclude: /* @__PURE__ */ optional(/* @__PURE__ */ union([StringOrRegExpSchema, /* @__PURE__ */ array(StringOrRegExpSchema)])),
	include: /* @__PURE__ */ optional(/* @__PURE__ */ union([StringOrRegExpSchema, /* @__PURE__ */ array(StringOrRegExpSchema)])),
	watcher: /* @__PURE__ */ optional(WatcherFileWatcherOptionsSchema),
	notify: /* @__PURE__ */ optional(WatcherFileWatcherOptionsSchema),
	skipWrite: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Skip the bundle.write() step")),
	buildDelay: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ number()), /* @__PURE__ */ description("Throttle watch rebuilds")),
	clearScreen: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to clear the screen when a rebuild is triggered")),
	onInvalidate: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(vFunction()), /* @__PURE__ */ description("An optional function that will be called immediately every time a module changes that is part of the build."))
});
const ChecksOptionsSchema = /* @__PURE__ */ strictObject({
	circularDependency: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when detecting circular dependency")),
	eval: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when detecting uses of direct `eval`s")),
	missingGlobalName: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when the `output.globals` option is missing when needed")),
	missingNameOptionForIifeExport: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when the `output.name` option is missing when needed")),
	invalidAnnotation: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when a `#__PURE__` / `@__PURE__` annotation has no effect due to its position")),
	mixedExports: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when the way to export values is ambiguous")),
	unresolvedEntry: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when an entrypoint cannot be resolved")),
	unresolvedImport: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when an import cannot be resolved")),
	filenameConflict: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when files generated have the same name with different contents")),
	commonJsVariableInEsm: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when a CommonJS variable is used in an ES module")),
	importIsUndefined: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when an imported variable is not exported")),
	emptyImportMeta: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when `import.meta` is not supported with the output format and is replaced with an empty object (`{}`)")),
	toleratedTransform: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when detecting tolerated transform")),
	cannotCallNamespace: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when a namespace is called as a function")),
	configurationFieldConflict: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when a config value is overridden by another config value with a higher priority")),
	preferBuiltinFeature: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when a plugin that is covered by a built-in feature is used")),
	couldNotCleanDirectory: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when Rolldown could not clean the output directory")),
	pluginTimings: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when plugins take significant time during the build process")),
	duplicateShebang: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when both the code and postBanner contain shebang")),
	unsupportedTsconfigOption: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when a tsconfig option or combination of options is not supported")),
	ineffectiveDynamicImport: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit warnings when a module is dynamically imported but also statically imported, making the dynamic import ineffective for code splitting")),
	largeBarrelModules: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to emit info logs when a barrel module has a very large number of re-exports (more than 5000)"))
});
const MinifyOptionsSchema = /* @__PURE__ */ strictObject({
	compress: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ strictObject({
		target: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ string(), /* @__PURE__ */ array(/* @__PURE__ */ string())])),
		dropConsole: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		dropDebugger: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		keepNames: /* @__PURE__ */ optional(/* @__PURE__ */ strictObject({
			function: /* @__PURE__ */ boolean(),
			class: /* @__PURE__ */ boolean()
		})),
		unused: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ literal("keep_assign")])),
		joinVars: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		sequences: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		dropLabels: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())),
		maxIterations: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
		treeshake: /* @__PURE__ */ optional(/* @__PURE__ */ strictObject({
			annotations: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
			manualPureFunctions: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())),
			propertyReadSideEffects: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ literal("always")])),
			propertyWriteSideEffects: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
			unknownGlobalSideEffects: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
			invalidImportSideEffects: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
		}))
	})])),
	mangle: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ strictObject({
		toplevel: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		keepNames: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ strictObject({
			function: /* @__PURE__ */ boolean(),
			class: /* @__PURE__ */ boolean()
		})])),
		debug: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
	})])),
	codegen: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ strictObject({
		removeWhitespace: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		legalComments: /* @__PURE__ */ optional(/* @__PURE__ */ union([
			/* @__PURE__ */ literal("none"),
			/* @__PURE__ */ literal("inline"),
			/* @__PURE__ */ literal("eof"),
			/* @__PURE__ */ literal("external"),
			/* @__PURE__ */ strictObject({ linked: /* @__PURE__ */ string() })
		]))
	})]))
});
const ResolveOptionsSchema = /* @__PURE__ */ strictObject({
	alias: /* @__PURE__ */ optional(/* @__PURE__ */ record(/* @__PURE__ */ string(), /* @__PURE__ */ union([
		/* @__PURE__ */ literal(false),
		/* @__PURE__ */ string(),
		/* @__PURE__ */ array(/* @__PURE__ */ string())
	]))),
	aliasFields: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ array(/* @__PURE__ */ string()))),
	conditionNames: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())),
	extensionAlias: /* @__PURE__ */ optional(/* @__PURE__ */ record(/* @__PURE__ */ string(), /* @__PURE__ */ array(/* @__PURE__ */ string()))),
	exportsFields: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ array(/* @__PURE__ */ string()))),
	extensions: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())),
	mainFields: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())),
	mainFiles: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())),
	modules: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())),
	symlinks: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
	tsconfigFilename: /* @__PURE__ */ optional(/* @__PURE__ */ string())
});
const TreeshakingOptionsSchema = /* @__PURE__ */ strictObject({
	moduleSideEffects: /* @__PURE__ */ optional(/* @__PURE__ */ any()),
	annotations: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
	manualPureFunctions: /* @__PURE__ */ optional(/* @__PURE__ */ custom((input) => /* @__PURE__ */ is(/* @__PURE__ */ array(/* @__PURE__ */ string()), input), "string array")),
	unknownGlobalSideEffects: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
	invalidImportSideEffects: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
	commonjs: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
	propertyReadSideEffects: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ literal(false), /* @__PURE__ */ literal("always")])),
	propertyWriteSideEffects: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ literal(false), /* @__PURE__ */ literal("always")]))
});
const OptimizationOptionsSchema = /* @__PURE__ */ strictObject({
	inlineConst: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ strictObject({
		mode: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ literal("all"), /* @__PURE__ */ literal("smart")])),
		pass: /* @__PURE__ */ optional(/* @__PURE__ */ number())
	})])), /* @__PURE__ */ description("Enable crossmodule constant inlining")),
	pifeForModuleWrappers: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Use PIFE pattern for module wrappers"))
});
const LogOrStringHandlerSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([LogLevelWithErrorSchema, RollupLogWithStringSchema])));
const OnLogSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([
	LogLevelSchema,
	RollupLogSchema,
	LogOrStringHandlerSchema
])));
const OnwarnSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([RollupLogSchema, /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ union([RollupLogWithStringSchema, /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ returns(RollupLogWithStringSchema))])])))])));
const DevModeSchema = /* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ strictObject({
	port: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
	host: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
	implement: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
	lazy: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
})]);
const InputOptionsSchema = /* @__PURE__ */ strictObject({
	input: /* @__PURE__ */ optional(InputOptionSchema),
	plugins: /* @__PURE__ */ optional(/* @__PURE__ */ custom(() => true)),
	external: /* @__PURE__ */ optional(ExternalOptionSchema),
	makeAbsoluteExternalsRelative: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ literal("ifRelativeSource")])),
	resolve: /* @__PURE__ */ optional(ResolveOptionsSchema),
	cwd: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Current working directory")),
	platform: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([
		/* @__PURE__ */ literal("browser"),
		/* @__PURE__ */ literal("neutral"),
		/* @__PURE__ */ literal("node")
	])), /* @__PURE__ */ description(`Platform for which the code should be generated (node, ${styleText("underline", "browser")}, neutral)`)),
	shimMissingExports: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Create shim variables for missing exports")),
	treeshake: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), TreeshakingOptionsSchema])),
	optimization: /* @__PURE__ */ optional(OptimizationOptionsSchema),
	logLevel: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(LogLevelOptionSchema), /* @__PURE__ */ description(`Log level (${styleText("dim", "silent")}, ${styleText(["underline", "gray"], "info")}, debug, ${styleText("yellow", "warn")})`)),
	onLog: /* @__PURE__ */ optional(OnLogSchema),
	onwarn: /* @__PURE__ */ optional(OnwarnSchema),
	moduleTypes: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(ModuleTypesSchema), /* @__PURE__ */ description("Module types for customized extensions")),
	experimental: /* @__PURE__ */ optional(/* @__PURE__ */ strictObject({
		viteMode: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		resolveNewUrlToAsset: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		devMode: /* @__PURE__ */ optional(DevModeSchema),
		chunkModulesOrder: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ literal("module-id"), /* @__PURE__ */ literal("exec-order")])),
		attachDebugInfo: /* @__PURE__ */ optional(/* @__PURE__ */ union([
			/* @__PURE__ */ literal("none"),
			/* @__PURE__ */ literal("simple"),
			/* @__PURE__ */ literal("full")
		])),
		chunkImportMap: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ object({
			baseUrl: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
			fileName: /* @__PURE__ */ optional(/* @__PURE__ */ string())
		})])),
		onDemandWrapping: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		incrementalBuild: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		nativeMagicString: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		chunkOptimization: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ strictObject({
			mergeCommonChunks: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
			avoidRedundantChunkLoads: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
		})])),
		lazyBarrel: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
	})),
	transform: /* @__PURE__ */ optional(TransformOptionsSchema),
	watch: /* @__PURE__ */ optional(/* @__PURE__ */ union([WatcherOptionsSchema, /* @__PURE__ */ literal(false)])),
	checks: /* @__PURE__ */ optional(ChecksOptionsSchema),
	devtools: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ object({ sessionId: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Used to name the build.")) })), /* @__PURE__ */ description("Enable debug mode. Emit debug information to disk. This might slow down the build process significantly.")),
	preserveEntrySignatures: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([
		/* @__PURE__ */ literal("strict"),
		/* @__PURE__ */ literal("allow-extension"),
		/* @__PURE__ */ literal("exports-only"),
		/* @__PURE__ */ literal(false)
	]))),
	context: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("The value of `this` at the top level of each module.")),
	tsconfig: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ string()])), /* @__PURE__ */ description("Path to the tsconfig.json file."))
});
const InputCliOverrideSchema = /* @__PURE__ */ strictObject({
	input: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())), /* @__PURE__ */ description("Entry file")),
	external: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string())), /* @__PURE__ */ description("Comma-separated list of module ids to exclude from the bundle `<module-id>,...`")),
	treeshake: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("enable treeshaking")),
	makeAbsoluteExternalsRelative: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Prevent normalization of external imports")),
	preserveEntrySignatures: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ literal(false)), /* @__PURE__ */ description("Avoid facade chunks for entry points")),
	context: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("The entity top-level `this` represents."))
});
const InputCliOptionsSchema = /* @__PURE__ */ omit(/* @__PURE__ */ strictObject({
	...InputOptionsSchema.entries,
	...InputCliOverrideSchema.entries
}), [
	"plugins",
	"onwarn",
	"onLog",
	"resolve",
	"experimental",
	"watch"
]);
const ModuleFormatSchema = /* @__PURE__ */ union([
	/* @__PURE__ */ literal("es"),
	/* @__PURE__ */ literal("cjs"),
	/* @__PURE__ */ literal("esm"),
	/* @__PURE__ */ literal("module"),
	/* @__PURE__ */ literal("commonjs"),
	/* @__PURE__ */ literal("iife"),
	/* @__PURE__ */ literal("umd")
]);
const AddonFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ custom(() => true)])), /* @__PURE__ */ returnsAsync(/* @__PURE__ */ unionAsync([/* @__PURE__ */ string(), /* @__PURE__ */ pipeAsync(/* @__PURE__ */ promise(), /* @__PURE__ */ awaitAsync(), /* @__PURE__ */ string())])));
const ChunkFileNamesFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ custom(() => true)])), /* @__PURE__ */ returns(/* @__PURE__ */ string()));
const ChunkFileNamesSchema = /* @__PURE__ */ union([/* @__PURE__ */ string(), ChunkFileNamesFunctionSchema]);
const AssetFileNamesFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ custom(() => true)])), /* @__PURE__ */ returns(/* @__PURE__ */ string()));
const AssetFileNamesSchema = /* @__PURE__ */ union([/* @__PURE__ */ string(), AssetFileNamesFunctionSchema]);
const SanitizeFileNameFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ string()])), /* @__PURE__ */ returns(/* @__PURE__ */ string()));
const SanitizeFileNameSchema = /* @__PURE__ */ union([/* @__PURE__ */ boolean(), SanitizeFileNameFunctionSchema]);
const GlobalsFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ string()])), /* @__PURE__ */ returns(/* @__PURE__ */ string()));
const PathsFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ string()])), /* @__PURE__ */ returns(/* @__PURE__ */ string()));
const ManualChunksFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ string(), /* @__PURE__ */ object({})])), /* @__PURE__ */ returns(/* @__PURE__ */ nullish(/* @__PURE__ */ string())));
const AdvancedChunksNameFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ string(), /* @__PURE__ */ object({})])), /* @__PURE__ */ returns(/* @__PURE__ */ nullish(/* @__PURE__ */ string())));
const AdvancedChunksTestFunctionSchema = /* @__PURE__ */ pipe(vFunction(), /* @__PURE__ */ args(/* @__PURE__ */ tuple([/* @__PURE__ */ string()])), /* @__PURE__ */ returns(/* @__PURE__ */ union([
	/* @__PURE__ */ boolean(),
	/* @__PURE__ */ void_(),
	/* @__PURE__ */ undefined_()
])));
const AdvancedChunksSchema = /* @__PURE__ */ strictObject({
	includeDependenciesRecursively: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
	minSize: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
	maxSize: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
	minModuleSize: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
	maxModuleSize: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
	minShareCount: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
	groups: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ strictObject({
		name: /* @__PURE__ */ union([/* @__PURE__ */ string(), AdvancedChunksNameFunctionSchema]),
		test: /* @__PURE__ */ optional(/* @__PURE__ */ union([StringOrRegExpSchema, AdvancedChunksTestFunctionSchema])),
		priority: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
		minSize: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
		minShareCount: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
		maxSize: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
		minModuleSize: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
		maxModuleSize: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
		entriesAware: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		entriesAwareMergeThreshold: /* @__PURE__ */ optional(/* @__PURE__ */ number()),
		tags: /* @__PURE__ */ optional(/* @__PURE__ */ array(/* @__PURE__ */ string()))
	})))
});
const GeneratedCodeOptionsSchema = /* @__PURE__ */ strictObject({
	symbols: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to use Symbol.toStringTag for namespace objects")),
	preset: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ literal("es5"), /* @__PURE__ */ literal("es2015")])),
	profilerNames: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Whether to add readable names to internal variables for profiling purposes"))
});
const OutputOptionsSchema = /* @__PURE__ */ strictObject({
	dir: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Output directory, defaults to `dist` if `file` is not set")),
	file: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Single output file")),
	exports: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([
		/* @__PURE__ */ literal("auto"),
		/* @__PURE__ */ literal("named"),
		/* @__PURE__ */ literal("default"),
		/* @__PURE__ */ literal("none")
	])), /* @__PURE__ */ description(`Specify a export mode (${styleText("underline", "auto")}, named, default, none)`)),
	hashCharacters: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([
		/* @__PURE__ */ literal("base64"),
		/* @__PURE__ */ literal("base36"),
		/* @__PURE__ */ literal("hex")
	])), /* @__PURE__ */ description("Use the specified character set for file hashes")),
	format: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(ModuleFormatSchema), /* @__PURE__ */ description(`Output format of the generated bundle (supports ${styleText("underline", "esm")}, cjs, and iife)`)),
	sourcemap: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([
		/* @__PURE__ */ boolean(),
		/* @__PURE__ */ literal("inline"),
		/* @__PURE__ */ literal("hidden")
	])), /* @__PURE__ */ description(`Generate sourcemap (\`-s inline\` for inline, or \`-s\` for \`.map\` file)`)),
	sourcemapBaseUrl: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Base URL used to prefix sourcemap paths")),
	sourcemapDebugIds: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Inject sourcemap debug IDs")),
	sourcemapExcludeSources: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Exclude source content from sourcemaps")),
	sourcemapIgnoreList: /* @__PURE__ */ optional(/* @__PURE__ */ union([
		/* @__PURE__ */ boolean(),
		/* @__PURE__ */ custom(() => true),
		StringOrRegExpSchema
	])),
	sourcemapPathTransform: /* @__PURE__ */ optional(/* @__PURE__ */ custom(() => true)),
	banner: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ string(), AddonFunctionSchema])),
	footer: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ string(), AddonFunctionSchema])),
	postBanner: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ string(), AddonFunctionSchema])),
	postFooter: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ string(), AddonFunctionSchema])),
	intro: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ string(), AddonFunctionSchema])),
	outro: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ string(), AddonFunctionSchema])),
	extend: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Extend global variable defined by name in IIFE / UMD formats")),
	esModule: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ literal("if-default-prop")])),
	assetFileNames: /* @__PURE__ */ optional(AssetFileNamesSchema),
	entryFileNames: /* @__PURE__ */ optional(ChunkFileNamesSchema),
	chunkFileNames: /* @__PURE__ */ optional(ChunkFileNamesSchema),
	sanitizeFileName: /* @__PURE__ */ optional(SanitizeFileNameSchema),
	minify: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([
		/* @__PURE__ */ boolean(),
		/* @__PURE__ */ literal("dce-only"),
		MinifyOptionsSchema
	])), /* @__PURE__ */ description("Minify the bundled file")),
	name: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Name for UMD / IIFE format outputs")),
	globals: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ record(/* @__PURE__ */ string(), /* @__PURE__ */ string()), GlobalsFunctionSchema])), /* @__PURE__ */ description("Global variable of UMD / IIFE dependencies (syntax: `key:value`)")),
	paths: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ record(/* @__PURE__ */ string(), /* @__PURE__ */ string()), PathsFunctionSchema])), /* @__PURE__ */ description("Maps external module IDs to paths")),
	generatedCode: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ partial(GeneratedCodeOptionsSchema)), /* @__PURE__ */ description("Generated code options")),
	externalLiveBindings: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("external live bindings")),
	inlineDynamicImports: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Inline dynamic imports")),
	dynamicImportInCjs: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Dynamic import in CJS output")),
	manualChunks: /* @__PURE__ */ optional(ManualChunksFunctionSchema),
	codeSplitting: /* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), AdvancedChunksSchema])),
	advancedChunks: /* @__PURE__ */ optional(AdvancedChunksSchema),
	legalComments: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ literal("none"), /* @__PURE__ */ literal("inline")])), /* @__PURE__ */ description("Control legal comments in the output")),
	comments: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ strictObject({
		legal: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		annotation: /* @__PURE__ */ optional(/* @__PURE__ */ boolean()),
		jsdoc: /* @__PURE__ */ optional(/* @__PURE__ */ boolean())
	})])), /* @__PURE__ */ description("Control comments in the output")),
	plugins: /* @__PURE__ */ optional(/* @__PURE__ */ custom(() => true)),
	polyfillRequire: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Disable require polyfill injection")),
	hoistTransitiveImports: /* @__PURE__ */ optional(/* @__PURE__ */ literal(false)),
	preserveModules: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Preserve module structure")),
	preserveModulesRoot: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Put preserved modules under this path at root level")),
	virtualDirname: /* @__PURE__ */ optional(/* @__PURE__ */ string()),
	minifyInternalExports: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Minify internal exports")),
	topLevelVar: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Rewrite top-level declarations to use `var`.")),
	cleanDir: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Clean output directory before emitting output")),
	keepNames: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Keep function and class names after bundling")),
	strictExecutionOrder: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Lets modules be executed in the order they are declared.")),
	strict: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ literal("auto")])), /* @__PURE__ */ description("Whether to always output `\"use strict\"` directive in non-ES module outputs."))
});
const getAddonDescription = (placement, wrapper) => {
	return `Code to insert the ${styleText("bold", placement)} of the bundled file (${styleText("bold", wrapper)} the wrapper function)`;
};
const OutputCliOverrideSchema = /* @__PURE__ */ strictObject({
	assetFileNames: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Name pattern for asset files")),
	entryFileNames: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Name pattern for emitted entry chunks")),
	chunkFileNames: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("Name pattern for emitted secondary chunks")),
	sanitizeFileName: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Sanitize file name")),
	banner: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description(getAddonDescription("top", "outside"))),
	footer: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description(getAddonDescription("bottom", "outside"))),
	postBanner: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("A string to prepend to the top of each chunk. Applied after the `renderChunk` hook and minification")),
	postFooter: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description("A string to append to the bottom of each chunk. Applied after the `renderChunk` hook and minification")),
	intro: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description(getAddonDescription("top", "inside"))),
	outro: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ string()), /* @__PURE__ */ description(getAddonDescription("bottom", "inside"))),
	esModule: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Always generate `__esModule` marks in non-ESM formats, defaults to `if-default-prop` (use `--no-esModule` to always disable)")),
	globals: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ record(/* @__PURE__ */ string(), /* @__PURE__ */ string())), /* @__PURE__ */ description("Global variable of UMD / IIFE dependencies (syntax: `key:value`)")),
	codeSplitting: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ union([/* @__PURE__ */ boolean(), /* @__PURE__ */ strictObject({
		minSize: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ number()), /* @__PURE__ */ description("Minimum size of the chunk")),
		minShareCount: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ number()), /* @__PURE__ */ description("Minimum share count of the chunk"))
	})])), /* @__PURE__ */ description("Code splitting options (true, false, or object)")),
	advancedChunks: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ strictObject({
		minSize: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ number()), /* @__PURE__ */ description("Minimum size of the chunk")),
		minShareCount: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ number()), /* @__PURE__ */ description("Minimum share count of the chunk"))
	})), /* @__PURE__ */ description("Deprecated: use codeSplitting instead")),
	minify: /* @__PURE__ */ pipe(/* @__PURE__ */ optional(/* @__PURE__ */ boolean()), /* @__PURE__ */ description("Minify the bundled file"))
});
const OutputCliOptionsSchema = /* @__PURE__ */ omit(/* @__PURE__ */ strictObject({
	...OutputOptionsSchema.entries,
	...OutputCliOverrideSchema.entries
}), [
	"sourcemapIgnoreList",
	"sourcemapPathTransform",
	"plugins",
	"hoistTransitiveImports"
]);
({
	...InputCliOptionsSchema.entries,
	...OutputCliOptionsSchema.entries
});
const inputHelperMsgRecord = {
	output: { ignored: true },
	"resolve.tsconfigFilename": { issueMsg: "It is deprecated. Please use the top-level `tsconfig` option instead." }
};
const outputHelperMsgRecord = {};
function validateOption(key, options) {
	if (typeof options !== "object") throw new Error(`Invalid ${key} options. Expected an Object but received ${JSON.stringify(options)}.`);
	if (globalThis.process?.env?.ROLLUP_TEST) return;
	let parsed = /* @__PURE__ */ safeParse(key === "input" ? InputOptionsSchema : OutputOptionsSchema, options);
	if (!parsed.success) {
		const errors = parsed.issues.map((issue) => {
			let issueMsg = issue.message;
			const issuePaths = issue.path.map((path) => path.key);
			if (issue.type === "union") {
				const subIssue = issue.issues?.find((i) => !(i.type !== issue.received && i.input === issue.input));
				if (subIssue) {
					if (subIssue.path) issuePaths.push(subIssue.path.map((path) => path.key));
					issueMsg = subIssue.message;
				}
			}
			const stringPath = issuePaths.join(".");
			const helper = key === "input" ? inputHelperMsgRecord[stringPath] : outputHelperMsgRecord[stringPath];
			if (helper && helper.ignored) return "";
			return `- For the "${stringPath}". ${helper?.issueMsg || issueMsg + "."} ${helper?.help ? `\n  Help: ${helper.help}` : ""}`;
		}).filter(Boolean);
		if (errors.length) console.warn(`\x1b[33mWarning: Invalid ${key} options (${errors.length} issue${errors.length === 1 ? "" : "s"} found)\n${errors.join("\n")}\x1b[0m`);
	}
}
//#endregion
//#region src/types/plain-object-like.ts
const LAZY_FIELDS_KEY = Symbol("__lazy_fields__");
/**
* Base class for classes that use `@lazyProp` decorated properties.
*
* **Design Pattern in Rolldown:**
* This is a common pattern in Rolldown due to its three-layer architecture:
* TypeScript API → NAPI Bindings → Rust Core
*
* **Why we use getters:**
* For performance - to lazily fetch data from Rust bindings only when needed,
* rather than eagerly fetching all data during object construction.
*
* **The problem:**
* Getters defined on class prototypes are non-enumerable by default, which breaks:
* - Object spread operators ({...obj})
* - Object.keys() and similar methods
* - Standard JavaScript object semantics
*
* **The solution:**
* This base class automatically converts `@lazyProp` decorated getters into
* own enumerable getters on each instance during construction.
*
* **Result:**
* Objects get both lazy-loading performance benefits AND plain JavaScript object behavior.
*
* @example
* ```typescript
* class MyClass extends PlainObjectLike {
*   @lazyProp
*   get myProp() {
*     return fetchFromRustBinding();
*   }
* }
* ```
*/
var PlainObjectLike = class {
	constructor() {
		setupLazyProperties(this);
	}
};
/**
* Set up lazy properties as own getters on an instance.
* This is called automatically by the `PlainObjectLike` base class constructor.
*
* @param instance - The instance to set up lazy properties on
* @internal
*/
function setupLazyProperties(instance) {
	const lazyFields = instance.constructor[LAZY_FIELDS_KEY];
	if (!lazyFields) return;
	for (const [propertyKey, originalGetter] of lazyFields.entries()) {
		let cachedValue;
		let hasValue = false;
		Object.defineProperty(instance, propertyKey, {
			get() {
				if (!hasValue) {
					cachedValue = originalGetter.call(this);
					hasValue = true;
				}
				return cachedValue;
			},
			enumerable: true,
			configurable: true
		});
	}
}
/**
* Get all lazy field names from a class instance.
*
* @param instance - Instance to inspect
* @returns Set of lazy property names
*/
function getLazyFields(instance) {
	const lazyFields = instance.constructor[LAZY_FIELDS_KEY];
	return lazyFields ? new Set(lazyFields.keys()) : /* @__PURE__ */ new Set();
}
//#endregion
//#region src/decorators/lazy.ts
/**
* Decorator that marks a getter as lazy-evaluated and cached.
*
* **What "lazy" means here:**
* 1. Data is lazily fetched from Rust bindings only when the property is accessed (not eagerly on construction)
* 2. Once fetched, the data is cached for subsequent accesses (performance optimization)
* 3. Despite being a getter, it behaves like a plain object property (enumerable, appears in Object.keys())
*
* **Important**: Properties decorated with `@lazyProp` are defined as own enumerable
* properties on each instance (not on the prototype). This ensures they:
* - Appear in Object.keys() and Object.getOwnPropertyNames()
* - Are included in object spreads ({...obj})
* - Are enumerable in for...in loops
*
* Classes using this decorator must extend `PlainObjectLike` base class.
*
* @example
* ```typescript
* class MyClass extends PlainObjectLike {
*   @lazyProp
*   get expensiveValue() {
*     return someExpensiveComputation();
*   }
* }
* ```
*/
function lazyProp(target, propertyKey, descriptor) {
	if (!target.constructor[LAZY_FIELDS_KEY]) target.constructor[LAZY_FIELDS_KEY] = /* @__PURE__ */ new Map();
	const originalGetter = descriptor.get;
	target.constructor[LAZY_FIELDS_KEY].set(propertyKey, originalGetter);
	return {
		enumerable: false,
		configurable: true
	};
}
//#endregion
//#region src/utils/asset-source.ts
function transformAssetSource(bindingAssetSource) {
	return bindingAssetSource.inner;
}
function bindingAssetSource(source) {
	return { inner: source };
}
//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/decorate.js
function __decorate(decorators, target, key, desc) {
	var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
	if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
	else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
	return c > 3 && r && Object.defineProperty(target, key, r), r;
}
//#endregion
//#region src/types/output-asset-impl.ts
var OutputAssetImpl = class extends PlainObjectLike {
	bindingAsset;
	type = "asset";
	constructor(bindingAsset) {
		super();
		this.bindingAsset = bindingAsset;
	}
	get fileName() {
		return this.bindingAsset.getFileName();
	}
	get originalFileName() {
		return this.bindingAsset.getOriginalFileName() || null;
	}
	get originalFileNames() {
		return this.bindingAsset.getOriginalFileNames();
	}
	get name() {
		return this.bindingAsset.getName() ?? void 0;
	}
	get names() {
		return this.bindingAsset.getNames();
	}
	get source() {
		return transformAssetSource(this.bindingAsset.getSource());
	}
	__rolldown_external_memory_handle__(keepDataAlive) {
		if (keepDataAlive) this.#evaluateAllLazyFields();
		return this.bindingAsset.dropInner();
	}
	#evaluateAllLazyFields() {
		for (const field of getLazyFields(this)) this[field];
	}
};
__decorate([lazyProp], OutputAssetImpl.prototype, "fileName", null);
__decorate([lazyProp], OutputAssetImpl.prototype, "originalFileName", null);
__decorate([lazyProp], OutputAssetImpl.prototype, "originalFileNames", null);
__decorate([lazyProp], OutputAssetImpl.prototype, "name", null);
__decorate([lazyProp], OutputAssetImpl.prototype, "names", null);
__decorate([lazyProp], OutputAssetImpl.prototype, "source", null);
//#endregion
//#region src/utils/transform-rendered-module.ts
function transformToRenderedModule(bindingRenderedModule) {
	return {
		get code() {
			return bindingRenderedModule.code;
		},
		get renderedLength() {
			return bindingRenderedModule.code?.length || 0;
		},
		get renderedExports() {
			return bindingRenderedModule.renderedExports;
		}
	};
}
//#endregion
//#region src/utils/transform-rendered-chunk.ts
function transformRenderedChunk(chunk) {
	let modules = null;
	return {
		type: "chunk",
		get name() {
			return chunk.name;
		},
		get isEntry() {
			return chunk.isEntry;
		},
		get isDynamicEntry() {
			return chunk.isDynamicEntry;
		},
		get facadeModuleId() {
			return chunk.facadeModuleId;
		},
		get moduleIds() {
			return chunk.moduleIds;
		},
		get exports() {
			return chunk.exports;
		},
		get fileName() {
			return chunk.fileName;
		},
		get imports() {
			return chunk.imports;
		},
		get dynamicImports() {
			return chunk.dynamicImports;
		},
		get modules() {
			if (!modules) modules = transformChunkModules(chunk.modules);
			return modules;
		}
	};
}
function transformChunkModules(modules) {
	const result = {};
	for (let i = 0; i < modules.values.length; i++) {
		let key = modules.keys[i];
		const mod = modules.values[i];
		result[key] = transformToRenderedModule(mod);
	}
	return result;
}
//#endregion
//#region src/types/output-chunk-impl.ts
var OutputChunkImpl = class extends PlainObjectLike {
	bindingChunk;
	type = "chunk";
	constructor(bindingChunk) {
		super();
		this.bindingChunk = bindingChunk;
	}
	get fileName() {
		return this.bindingChunk.getFileName();
	}
	get name() {
		return this.bindingChunk.getName();
	}
	get exports() {
		return this.bindingChunk.getExports();
	}
	get isEntry() {
		return this.bindingChunk.getIsEntry();
	}
	get facadeModuleId() {
		return this.bindingChunk.getFacadeModuleId() || null;
	}
	get isDynamicEntry() {
		return this.bindingChunk.getIsDynamicEntry();
	}
	get sourcemapFileName() {
		return this.bindingChunk.getSourcemapFileName() || null;
	}
	get preliminaryFileName() {
		return this.bindingChunk.getPreliminaryFileName();
	}
	get code() {
		return this.bindingChunk.getCode();
	}
	get modules() {
		return transformChunkModules(this.bindingChunk.getModules());
	}
	get imports() {
		return this.bindingChunk.getImports();
	}
	get dynamicImports() {
		return this.bindingChunk.getDynamicImports();
	}
	get moduleIds() {
		return this.bindingChunk.getModuleIds();
	}
	get map() {
		const mapString = this.bindingChunk.getMap();
		return mapString ? transformToRollupSourceMap(mapString) : null;
	}
	__rolldown_external_memory_handle__(keepDataAlive) {
		if (keepDataAlive) this.#evaluateAllLazyFields();
		return this.bindingChunk.dropInner();
	}
	#evaluateAllLazyFields() {
		for (const field of getLazyFields(this)) this[field];
	}
};
__decorate([lazyProp], OutputChunkImpl.prototype, "fileName", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "name", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "exports", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "isEntry", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "facadeModuleId", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "isDynamicEntry", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "sourcemapFileName", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "preliminaryFileName", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "code", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "modules", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "imports", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "dynamicImports", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "moduleIds", null);
__decorate([lazyProp], OutputChunkImpl.prototype, "map", null);
//#endregion
//#region src/utils/transform-to-rollup-output.ts
function transformToRollupSourceMap(map) {
	const obj = {
		...JSON.parse(map),
		toString() {
			return JSON.stringify(obj);
		},
		toUrl() {
			return `data:application/json;charset=utf-8;base64,${Buffer.from(obj.toString(), "utf-8").toString("base64")}`;
		}
	};
	return obj;
}
function transformToRollupOutputChunk(bindingChunk) {
	return new OutputChunkImpl(bindingChunk);
}
function transformToMutableRollupOutputChunk(bindingChunk, changed) {
	const chunk = {
		type: "chunk",
		get code() {
			return bindingChunk.getCode();
		},
		fileName: bindingChunk.getFileName(),
		name: bindingChunk.getName(),
		get modules() {
			return transformChunkModules(bindingChunk.getModules());
		},
		get imports() {
			return bindingChunk.getImports();
		},
		get dynamicImports() {
			return bindingChunk.getDynamicImports();
		},
		exports: bindingChunk.getExports(),
		isEntry: bindingChunk.getIsEntry(),
		facadeModuleId: bindingChunk.getFacadeModuleId() || null,
		isDynamicEntry: bindingChunk.getIsDynamicEntry(),
		get moduleIds() {
			return bindingChunk.getModuleIds();
		},
		get map() {
			const map = bindingChunk.getMap();
			return map ? transformToRollupSourceMap(map) : null;
		},
		sourcemapFileName: bindingChunk.getSourcemapFileName() || null,
		preliminaryFileName: bindingChunk.getPreliminaryFileName()
	};
	const cache = {};
	return new Proxy(chunk, {
		get(target, p) {
			if (p in cache) return cache[p];
			const value = target[p];
			cache[p] = value;
			return value;
		},
		set(_target, p, newValue) {
			cache[p] = newValue;
			changed.updated.add(bindingChunk.getFileName());
			return true;
		},
		has(target, p) {
			if (p in cache) return true;
			return p in target;
		}
	});
}
function transformToRollupOutputAsset(bindingAsset) {
	return new OutputAssetImpl(bindingAsset);
}
function transformToMutableRollupOutputAsset(bindingAsset, changed) {
	const asset = {
		type: "asset",
		fileName: bindingAsset.getFileName(),
		originalFileName: bindingAsset.getOriginalFileName() || null,
		originalFileNames: bindingAsset.getOriginalFileNames(),
		get source() {
			return transformAssetSource(bindingAsset.getSource());
		},
		name: bindingAsset.getName() ?? void 0,
		names: bindingAsset.getNames()
	};
	const cache = {};
	return new Proxy(asset, {
		get(target, p) {
			if (p in cache) return cache[p];
			const value = target[p];
			cache[p] = value;
			return value;
		},
		set(_target, p, newValue) {
			cache[p] = newValue;
			changed.updated.add(bindingAsset.getFileName());
			return true;
		}
	});
}
function transformToRollupOutput(output) {
	const { chunks, assets } = output;
	return { output: [...chunks.map((chunk) => transformToRollupOutputChunk(chunk)), ...assets.map((asset) => transformToRollupOutputAsset(asset))] };
}
function transformToMutableRollupOutput(output, changed) {
	const { chunks, assets } = output;
	return { output: [...chunks.map((chunk) => transformToMutableRollupOutputChunk(chunk, changed)), ...assets.map((asset) => transformToMutableRollupOutputAsset(asset, changed))] };
}
function transformToOutputBundle(context, output, changed) {
	const bundle = Object.fromEntries(transformToMutableRollupOutput(output, changed).output.map((item) => [item.fileName, item]));
	return new Proxy(bundle, {
		set(_target, _p, _newValue, _receiver) {
			const originalStackTraceLimit = Error.stackTraceLimit;
			Error.stackTraceLimit = 2;
			const message = "This plugin assigns to bundle variable. This is discouraged by Rollup and is not supported by Rolldown. This will be ignored. https://rollupjs.org/plugin-development/#generatebundle:~:text=DANGER,this.emitFile.";
			const stack = (/* @__PURE__ */ new Error(message)).stack ?? message;
			Error.stackTraceLimit = originalStackTraceLimit;
			context.warn({
				message: stack,
				code: "UNSUPPORTED_BUNDLE_ASSIGNMENT"
			});
			return true;
		},
		deleteProperty(target, property) {
			if (typeof property === "string") changed.deleted.add(property);
			return true;
		}
	});
}
function collectChangedBundle(changed, bundle) {
	const changes = {};
	for (const key in bundle) {
		if (changed.deleted.has(key) || !changed.updated.has(key)) continue;
		const item = bundle[key];
		if (item.type === "asset") changes[key] = {
			filename: item.fileName,
			originalFileNames: item.originalFileNames,
			source: bindingAssetSource(item.source),
			names: item.names
		};
		else changes[key] = {
			code: item.code,
			filename: item.fileName,
			name: item.name,
			isEntry: item.isEntry,
			exports: item.exports,
			modules: {},
			imports: item.imports,
			dynamicImports: item.dynamicImports,
			facadeModuleId: item.facadeModuleId || void 0,
			isDynamicEntry: item.isDynamicEntry,
			moduleIds: item.moduleIds,
			map: bindingifySourcemap$1(item.map),
			sourcemapFilename: item.sourcemapFileName || void 0,
			preliminaryFilename: item.preliminaryFileName
		};
	}
	return {
		changes,
		deleted: changed.deleted
	};
}
//#endregion
//#region src/types/rolldown-output-impl.ts
var RolldownOutputImpl = class extends PlainObjectLike {
	bindingOutputs;
	constructor(bindingOutputs) {
		super();
		this.bindingOutputs = bindingOutputs;
	}
	get output() {
		return transformToRollupOutput(this.bindingOutputs).output;
	}
	__rolldown_external_memory_handle__(keepDataAlive) {
		const results = this.output.map((item) => item.__rolldown_external_memory_handle__(keepDataAlive));
		if (!results.every((r) => r.freed)) {
			const reasons = results.filter((r) => !r.freed).map((r) => r.reason).filter(Boolean);
			return {
				freed: false,
				reason: `Failed to free ${reasons.length} item(s): ${reasons.join("; ")}`
			};
		}
		return { freed: true };
	}
};
__decorate([lazyProp], RolldownOutputImpl.prototype, "output", null);
//#endregion
//#region src/binding-magic-string.ts
Object.defineProperty(BindingMagicString.prototype, "isRolldownMagicString", {
	value: true,
	writable: false,
	configurable: false
});
function assertString(content, msg) {
	if (typeof content !== "string") throw new TypeError(msg);
}
const nativeAppend = BindingMagicString.prototype.append;
const nativePrepend = BindingMagicString.prototype.prepend;
const nativeAppendLeft = BindingMagicString.prototype.appendLeft;
const nativeAppendRight = BindingMagicString.prototype.appendRight;
const nativePrependLeft = BindingMagicString.prototype.prependLeft;
const nativePrependRight = BindingMagicString.prototype.prependRight;
const nativeOverwrite = BindingMagicString.prototype.overwrite;
const nativeUpdate = BindingMagicString.prototype.update;
BindingMagicString.prototype.append = function(content) {
	assertString(content, "outro content must be a string");
	return nativeAppend.call(this, content);
};
BindingMagicString.prototype.prepend = function(content) {
	assertString(content, "outro content must be a string");
	return nativePrepend.call(this, content);
};
BindingMagicString.prototype.appendLeft = function(index, content) {
	assertString(content, "inserted content must be a string");
	return nativeAppendLeft.call(this, index, content);
};
BindingMagicString.prototype.appendRight = function(index, content) {
	assertString(content, "inserted content must be a string");
	return nativeAppendRight.call(this, index, content);
};
BindingMagicString.prototype.prependLeft = function(index, content) {
	assertString(content, "inserted content must be a string");
	return nativePrependLeft.call(this, index, content);
};
BindingMagicString.prototype.prependRight = function(index, content) {
	assertString(content, "inserted content must be a string");
	return nativePrependRight.call(this, index, content);
};
BindingMagicString.prototype.overwrite = function(start, end, content, options) {
	assertString(content, "replacement content must be a string");
	return nativeOverwrite.call(this, start, end, content, options);
};
BindingMagicString.prototype.update = function(start, end, content, options) {
	assertString(content, "replacement content must be a string");
	return nativeUpdate.call(this, start, end, content, options);
};
const nativeReplace = BindingMagicString.prototype.replace;
const nativeReplaceAll = BindingMagicString.prototype.replaceAll;
BindingMagicString.prototype.replace = function(searchValue, replacement) {
	if (typeof searchValue === "string") return nativeReplace.call(this, searchValue, replacement);
	if (searchValue.global) searchValue.lastIndex = 0;
	const lastMatchEnd = this.replaceRegex(searchValue, replacement);
	if (searchValue.global) searchValue.lastIndex = 0;
	else if (searchValue.sticky) searchValue.lastIndex = lastMatchEnd === -1 ? 0 : lastMatchEnd;
	return this;
};
BindingMagicString.prototype.replaceAll = function(searchValue, replacement) {
	if (typeof searchValue === "string") return nativeReplaceAll.call(this, searchValue, replacement);
	if (!searchValue.global) throw new TypeError("MagicString.prototype.replaceAll called with a non-global RegExp argument");
	searchValue.lastIndex = 0;
	this.replaceRegex(searchValue, replacement);
	searchValue.lastIndex = 0;
	return this;
};
/**
* A native MagicString implementation powered by Rust.
*
* @experimental
*/
const RolldownMagicString = BindingMagicString;
//#endregion
//#region src/parse-ast-index.ts
function wrap(result, filename, sourceText) {
	if (result.errors.length > 0) return normalizeParseError(filename, sourceText, result.errors);
	return result.program;
}
function normalizeParseError(filename, sourceText, errors) {
	let message = `Parse failed with ${errors.length} error${errors.length < 2 ? "" : "s"}:\n`;
	const pos = errors[0]?.labels?.[0]?.start;
	for (let i = 0; i < errors.length; i++) {
		if (i >= 5) {
			message += "\n...";
			break;
		}
		const e = errors[i];
		message += e.message + "\n" + e.labels.map((label) => {
			const location = locate(sourceText, label.start, { offsetLine: 1 });
			if (!location) return;
			return getCodeFrame(sourceText, location.line, location.column);
		}).filter(Boolean).join("\n");
	}
	const log = logParseError(message, filename, pos);
	if (pos !== void 0 && filename) augmentCodeLocation(log, pos, sourceText, filename);
	return error(log);
}
const defaultParserOptions = {
	lang: "js",
	preserveParens: false
};
/**
* Parse code synchronously and return the AST.
*
* This function is similar to Rollup's `parseAst` function.
* Prefer using {@linkcode parseSync} instead of this function as it has more information in the return value.
*
* @category Utilities
*/
function parseAst(sourceText, options, filename) {
	return wrap(parseSync$1(filename ?? "file.js", sourceText, {
		...defaultParserOptions,
		...options
	}), filename, sourceText);
}
//#endregion
//#region src/utils/transform-module-info.ts
function transformModuleInfo(info, option) {
	return {
		get ast() {
			return unsupported("ModuleInfo#ast");
		},
		get code() {
			return info.code;
		},
		id: info.id,
		importers: info.importers,
		dynamicImporters: info.dynamicImporters,
		importedIds: info.importedIds,
		dynamicallyImportedIds: info.dynamicallyImportedIds,
		exports: info.exports,
		isEntry: info.isEntry,
		inputFormat: info.inputFormat,
		...option
	};
}
//#endregion
//#region src/utils/transform-sourcemap.ts
function isEmptySourcemapFiled(array) {
	if (!array) return true;
	if (array.length === 0 || !array[0]) return true;
	return false;
}
function normalizeTransformHookSourcemap(id, originalCode, rawMap) {
	if (!rawMap) return;
	let map = typeof rawMap === "object" ? rawMap : JSON.parse(rawMap);
	if (isEmptySourcemapFiled(map.sourcesContent)) map.sourcesContent = [originalCode];
	if (isEmptySourcemapFiled(map.sources) || map.sources && map.sources.length === 1 && map.sources[0] !== id) map.sources = [id];
	return map;
}
//#endregion
//#region ../../node_modules/.pnpm/@rolldown+pluginutils@1.0.0/node_modules/@rolldown/pluginutils/dist/filter/composable-filters.js
var And = class {
	kind;
	args;
	constructor(...args) {
		if (args.length === 0) throw new Error("`And` expects at least one operand");
		this.args = args;
		this.kind = "and";
	}
};
var Or = class {
	kind;
	args;
	constructor(...args) {
		if (args.length === 0) throw new Error("`Or` expects at least one operand");
		this.args = args;
		this.kind = "or";
	}
};
var Id = class {
	kind;
	pattern;
	params;
	constructor(pattern, params) {
		this.pattern = pattern;
		this.kind = "id";
		this.params = params ?? { cleanUrl: false };
	}
};
var ModuleType = class {
	kind;
	pattern;
	constructor(pattern) {
		this.pattern = pattern;
		this.kind = "moduleType";
	}
};
var Code = class {
	kind;
	pattern;
	constructor(expr) {
		this.pattern = expr;
		this.kind = "code";
	}
};
var Include = class {
	kind;
	expr;
	constructor(expr) {
		this.expr = expr;
		this.kind = "include";
	}
};
var Exclude = class {
	kind;
	expr;
	constructor(expr) {
		this.expr = expr;
		this.kind = "exclude";
	}
};
function and(...args) {
	return new And(...args);
}
function or(...args) {
	return new Or(...args);
}
function id(pattern, params) {
	return new Id(pattern, params);
}
function moduleType(pattern) {
	return new ModuleType(pattern);
}
function code(pattern) {
	return new Code(pattern);
}
function include(expr) {
	return new Include(expr);
}
function exclude(expr) {
	return new Exclude(expr);
}
//#endregion
//#region ../../node_modules/.pnpm/remeda@2.34.1/node_modules/remeda/dist/lazyDataLastImpl-DtF3cihj.js
function e(e, t, n) {
	let r = (n) => e(n, ...t);
	return n === void 0 ? r : Object.assign(r, {
		lazy: n,
		lazyArgs: t
	});
}
//#endregion
//#region ../../node_modules/.pnpm/remeda@2.34.1/node_modules/remeda/dist/purry.js
function t$1(t, n, r) {
	let i = t.length - n.length;
	if (i === 0) return t(...n);
	if (i === 1) return e(t, n, r);
	throw Error(`Wrong number of arguments`);
}
//#endregion
//#region ../../node_modules/.pnpm/remeda@2.34.1/node_modules/remeda/dist/partition.js
function t(...t) {
	return t$1(n, t);
}
const n = (e, t) => {
	let n = [[], []];
	for (let [r, i] of e.entries()) t(i, r, e) ? n[0].push(i) : n[1].push(i);
	return n;
};
//#endregion
//#region src/plugin/bindingify-hook-filter.ts
function generalHookFilterMatcherToFilterExprs(matcher, stringKind) {
	if (typeof matcher === "string" || matcher instanceof RegExp) return [include(generateAtomMatcher(stringKind, matcher))];
	if (Array.isArray(matcher)) return matcher.map((m) => include(generateAtomMatcher(stringKind, m)));
	let ret = [];
	if (matcher.exclude) ret.push(...arraify(matcher.exclude).map((m) => exclude(generateAtomMatcher(stringKind, m))));
	if (matcher.include) ret.push(...arraify(matcher.include).map((m) => include(generateAtomMatcher(stringKind, m))));
	return ret;
}
function generateAtomMatcher(kind, matcher) {
	return kind === "code" ? code(matcher) : id(matcher);
}
function transformFilterMatcherToFilterExprs(filterOption) {
	if (!filterOption) return;
	if (Array.isArray(filterOption)) return filterOption;
	const { id, code, moduleType: moduleType$1 } = filterOption;
	let ret = [];
	let idIncludes = [];
	let idExcludes = [];
	let codeIncludes = [];
	let codeExcludes = [];
	if (id) [idIncludes, idExcludes] = t(generalHookFilterMatcherToFilterExprs(id, "id") ?? [], (m) => m.kind === "include");
	if (code) [codeIncludes, codeExcludes] = t(generalHookFilterMatcherToFilterExprs(code, "code") ?? [], (m) => m.kind === "include");
	ret.push(...idExcludes);
	ret.push(...codeExcludes);
	let andExprList = [];
	if (moduleType$1) {
		let moduleTypes = Array.isArray(moduleType$1) ? moduleType$1 : moduleType$1.include ?? [];
		andExprList.push(or(...moduleTypes.map((m) => moduleType(m))));
	}
	if (idIncludes.length) andExprList.push(or(...idIncludes.map((item) => item.expr)));
	if (codeIncludes.length) andExprList.push(or(...codeIncludes.map((item) => item.expr)));
	if (andExprList.length) ret.push(include(and(...andExprList)));
	return ret;
}
function bindingifyGeneralHookFilter(stringKind, pattern) {
	let filterExprs = generalHookFilterMatcherToFilterExprs(pattern, stringKind);
	let ret = [];
	if (filterExprs) ret = filterExprs.map(bindingifyFilterExpr);
	return ret.length > 0 ? { value: ret } : void 0;
}
function bindingifyFilterExpr(expr) {
	let list = [];
	bindingifyFilterExprImpl(expr, list);
	return list;
}
function containsImporterId(expr) {
	switch (expr.kind) {
		case "and":
		case "or": return expr.args.some(containsImporterId);
		case "not":
		case "include":
		case "exclude": return containsImporterId(expr.expr);
		case "importerId": return true;
		default: return false;
	}
}
function assertNoImporterId(filterExprs, hookName) {
	if (filterExprs?.some(containsImporterId)) throw new Error(`The \`importerId\` filter can only be used with the \`resolveId\` hook, but it was used with the \`${hookName}\` hook.`);
}
function bindingifyFilterExprImpl(expr, list) {
	switch (expr.kind) {
		case "and": {
			let args = expr.args;
			for (let i = args.length - 1; i >= 0; i--) bindingifyFilterExprImpl(args[i], list);
			list.push({
				kind: "And",
				payload: args.length
			});
			break;
		}
		case "or": {
			let args = expr.args;
			for (let i = args.length - 1; i >= 0; i--) bindingifyFilterExprImpl(args[i], list);
			list.push({
				kind: "Or",
				payload: args.length
			});
			break;
		}
		case "not":
			bindingifyFilterExprImpl(expr.expr, list);
			list.push({ kind: "Not" });
			break;
		case "id":
			list.push({
				kind: "Id",
				payload: expr.pattern
			});
			if (expr.params.cleanUrl) list.push({ kind: "CleanUrl" });
			break;
		case "importerId":
			list.push({
				kind: "ImporterId",
				payload: expr.pattern
			});
			if (expr.params.cleanUrl) list.push({ kind: "CleanUrl" });
			break;
		case "moduleType":
			list.push({
				kind: "ModuleType",
				payload: expr.pattern
			});
			break;
		case "code":
			list.push({
				kind: "Code",
				payload: expr.pattern
			});
			break;
		case "include":
			bindingifyFilterExprImpl(expr.expr, list);
			list.push({ kind: "Include" });
			break;
		case "exclude":
			bindingifyFilterExprImpl(expr.expr, list);
			list.push({ kind: "Exclude" });
			break;
		case "query":
			list.push({
				kind: "QueryKey",
				payload: expr.key
			});
			list.push({
				kind: "QueryValue",
				payload: expr.pattern
			});
			break;
		default: throw new Error(`Unknown filter expression: ${expr}`);
	}
}
function bindingifyResolveIdFilter(filterOption) {
	if (!filterOption) return;
	if (Array.isArray(filterOption)) return { value: filterOption.map(bindingifyFilterExpr) };
	return filterOption.id ? bindingifyGeneralHookFilter("id", filterOption.id) : void 0;
}
function bindingifyLoadFilter(filterOption) {
	if (!filterOption) return;
	if (Array.isArray(filterOption)) {
		assertNoImporterId(filterOption, "load");
		return { value: filterOption.map(bindingifyFilterExpr) };
	}
	return filterOption.id ? bindingifyGeneralHookFilter("id", filterOption.id) : void 0;
}
function bindingifyTransformFilter(filterOption) {
	if (!filterOption) return;
	let filterExprs = transformFilterMatcherToFilterExprs(filterOption);
	assertNoImporterId(filterExprs, "transform");
	let ret = [];
	if (filterExprs) ret = filterExprs.map(bindingifyFilterExpr);
	return { value: ret.length > 0 ? ret : void 0 };
}
function bindingifyRenderChunkFilter(filterOption) {
	if (!filterOption) return;
	if (Array.isArray(filterOption)) {
		assertNoImporterId(filterOption, "renderChunk");
		return { value: filterOption.map(bindingifyFilterExpr) };
	}
	return filterOption.code ? bindingifyGeneralHookFilter("code", filterOption.code) : void 0;
}
//#endregion
//#region src/plugin/bindingify-plugin-hook-meta.ts
function bindingifyPluginHookMeta(options) {
	return { order: bindingPluginOrder(options.order) };
}
function bindingPluginOrder(order) {
	switch (order) {
		case "post": return BindingPluginOrder.Post;
		case "pre": return BindingPluginOrder.Pre;
		case null:
		case void 0: return;
		default: throw new Error(`Unknown plugin order: ${order}`);
	}
}
//#endregion
//#region src/plugin/fs.ts
const fsModule = {
	appendFile: throwNoFileSystemError("fs.appendFile"),
	copyFile: throwNoFileSystemError("fs.copyFile"),
	mkdir: throwNoFileSystemError("fs.mkdir"),
	mkdtemp: throwNoFileSystemError("fs.mkdtemp"),
	readdir: throwNoFileSystemError("fs.readdir"),
	readFile: throwNoFileSystemError("fs.readFile"),
	realpath: throwNoFileSystemError("fs.realpath"),
	rename: throwNoFileSystemError("fs.rename"),
	rmdir: throwNoFileSystemError("fs.rmdir"),
	stat: throwNoFileSystemError("fs.stat"),
	lstat: throwNoFileSystemError("fs.lstat"),
	unlink: throwNoFileSystemError("fs.unlink"),
	writeFile: throwNoFileSystemError("fs.writeFile")
};
function throwNoFileSystemError(method) {
	return () => {
		error(logNoFileSystemInBrowser(method));
	};
}
//#endregion
//#region src/plugin/plugin-context.ts
var PluginContextImpl = class extends MinimalPluginContextImpl {
	outputOptions;
	context;
	data;
	onLog;
	currentLoadingModule;
	fs = fsModule;
	getModuleInfo;
	constructor(outputOptions, context, plugin, data, onLog, logLevel, watchMode, currentLoadingModule) {
		super(onLog, logLevel, plugin.name, watchMode);
		this.outputOptions = outputOptions;
		this.context = context;
		this.data = data;
		this.onLog = onLog;
		this.currentLoadingModule = currentLoadingModule;
		this.getModuleInfo = (id) => this.data.getModuleInfo(id, context);
	}
	async load(options) {
		const id = options.id;
		if (id === this.currentLoadingModule) this.onLog(LOG_LEVEL_WARN, logCycleLoading(this.pluginName, this.currentLoadingModule));
		const moduleInfo = this.data.getModuleInfo(id, this.context);
		if (moduleInfo && moduleInfo.code !== null) return moduleInfo;
		const rawOptions = {
			meta: options.meta || {},
			moduleSideEffects: options.moduleSideEffects || null,
			invalidate: false
		};
		this.data.updateModuleOption(id, rawOptions);
		let loadPromise = this.data.loadModulePromiseMap.get(id);
		if (!loadPromise) {
			loadPromise = this.context.load(id, options.moduleSideEffects ?? void 0, options.packageJsonPath ?? void 0).catch(() => {
				this.data.loadModulePromiseMap.delete(id);
			});
			this.data.loadModulePromiseMap.set(id, loadPromise);
		}
		await loadPromise;
		return this.data.getModuleInfo(id, this.context);
	}
	async resolve(source, importer, options) {
		let receipt = void 0;
		if (options != null) receipt = this.data.saveResolveOptions(options);
		const vitePluginCustom = Object.entries(options?.custom ?? {}).reduce((acc, [key, value]) => {
			if (key.startsWith("vite:")) (acc ??= {})[key] = value;
			return acc;
		}, void 0);
		const res = await this.context.resolve(source, importer, {
			importKind: options?.kind,
			custom: receipt,
			isEntry: options?.isEntry,
			skipSelf: options?.skipSelf,
			vitePluginCustom
		});
		if (receipt != null) this.data.removeSavedResolveOptions(receipt);
		if (res == null) return null;
		const info = this.data.getModuleOption(res.id) || {};
		return {
			...res,
			external: res.external === "relative" ? unreachable(`The PluginContext resolve result external couldn't be 'relative'`) : res.external,
			...info,
			moduleSideEffects: info.moduleSideEffects ?? res.moduleSideEffects ?? null,
			packageJsonPath: res.packageJsonPath
		};
	}
	emitFile = (file) => {
		if (file.type === "prebuilt-chunk") return this.context.emitPrebuiltChunk({
			fileName: file.fileName,
			name: file.name,
			code: file.code,
			exports: file.exports,
			map: bindingifySourcemap$1(file.map),
			sourcemapFileName: file.sourcemapFileName,
			facadeModuleId: file.facadeModuleId,
			isEntry: file.isEntry,
			isDynamicEntry: file.isDynamicEntry
		});
		if (file.type === "chunk") return this.context.emitChunk({
			preserveEntrySignatures: bindingifyPreserveEntrySignatures(file.preserveSignature),
			...file
		});
		const fnSanitizedFileName = file.fileName || typeof this.outputOptions.sanitizeFileName !== "function" ? void 0 : this.outputOptions.sanitizeFileName(file.name || "asset");
		const filename = file.fileName ? void 0 : this.getAssetFileNames(file);
		return this.context.emitFile({
			...file,
			originalFileName: file.originalFileName || void 0,
			source: bindingAssetSource(file.source)
		}, filename, fnSanitizedFileName);
	};
	getAssetFileNames(file) {
		if (typeof this.outputOptions.assetFileNames === "function") return this.outputOptions.assetFileNames({
			type: "asset",
			name: file.name,
			names: file.name ? [file.name] : [],
			originalFileName: file.originalFileName,
			originalFileNames: file.originalFileName ? [file.originalFileName] : [],
			source: file.source
		});
	}
	getFileName(referenceId) {
		return this.context.getFileName(referenceId);
	}
	getModuleIds() {
		return this.data.getModuleIds(this.context);
	}
	addWatchFile(id) {
		this.context.addWatchFile(id);
	}
	parse(input, options) {
		return parseAst(input, options);
	}
};
//#endregion
//#region src/plugin/load-plugin-context.ts
var LoadPluginContextImpl = class extends PluginContextImpl {
	inner;
	constructor(outputOptions, context, plugin, data, inner, moduleId, onLog, logLevelOption, watchMode) {
		super(outputOptions, context, plugin, data, onLog, logLevelOption, watchMode, moduleId);
		this.inner = inner;
	}
	addWatchFile(id) {
		this.inner.addWatchFile(id);
	}
};
//#endregion
//#region src/plugin/transform-plugin-context.ts
var TransformPluginContextImpl = class extends PluginContextImpl {
	inner;
	moduleId;
	moduleSource;
	constructor(outputOptions, context, plugin, data, inner, moduleId, moduleSource, onLog, LogLevelOption, watchMode) {
		super(outputOptions, context, plugin, data, onLog, LogLevelOption, watchMode, moduleId);
		this.inner = inner;
		this.moduleId = moduleId;
		this.moduleSource = moduleSource;
		const getLogHandler = (handler) => (log, pos) => {
			log = normalizeLog(log);
			if (pos) augmentCodeLocation(log, pos, moduleSource, moduleId);
			log.id = moduleId;
			log.hook = "transform";
			handler(log);
		};
		this.debug = getLogHandler(this.debug);
		this.warn = getLogHandler(this.warn);
		this.info = getLogHandler(this.info);
	}
	error(e, pos) {
		if (typeof e === "string") e = { message: e };
		if (pos) augmentCodeLocation(e, pos, this.moduleSource, this.moduleId);
		e.id = this.moduleId;
		e.hook = "transform";
		return error(logPluginError(normalizeLog(e), this.pluginName));
	}
	getCombinedSourcemap() {
		return JSON.parse(this.inner.getCombinedSourcemap());
	}
	addWatchFile(id) {
		this.inner.addWatchFile(id);
	}
	sendMagicString(s) {
		this.inner.sendMagicString(s);
	}
};
//#endregion
//#region src/plugin/bindingify-build-hooks.ts
function createPluginContext(args, ctx) {
	return new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode);
}
function bindingifyBuildStart(args) {
	const hook = args.plugin.buildStart;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, opts) => {
			await handler.call(createPluginContext(args, ctx), args.pluginContextData.getInputOptions(opts));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyBuildEnd(args) {
	const hook = args.plugin.buildEnd;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, err) => {
			await handler.call(createPluginContext(args, ctx), err ? aggregateBindingErrorsIntoJsError(err) : void 0);
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyResolveId(args) {
	const hook = args.plugin.resolveId;
	if (!hook) return {};
	const { handler, meta, options } = normalizeHook(hook);
	return {
		plugin: async (ctx, specifier, importer, extraOptions) => {
			const contextResolveOptions = extraOptions.custom != null ? args.pluginContextData.getSavedResolveOptions(extraOptions.custom) : void 0;
			const ret = await handler.call(createPluginContext(args, ctx), specifier, importer ?? void 0, {
				...extraOptions,
				custom: contextResolveOptions?.custom
			});
			if (ret == null) return;
			if (ret === false) return {
				id: specifier,
				external: true,
				normalizeExternalId: true
			};
			if (typeof ret === "string") return {
				id: ret,
				normalizeExternalId: false
			};
			let exist = args.pluginContextData.updateModuleOption(ret.id, {
				meta: ret.meta || {},
				moduleSideEffects: ret.moduleSideEffects ?? null,
				invalidate: false
			});
			return {
				id: ret.id,
				external: ret.external,
				normalizeExternalId: false,
				moduleSideEffects: exist.moduleSideEffects ?? void 0,
				packageJsonPath: ret.packageJsonPath
			};
		},
		meta: bindingifyPluginHookMeta(meta),
		filter: bindingifyResolveIdFilter(options.filter)
	};
}
function bindingifyResolveDynamicImport(args) {
	const hook = args.plugin.resolveDynamicImport;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, specifier, importer) => {
			const ret = await handler.call(createPluginContext(args, ctx), specifier, importer ?? void 0);
			if (ret == null) return;
			if (ret === false) return {
				id: specifier,
				external: true
			};
			if (typeof ret === "string") return { id: ret };
			const result = {
				id: ret.id,
				external: ret.external,
				packageJsonPath: ret.packageJsonPath
			};
			if (ret.moduleSideEffects !== null) result.moduleSideEffects = ret.moduleSideEffects;
			args.pluginContextData.updateModuleOption(ret.id, {
				meta: ret.meta || {},
				moduleSideEffects: ret.moduleSideEffects || null,
				invalidate: false
			});
			return result;
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyTransform(args) {
	const hook = args.plugin.transform;
	if (!hook) return {};
	const { handler, meta, options } = normalizeHook(hook);
	return {
		plugin: async (ctx, code, id, meta) => {
			let magicStringInstance, astInstance;
			Object.defineProperties(meta, {
				magicString: { get() {
					if (magicStringInstance) return magicStringInstance;
					magicStringInstance = new RolldownMagicString(code);
					return magicStringInstance;
				} },
				ast: { get() {
					if (astInstance) return astInstance;
					let lang = "js";
					switch (meta.moduleType) {
						case "js":
						case "jsx":
						case "ts":
						case "tsx":
							lang = meta.moduleType;
							break;
						default: break;
					}
					astInstance = parseAst(code, {
						astType: meta.moduleType.includes("ts") ? "ts" : "js",
						lang
					});
					return astInstance;
				} }
			});
			const transformCtx = new TransformPluginContextImpl(args.outputOptions, ctx.inner(), args.plugin, args.pluginContextData, ctx, id, code, args.onLog, args.logLevel, args.watchMode);
			const ret = await handler.call(transformCtx, code, id, meta);
			if (ret == null) return;
			if (typeof ret === "string") return { code: ret };
			let moduleOption = args.pluginContextData.updateModuleOption(id, {
				meta: ret.meta ?? {},
				moduleSideEffects: ret.moduleSideEffects ?? null,
				invalidate: false
			});
			let normalizedCode = void 0;
			let map = ret.map;
			if (typeof ret.code === "string") normalizedCode = ret.code;
			else if (ret.code instanceof RolldownMagicString) {
				let magicString = ret.code;
				normalizedCode = magicString.toString();
				let fallbackSourcemap = ctx.sendMagicString(magicString);
				if (fallbackSourcemap != void 0) map = fallbackSourcemap;
			}
			return {
				code: normalizedCode,
				map: bindingifySourcemap$1(normalizeTransformHookSourcemap(id, code, map)) ?? (ret.map === null ? null : void 0),
				moduleSideEffects: moduleOption.moduleSideEffects ?? void 0,
				moduleType: ret.moduleType
			};
		},
		meta: bindingifyPluginHookMeta(meta),
		filter: bindingifyTransformFilter(options.filter)
	};
}
function bindingifyLoad(args) {
	const hook = args.plugin.load;
	if (!hook) return {};
	const { handler, meta, options } = normalizeHook(hook);
	return {
		plugin: async (ctx, id) => {
			const ret = await handler.call(new LoadPluginContextImpl(args.outputOptions, ctx.inner(), args.plugin, args.pluginContextData, ctx, id, args.onLog, args.logLevel, args.watchMode), id);
			if (ret == null) return;
			if (typeof ret === "string") return { code: ret };
			let moduleOption = args.pluginContextData.updateModuleOption(id, {
				meta: ret.meta || {},
				moduleSideEffects: ret.moduleSideEffects ?? null,
				invalidate: false
			});
			let map = preProcessSourceMap(ret, id);
			return {
				code: ret.code,
				map: bindingifySourcemap$1(map),
				moduleType: ret.moduleType,
				moduleSideEffects: moduleOption.moduleSideEffects ?? void 0
			};
		},
		meta: bindingifyPluginHookMeta(meta),
		filter: bindingifyLoadFilter(options.filter)
	};
}
function preProcessSourceMap(ret, id) {
	if (!ret.map) return;
	let map = typeof ret.map === "object" ? ret.map : JSON.parse(ret.map);
	if (!isEmptySourcemapFiled(map.sources)) {
		const directory = posix.dirname(id) || ".";
		const sourceRoot = map.sourceRoot || ".";
		map.sources = map.sources.map((source) => posix.resolve(directory, sourceRoot, source));
	}
	return map;
}
function bindingifyModuleParsed(args) {
	const hook = args.plugin.moduleParsed;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, moduleInfo) => {
			await handler.call(createPluginContext(args, ctx), transformModuleInfo(moduleInfo, args.pluginContextData.getModuleOption(moduleInfo.id)));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
//#endregion
//#region src/plugin/bindingify-output-hooks.ts
function bindingifyRenderStart(args) {
	const hook = args.plugin.renderStart;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, opts) => {
			handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), args.pluginContextData.getOutputOptions(opts), args.pluginContextData.getInputOptions(opts));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyRenderChunk(args) {
	const hook = args.plugin.renderChunk;
	if (!hook) return {};
	const { handler, meta, options } = normalizeHook(hook);
	return {
		plugin: async (ctx, code, chunk, opts, meta) => {
			if (args.pluginContextData.getRenderChunkMeta() == null) args.pluginContextData.setRenderChunkMeta({ chunks: Object.fromEntries(Object.entries(meta.chunks).map(([key, value]) => [key, transformRenderedChunk(value)])) });
			const renderChunkMeta = args.pluginContextData.getRenderChunkMeta();
			let magicStringInstance;
			if (args.options.experimental?.nativeMagicString) Object.defineProperty(renderChunkMeta, "magicString", {
				get() {
					if (magicStringInstance) return magicStringInstance;
					magicStringInstance = new RolldownMagicString(code);
					return magicStringInstance;
				},
				configurable: true
			});
			const ret = await handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), code, transformRenderedChunk(chunk), args.pluginContextData.getOutputOptions(opts), renderChunkMeta);
			if (ret == null) return;
			if (ret instanceof RolldownMagicString) {
				const normalizedCode = ret.toString();
				const generatedMap = ret.generateMap();
				return {
					code: normalizedCode,
					map: bindingifySourcemap$1({
						file: generatedMap.file,
						mappings: generatedMap.mappings,
						names: generatedMap.names,
						sources: generatedMap.sources,
						sourcesContent: generatedMap.sourcesContent.map((s) => s ?? null)
					})
				};
			}
			if (typeof ret === "string") return { code: ret };
			if (ret.code instanceof RolldownMagicString) {
				const magicString = ret.code;
				const normalizedCode = magicString.toString();
				if (ret.map === null) return { code: normalizedCode };
				if (ret.map === void 0) {
					const generatedMap = magicString.generateMap();
					return {
						code: normalizedCode,
						map: bindingifySourcemap$1({
							file: generatedMap.file,
							mappings: generatedMap.mappings,
							names: generatedMap.names,
							sources: generatedMap.sources,
							sourcesContent: generatedMap.sourcesContent.map((s) => s ?? null)
						})
					};
				}
				return {
					code: normalizedCode,
					map: bindingifySourcemap$1(ret.map)
				};
			}
			if (!ret.map) return { code: ret.code };
			return {
				code: ret.code,
				map: bindingifySourcemap$1(ret.map)
			};
		},
		meta: bindingifyPluginHookMeta(meta),
		filter: bindingifyRenderChunkFilter(options.filter)
	};
}
function bindingifyAugmentChunkHash(args) {
	const hook = args.plugin.augmentChunkHash;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, chunk) => {
			return handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), transformRenderedChunk(chunk));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyRenderError(args) {
	const hook = args.plugin.renderError;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, err) => {
			handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), aggregateBindingErrorsIntoJsError(err));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyGenerateBundle(args) {
	const hook = args.plugin.generateBundle;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, bundle, isWrite, opts) => {
			const changed = {
				updated: /* @__PURE__ */ new Set(),
				deleted: /* @__PURE__ */ new Set()
			};
			const context = new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode);
			const output = transformToOutputBundle(context, unwrapBindingResult(bundle), changed);
			await handler.call(context, args.pluginContextData.getOutputOptions(opts), output, isWrite);
			return collectChangedBundle(changed, output);
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyWriteBundle(args) {
	const hook = args.plugin.writeBundle;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, bundle, opts) => {
			const changed = {
				updated: /* @__PURE__ */ new Set(),
				deleted: /* @__PURE__ */ new Set()
			};
			const context = new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode);
			const output = transformToOutputBundle(context, unwrapBindingResult(bundle), changed);
			await handler.call(context, args.pluginContextData.getOutputOptions(opts), output);
			return collectChangedBundle(changed, output);
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyCloseBundle(args) {
	const hook = args.plugin.closeBundle;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, err) => {
			await handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), err ? aggregateBindingErrorsIntoJsError(err) : void 0);
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyBanner(args) {
	const hook = args.plugin.banner;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, chunk) => {
			if (typeof handler === "string") return handler;
			return handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), transformRenderedChunk(chunk));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyFooter(args) {
	const hook = args.plugin.footer;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, chunk) => {
			if (typeof handler === "string") return handler;
			return handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), transformRenderedChunk(chunk));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyIntro(args) {
	const hook = args.plugin.intro;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, chunk) => {
			if (typeof handler === "string") return handler;
			return handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), transformRenderedChunk(chunk));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyOutro(args) {
	const hook = args.plugin.outro;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, chunk) => {
			if (typeof handler === "string") return handler;
			return handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), transformRenderedChunk(chunk));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
//#endregion
//#region src/plugin/bindingify-watch-hooks.ts
function bindingifyWatchChange(args) {
	const hook = args.plugin.watchChange;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx, id, event) => {
			await handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode), id, { event });
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
function bindingifyCloseWatcher(args) {
	const hook = args.plugin.closeWatcher;
	if (!hook) return {};
	const { handler, meta } = normalizeHook(hook);
	return {
		plugin: async (ctx) => {
			await handler.call(new PluginContextImpl(args.outputOptions, ctx, args.plugin, args.pluginContextData, args.onLog, args.logLevel, args.watchMode));
		},
		meta: bindingifyPluginHookMeta(meta)
	};
}
//#endregion
//#region src/plugin/generated/hook-usage.ts
var HookUsage = class {
	bitflag = BigInt(0);
	constructor() {}
	union(kind) {
		this.bitflag |= BigInt(kind);
	}
	inner() {
		return Number(this.bitflag);
	}
};
function extractHookUsage(plugin) {
	let hookUsage = new HookUsage();
	if (plugin.buildStart) hookUsage.union(1);
	if (plugin.resolveId) hookUsage.union(2);
	if (plugin.resolveDynamicImport) hookUsage.union(4);
	if (plugin.load) hookUsage.union(8);
	if (plugin.transform) hookUsage.union(16);
	if (plugin.moduleParsed) hookUsage.union(32);
	if (plugin.buildEnd) hookUsage.union(64);
	if (plugin.renderStart) hookUsage.union(128);
	if (plugin.renderError) hookUsage.union(256);
	if (plugin.renderChunk) hookUsage.union(512);
	if (plugin.augmentChunkHash) hookUsage.union(1024);
	if (plugin.generateBundle) hookUsage.union(2048);
	if (plugin.writeBundle) hookUsage.union(4096);
	if (plugin.closeBundle) hookUsage.union(8192);
	if (plugin.watchChange) hookUsage.union(16384);
	if (plugin.closeWatcher) hookUsage.union(32768);
	if (plugin.banner) hookUsage.union(131072);
	if (plugin.footer) hookUsage.union(262144);
	if (plugin.intro) hookUsage.union(524288);
	if (plugin.outro) hookUsage.union(1048576);
	return hookUsage;
}
//#endregion
//#region src/plugin/bindingify-plugin.ts
function bindingifyPlugin(plugin, options, outputOptions, pluginContextData, normalizedOutputPlugins, onLog, logLevel, watchMode) {
	const args = {
		plugin,
		options,
		outputOptions,
		pluginContextData,
		onLog,
		logLevel,
		watchMode,
		normalizedOutputPlugins
	};
	const { plugin: buildStart, meta: buildStartMeta } = bindingifyBuildStart(args);
	const { plugin: resolveId, meta: resolveIdMeta, filter: resolveIdFilter } = bindingifyResolveId(args);
	const { plugin: resolveDynamicImport, meta: resolveDynamicImportMeta } = bindingifyResolveDynamicImport(args);
	const { plugin: buildEnd, meta: buildEndMeta } = bindingifyBuildEnd(args);
	const { plugin: transform, meta: transformMeta, filter: transformFilter } = bindingifyTransform(args);
	const { plugin: moduleParsed, meta: moduleParsedMeta } = bindingifyModuleParsed(args);
	const { plugin: load, meta: loadMeta, filter: loadFilter } = bindingifyLoad(args);
	const { plugin: renderChunk, meta: renderChunkMeta, filter: renderChunkFilter } = bindingifyRenderChunk(args);
	const { plugin: augmentChunkHash, meta: augmentChunkHashMeta } = bindingifyAugmentChunkHash(args);
	const { plugin: renderStart, meta: renderStartMeta } = bindingifyRenderStart(args);
	const { plugin: renderError, meta: renderErrorMeta } = bindingifyRenderError(args);
	const { plugin: generateBundle, meta: generateBundleMeta } = bindingifyGenerateBundle(args);
	const { plugin: writeBundle, meta: writeBundleMeta } = bindingifyWriteBundle(args);
	const { plugin: closeBundle, meta: closeBundleMeta } = bindingifyCloseBundle(args);
	const { plugin: banner, meta: bannerMeta } = bindingifyBanner(args);
	const { plugin: footer, meta: footerMeta } = bindingifyFooter(args);
	const { plugin: intro, meta: introMeta } = bindingifyIntro(args);
	const { plugin: outro, meta: outroMeta } = bindingifyOutro(args);
	const { plugin: watchChange, meta: watchChangeMeta } = bindingifyWatchChange(args);
	const { plugin: closeWatcher, meta: closeWatcherMeta } = bindingifyCloseWatcher(args);
	let hookUsage = extractHookUsage(plugin).inner();
	return wrapHandlers({
		name: plugin.name,
		buildStart,
		buildStartMeta,
		resolveId,
		resolveIdMeta,
		resolveIdFilter,
		resolveDynamicImport,
		resolveDynamicImportMeta,
		buildEnd,
		buildEndMeta,
		transform,
		transformMeta,
		transformFilter,
		moduleParsed,
		moduleParsedMeta,
		load,
		loadMeta,
		loadFilter,
		renderChunk,
		renderChunkMeta,
		renderChunkFilter,
		augmentChunkHash,
		augmentChunkHashMeta,
		renderStart,
		renderStartMeta,
		renderError,
		renderErrorMeta,
		generateBundle,
		generateBundleMeta,
		writeBundle,
		writeBundleMeta,
		closeBundle,
		closeBundleMeta,
		banner,
		bannerMeta,
		footer,
		footerMeta,
		intro,
		introMeta,
		outro,
		outroMeta,
		watchChange,
		watchChangeMeta,
		closeWatcher,
		closeWatcherMeta,
		hookUsage
	});
}
function wrapHandlers(plugin) {
	for (const hookName of [
		"buildStart",
		"resolveId",
		"resolveDynamicImport",
		"buildEnd",
		"transform",
		"moduleParsed",
		"load",
		"renderChunk",
		"augmentChunkHash",
		"renderStart",
		"renderError",
		"generateBundle",
		"writeBundle",
		"closeBundle",
		"banner",
		"footer",
		"intro",
		"outro",
		"watchChange",
		"closeWatcher"
	]) {
		const handler = plugin[hookName];
		if (handler) plugin[hookName] = async (...args) => {
			try {
				return await handler(...args);
			} catch (e) {
				return error(logPluginError(e, plugin.name, {
					hook: hookName,
					id: hookName === "transform" ? args[2] : void 0
				}));
			}
		};
	}
	return plugin;
}
//#endregion
//#region src/options/normalized-input-options.ts
var NormalizedInputOptionsImpl = class extends PlainObjectLike {
	onLog;
	inputPlugins;
	inner;
	constructor(inner, onLog, inputPlugins) {
		super();
		this.onLog = onLog;
		this.inputPlugins = inputPlugins;
		this.inner = inner;
	}
	get shimMissingExports() {
		return this.inner.shimMissingExports;
	}
	get input() {
		return this.inner.input;
	}
	get cwd() {
		return this.inner.cwd;
	}
	get platform() {
		return this.inner.platform;
	}
	get context() {
		return this.inner.context;
	}
	get plugins() {
		return this.inputPlugins;
	}
};
__decorate([lazyProp], NormalizedInputOptionsImpl.prototype, "shimMissingExports", null);
__decorate([lazyProp], NormalizedInputOptionsImpl.prototype, "input", null);
__decorate([lazyProp], NormalizedInputOptionsImpl.prototype, "cwd", null);
__decorate([lazyProp], NormalizedInputOptionsImpl.prototype, "platform", null);
__decorate([lazyProp], NormalizedInputOptionsImpl.prototype, "context", null);
//#endregion
//#region src/options/normalized-output-options.ts
var NormalizedOutputOptionsImpl = class extends PlainObjectLike {
	inner;
	outputOptions;
	normalizedOutputPlugins;
	constructor(inner, outputOptions, normalizedOutputPlugins) {
		super();
		this.inner = inner;
		this.outputOptions = outputOptions;
		this.normalizedOutputPlugins = normalizedOutputPlugins;
	}
	get dir() {
		return this.inner.dir ?? void 0;
	}
	get entryFileNames() {
		return this.inner.entryFilenames || this.outputOptions.entryFileNames;
	}
	get chunkFileNames() {
		return this.inner.chunkFilenames || this.outputOptions.chunkFileNames;
	}
	get assetFileNames() {
		return this.inner.assetFilenames || this.outputOptions.assetFileNames;
	}
	get format() {
		return this.inner.format;
	}
	get exports() {
		return this.inner.exports;
	}
	get sourcemap() {
		return this.inner.sourcemap;
	}
	get sourcemapBaseUrl() {
		return this.inner.sourcemapBaseUrl ?? void 0;
	}
	get shimMissingExports() {
		return this.inner.shimMissingExports;
	}
	get name() {
		return this.inner.name ?? void 0;
	}
	get file() {
		return this.inner.file ?? void 0;
	}
	get codeSplitting() {
		return this.inner.codeSplitting;
	}
	/**
	* @deprecated Use `codeSplitting` instead.
	*/
	get inlineDynamicImports() {
		return !this.inner.codeSplitting;
	}
	get dynamicImportInCjs() {
		return this.inner.dynamicImportInCjs;
	}
	get externalLiveBindings() {
		return this.inner.externalLiveBindings;
	}
	get banner() {
		return normalizeAddon(this.outputOptions.banner);
	}
	get footer() {
		return normalizeAddon(this.outputOptions.footer);
	}
	get postBanner() {
		return normalizeAddon(this.outputOptions.postBanner);
	}
	get postFooter() {
		return normalizeAddon(this.outputOptions.postFooter);
	}
	get intro() {
		return normalizeAddon(this.outputOptions.intro);
	}
	get outro() {
		return normalizeAddon(this.outputOptions.outro);
	}
	get esModule() {
		return this.inner.esModule;
	}
	get extend() {
		return this.inner.extend;
	}
	get globals() {
		return this.inner.globals || this.outputOptions.globals;
	}
	get paths() {
		return this.outputOptions.paths;
	}
	get hashCharacters() {
		return this.inner.hashCharacters;
	}
	get sourcemapDebugIds() {
		return this.inner.sourcemapDebugIds;
	}
	get sourcemapExcludeSources() {
		return this.inner.sourcemapExcludeSources;
	}
	get sourcemapIgnoreList() {
		return this.outputOptions.sourcemapIgnoreList;
	}
	get sourcemapPathTransform() {
		return this.outputOptions.sourcemapPathTransform;
	}
	get minify() {
		let ret = this.inner.minify;
		if (typeof ret === "object" && ret !== null) {
			delete ret["codegen"];
			delete ret["module"];
			delete ret["sourcemap"];
		}
		return ret;
	}
	get legalComments() {
		return this.inner.legalComments;
	}
	get comments() {
		const c = this.inner.comments;
		return {
			legal: c.legal ?? true,
			annotation: c.annotation ?? true,
			jsdoc: c.jsdoc ?? true
		};
	}
	get polyfillRequire() {
		return this.inner.polyfillRequire;
	}
	get plugins() {
		return this.normalizedOutputPlugins;
	}
	get preserveModules() {
		return this.inner.preserveModules;
	}
	get preserveModulesRoot() {
		return this.inner.preserveModulesRoot;
	}
	get virtualDirname() {
		return this.inner.virtualDirname;
	}
	get topLevelVar() {
		return this.inner.topLevelVar ?? false;
	}
	get minifyInternalExports() {
		return this.inner.minifyInternalExports ?? false;
	}
};
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "dir", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "entryFileNames", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "chunkFileNames", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "assetFileNames", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "format", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "exports", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "sourcemap", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "sourcemapBaseUrl", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "shimMissingExports", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "name", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "file", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "codeSplitting", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "inlineDynamicImports", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "dynamicImportInCjs", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "externalLiveBindings", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "banner", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "footer", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "postBanner", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "postFooter", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "intro", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "outro", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "esModule", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "extend", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "globals", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "paths", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "hashCharacters", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "sourcemapDebugIds", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "sourcemapExcludeSources", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "sourcemapIgnoreList", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "sourcemapPathTransform", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "minify", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "legalComments", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "comments", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "polyfillRequire", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "plugins", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "preserveModules", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "preserveModulesRoot", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "virtualDirname", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "topLevelVar", null);
__decorate([lazyProp], NormalizedOutputOptionsImpl.prototype, "minifyInternalExports", null);
function normalizeAddon(value) {
	if (typeof value === "function") return value;
	return () => value || "";
}
//#endregion
//#region src/plugin/plugin-context-data.ts
var PluginContextData = class {
	onLog;
	outputOptions;
	normalizedInputPlugins;
	normalizedOutputPlugins;
	moduleOptionMap = /* @__PURE__ */ new Map();
	resolveOptionsMap = /* @__PURE__ */ new Map();
	loadModulePromiseMap = /* @__PURE__ */ new Map();
	renderedChunkMeta = null;
	normalizedInputOptions = null;
	normalizedOutputOptions = null;
	constructor(onLog, outputOptions, normalizedInputPlugins, normalizedOutputPlugins) {
		this.onLog = onLog;
		this.outputOptions = outputOptions;
		this.normalizedInputPlugins = normalizedInputPlugins;
		this.normalizedOutputPlugins = normalizedOutputPlugins;
	}
	updateModuleOption(id, option) {
		const existing = this.moduleOptionMap.get(id);
		if (existing) {
			if (option.moduleSideEffects != null) existing.moduleSideEffects = option.moduleSideEffects;
			if (option.meta != null) Object.assign(existing.meta, option.meta);
			if (option.invalidate != null) existing.invalidate = option.invalidate;
		} else {
			this.moduleOptionMap.set(id, option);
			return option;
		}
		return existing;
	}
	getModuleOption(id) {
		const option = this.moduleOptionMap.get(id);
		if (!option) {
			const raw = {
				moduleSideEffects: null,
				meta: {}
			};
			this.moduleOptionMap.set(id, raw);
			return raw;
		}
		return option;
	}
	getModuleInfo(id, context) {
		const bindingInfo = context.getModuleInfo(id);
		if (bindingInfo) {
			const info = transformModuleInfo(bindingInfo, this.getModuleOption(id));
			return this.proxyModuleInfo(id, info);
		}
		return null;
	}
	proxyModuleInfo(id, info) {
		let moduleSideEffects = info.moduleSideEffects;
		Object.defineProperty(info, "moduleSideEffects", {
			get() {
				return moduleSideEffects;
			},
			set: (v) => {
				this.updateModuleOption(id, {
					moduleSideEffects: v,
					meta: info.meta,
					invalidate: true
				});
				moduleSideEffects = v;
			}
		});
		return info;
	}
	getModuleIds(context) {
		return context.getModuleIds().values();
	}
	saveResolveOptions(options) {
		const index = this.resolveOptionsMap.size;
		this.resolveOptionsMap.set(index, options);
		return index;
	}
	getSavedResolveOptions(receipt) {
		return this.resolveOptionsMap.get(receipt);
	}
	removeSavedResolveOptions(receipt) {
		this.resolveOptionsMap.delete(receipt);
	}
	setRenderChunkMeta(meta) {
		this.renderedChunkMeta = meta;
	}
	getRenderChunkMeta() {
		return this.renderedChunkMeta;
	}
	getInputOptions(opts) {
		this.normalizedInputOptions ??= new NormalizedInputOptionsImpl(opts, this.onLog, this.normalizedInputPlugins);
		return this.normalizedInputOptions;
	}
	getOutputOptions(opts) {
		this.normalizedOutputOptions ??= new NormalizedOutputOptionsImpl(opts, this.outputOptions, this.normalizedOutputPlugins);
		return this.normalizedOutputOptions;
	}
	clear() {
		this.renderedChunkMeta = null;
		this.loadModulePromiseMap.clear();
	}
};
//#endregion
//#region src/utils/normalize-transform-options.ts
/**
* Normalizes transform options by extracting `define`, `inject`, and `dropLabels` separately from OXC transform options.
*
* Prioritizes values from `transform.define`, `transform.inject`, and `transform.dropLabels` over deprecated top-level options.
*/
function normalizeTransformOptions(inputOptions) {
	const transform = inputOptions.transform;
	const define = transform?.define ? Object.entries(transform.define) : void 0;
	const inject = transform?.inject;
	const dropLabels = transform?.dropLabels;
	let oxcTransformOptions;
	if (transform) {
		const { define: _define, inject: _inject, dropLabels: _dropLabels, ...rest } = transform;
		if (Object.keys(rest).length > 0) {
			if (rest.jsx === false) rest.jsx = "disable";
			oxcTransformOptions = rest;
		}
	}
	return {
		define,
		inject,
		dropLabels,
		oxcTransformOptions
	};
}
//#endregion
//#region src/utils/bindingify-input-options.ts
function bindingifyInputOptions(rawPlugins, inputOptions, outputOptions, normalizedInputPlugins, normalizedOutputPlugins, onLog, logLevel, watchMode) {
	const pluginContextData = new PluginContextData(onLog, outputOptions, normalizedInputPlugins, normalizedOutputPlugins);
	const plugins = rawPlugins.map((plugin) => {
		if ("_parallel" in plugin) return;
		if (plugin instanceof BuiltinPlugin) switch (plugin.name) {
			case "builtin:vite-manifest": return bindingifyManifestPlugin(plugin, pluginContextData);
			default: return bindingifyBuiltInPlugin(plugin);
		}
		return bindingifyPlugin(plugin, inputOptions, outputOptions, pluginContextData, normalizedOutputPlugins, onLog, logLevel, watchMode);
	});
	const normalizedTransform = normalizeTransformOptions(inputOptions);
	return {
		input: bindingifyInput(inputOptions.input),
		plugins,
		cwd: inputOptions.cwd ?? process.cwd(),
		external: bindingifyExternal(inputOptions.external),
		resolve: bindingifyResolve(inputOptions.resolve),
		platform: inputOptions.platform,
		shimMissingExports: inputOptions.shimMissingExports,
		logLevel: bindingifyLogLevel(logLevel),
		onLog,
		treeshake: bindingifyTreeshakeOptions(inputOptions.treeshake),
		moduleTypes: inputOptions.moduleTypes,
		define: normalizedTransform.define,
		inject: bindingifyInject(normalizedTransform.inject),
		experimental: bindingifyExperimental(inputOptions.experimental),
		profilerNames: outputOptions.generatedCode?.profilerNames,
		transform: normalizedTransform.oxcTransformOptions,
		watch: bindingifyWatch(inputOptions.watch),
		dropLabels: normalizedTransform.dropLabels,
		keepNames: outputOptions.keepNames,
		checks: inputOptions.checks,
		deferSyncScanData: () => {
			let ret = [];
			pluginContextData.moduleOptionMap.forEach((value, key) => {
				if (value.invalidate) ret.push({
					id: key,
					sideEffects: value.moduleSideEffects ?? void 0
				});
			});
			return ret;
		},
		makeAbsoluteExternalsRelative: bindingifyMakeAbsoluteExternalsRelative(inputOptions.makeAbsoluteExternalsRelative),
		devtools: inputOptions.devtools,
		invalidateJsSideCache: pluginContextData.clear.bind(pluginContextData),
		preserveEntrySignatures: bindingifyPreserveEntrySignatures(inputOptions.preserveEntrySignatures),
		optimization: inputOptions.optimization,
		context: inputOptions.context,
		tsconfig: inputOptions.resolve?.tsconfigFilename ?? inputOptions.tsconfig
	};
}
function bindingifyDevMode(devMode) {
	if (devMode) {
		if (typeof devMode === "boolean") return devMode ? {} : void 0;
		return devMode;
	}
}
function bindingifyAttachDebugInfo(attachDebugInfo) {
	switch (attachDebugInfo) {
		case void 0: return;
		case "full": return BindingAttachDebugInfo.Full;
		case "simple": return BindingAttachDebugInfo.Simple;
		case "none": return BindingAttachDebugInfo.None;
	}
}
function bindingifyExternal(external) {
	if (external) {
		if (typeof external === "function") return (id, importer, isResolved) => {
			if (id.startsWith("\0")) return false;
			return external(id, importer, isResolved) ?? false;
		};
		return arraify(external);
	}
}
function bindingifyExperimental(experimental) {
	let chunkModulesOrder = BindingChunkModuleOrderBy.ExecOrder;
	if (experimental?.chunkModulesOrder) switch (experimental.chunkModulesOrder) {
		case "exec-order":
			chunkModulesOrder = BindingChunkModuleOrderBy.ExecOrder;
			break;
		case "module-id":
			chunkModulesOrder = BindingChunkModuleOrderBy.ModuleId;
			break;
		default: throw new Error(`Unexpected chunkModulesOrder: ${experimental.chunkModulesOrder}`);
	}
	return {
		viteMode: experimental?.viteMode,
		resolveNewUrlToAsset: experimental?.resolveNewUrlToAsset,
		devMode: bindingifyDevMode(experimental?.devMode),
		attachDebugInfo: bindingifyAttachDebugInfo(experimental?.attachDebugInfo),
		chunkModulesOrder,
		chunkImportMap: experimental?.chunkImportMap,
		onDemandWrapping: experimental?.onDemandWrapping,
		incrementalBuild: experimental?.incrementalBuild,
		nativeMagicString: experimental?.nativeMagicString,
		chunkOptimization: experimental?.chunkOptimization,
		lazyBarrel: experimental?.lazyBarrel
	};
}
function bindingifyResolve(resolve) {
	const yarnPnp = typeof process === "object" && !!process.versions?.pnp;
	if (resolve) {
		const { alias, extensionAlias, ...rest } = resolve;
		return {
			alias: alias ? Object.entries(alias).map(([name, replacement]) => ({
				find: name,
				replacements: replacement === false ? [void 0] : arraify(replacement)
			})) : void 0,
			extensionAlias: extensionAlias ? Object.entries(extensionAlias).map(([name, value]) => ({
				target: name,
				replacements: value
			})) : void 0,
			yarnPnp,
			...rest
		};
	} else return { yarnPnp };
}
function bindingifyInject(inject) {
	if (inject) return Object.entries(inject).map(([alias, item]) => {
		if (Array.isArray(item)) {
			if (item[1] === "*") return {
				tagNamespace: true,
				alias,
				from: item[0]
			};
			return {
				tagNamed: true,
				alias,
				from: item[0],
				imported: item[1]
			};
		} else return {
			tagNamed: true,
			imported: "default",
			alias,
			from: item
		};
	});
}
function bindingifyLogLevel(logLevel) {
	switch (logLevel) {
		case "silent": return BindingLogLevel.Silent;
		case "debug": return BindingLogLevel.Debug;
		case "warn": return BindingLogLevel.Warn;
		case "info": return BindingLogLevel.Info;
		default: throw new Error(`Unexpected log level: ${logLevel}`);
	}
}
function bindingifyInput(input) {
	if (input === void 0) return [];
	if (typeof input === "string") return [{ import: input }];
	if (Array.isArray(input)) return input.map((src) => ({ import: src }));
	return Object.entries(input).map(([name, import_path]) => {
		return {
			name,
			import: import_path
		};
	});
}
function bindingifyWatch(watch) {
	if (watch) {
		if (watch.notify) console.warn("The \"watch.notify\" option is deprecated. Please use \"watch.watcher\" instead.");
		const watcher = {
			...watch.notify,
			...watch.watcher
		};
		return {
			buildDelay: watch.buildDelay,
			skipWrite: watch.skipWrite,
			usePolling: watcher.usePolling,
			pollInterval: watcher.pollInterval,
			compareContentsForPolling: watcher.compareContentsForPolling,
			useDebounce: watcher.useDebounce,
			debounceDelay: watcher.debounceDelay,
			debounceTickRate: watcher.debounceTickRate,
			include: normalizedStringOrRegex(watch.include),
			exclude: normalizedStringOrRegex(watch.exclude),
			onInvalidate: (...args) => watch.onInvalidate?.(...args)
		};
	}
}
function bindingifyTreeshakeOptions(config) {
	if (config === false) return;
	if (config === true || config === void 0) return { moduleSideEffects: true };
	let normalizedConfig = {
		moduleSideEffects: true,
		annotations: config.annotations,
		manualPureFunctions: config.manualPureFunctions,
		unknownGlobalSideEffects: config.unknownGlobalSideEffects,
		invalidImportSideEffects: config.invalidImportSideEffects,
		commonjs: config.commonjs
	};
	switch (config.propertyReadSideEffects) {
		case "always":
			normalizedConfig.propertyReadSideEffects = BindingPropertyReadSideEffects.Always;
			break;
		case false:
			normalizedConfig.propertyReadSideEffects = BindingPropertyReadSideEffects.False;
			break;
		default:
	}
	switch (config.propertyWriteSideEffects) {
		case "always":
			normalizedConfig.propertyWriteSideEffects = BindingPropertyWriteSideEffects.Always;
			break;
		case false:
			normalizedConfig.propertyWriteSideEffects = BindingPropertyWriteSideEffects.False;
			break;
		default:
	}
	if (config.moduleSideEffects === void 0) normalizedConfig.moduleSideEffects = true;
	else if (config.moduleSideEffects === "no-external") normalizedConfig.moduleSideEffects = [{
		external: true,
		sideEffects: false
	}, {
		external: false,
		sideEffects: true
	}];
	else normalizedConfig.moduleSideEffects = config.moduleSideEffects;
	return normalizedConfig;
}
function bindingifyMakeAbsoluteExternalsRelative(makeAbsoluteExternalsRelative) {
	if (makeAbsoluteExternalsRelative === "ifRelativeSource") return { type: "IfRelativeSource" };
	if (typeof makeAbsoluteExternalsRelative === "boolean") return {
		type: "Bool",
		field0: makeAbsoluteExternalsRelative
	};
}
function bindingifyPreserveEntrySignatures(preserveEntrySignatures) {
	if (preserveEntrySignatures == void 0) return;
	else if (typeof preserveEntrySignatures === "string") return {
		type: "String",
		field0: preserveEntrySignatures
	};
	else return {
		type: "Bool",
		field0: preserveEntrySignatures
	};
}
//#endregion
//#region src/types/chunking-context.ts
var ChunkingContextImpl = class {
	context;
	constructor(context) {
		this.context = context;
	}
	getModuleInfo(moduleId) {
		const bindingInfo = this.context.getModuleInfo(moduleId);
		if (bindingInfo) return transformModuleInfo(bindingInfo, {
			moduleSideEffects: null,
			meta: {}
		});
		return null;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/consola@3.4.2/node_modules/consola/dist/core.mjs
const LogLevels = {
	silent: Number.NEGATIVE_INFINITY,
	fatal: 0,
	error: 0,
	warn: 1,
	log: 2,
	info: 3,
	success: 3,
	fail: 3,
	ready: 3,
	start: 3,
	box: 3,
	debug: 4,
	trace: 5,
	verbose: Number.POSITIVE_INFINITY
};
const LogTypes = {
	silent: { level: -1 },
	fatal: { level: LogLevels.fatal },
	error: { level: LogLevels.error },
	warn: { level: LogLevels.warn },
	log: { level: LogLevels.log },
	info: { level: LogLevels.info },
	success: { level: LogLevels.success },
	fail: { level: LogLevels.fail },
	ready: { level: LogLevels.info },
	start: { level: LogLevels.info },
	box: { level: LogLevels.info },
	debug: { level: LogLevels.debug },
	trace: { level: LogLevels.trace },
	verbose: { level: LogLevels.verbose }
};
function isPlainObject$1(value) {
	if (value === null || typeof value !== "object") return false;
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) return false;
	if (Symbol.iterator in value) return false;
	if (Symbol.toStringTag in value) return Object.prototype.toString.call(value) === "[object Module]";
	return true;
}
function _defu(baseObject, defaults, namespace = ".", merger) {
	if (!isPlainObject$1(defaults)) return _defu(baseObject, {}, namespace, merger);
	const object = Object.assign({}, defaults);
	for (const key in baseObject) {
		if (key === "__proto__" || key === "constructor") continue;
		const value = baseObject[key];
		if (value === null || value === void 0) continue;
		if (merger && merger(object, key, value, namespace)) continue;
		if (Array.isArray(value) && Array.isArray(object[key])) object[key] = [...value, ...object[key]];
		else if (isPlainObject$1(value) && isPlainObject$1(object[key])) object[key] = _defu(value, object[key], (namespace ? `${namespace}.` : "") + key.toString(), merger);
		else object[key] = value;
	}
	return object;
}
function createDefu(merger) {
	return (...arguments_) => arguments_.reduce((p, c) => _defu(p, c, "", merger), {});
}
const defu = createDefu();
function isPlainObject(obj) {
	return Object.prototype.toString.call(obj) === "[object Object]";
}
function isLogObj(arg) {
	if (!isPlainObject(arg)) return false;
	if (!arg.message && !arg.args) return false;
	if (arg.stack) return false;
	return true;
}
let paused = false;
const queue = [];
var Consola = class Consola {
	options;
	_lastLog;
	_mockFn;
	/**
	* Creates an instance of Consola with specified options or defaults.
	*
	* @param {Partial<ConsolaOptions>} [options={}] - Configuration options for the Consola instance.
	*/
	constructor(options = {}) {
		const types = options.types || LogTypes;
		this.options = defu({
			...options,
			defaults: { ...options.defaults },
			level: _normalizeLogLevel(options.level, types),
			reporters: [...options.reporters || []]
		}, {
			types: LogTypes,
			throttle: 1e3,
			throttleMin: 5,
			formatOptions: {
				date: true,
				colors: false,
				compact: true
			}
		});
		for (const type in types) {
			const defaults = {
				type,
				...this.options.defaults,
				...types[type]
			};
			this[type] = this._wrapLogFn(defaults);
			this[type].raw = this._wrapLogFn(defaults, true);
		}
		if (this.options.mockFn) this.mockTypes();
		this._lastLog = {};
	}
	/**
	* Gets the current log level of the Consola instance.
	*
	* @returns {number} The current log level.
	*/
	get level() {
		return this.options.level;
	}
	/**
	* Sets the minimum log level that will be output by the instance.
	*
	* @param {number} level - The new log level to set.
	*/
	set level(level) {
		this.options.level = _normalizeLogLevel(level, this.options.types, this.options.level);
	}
	/**
	* Displays a prompt to the user and returns the response.
	* Throw an error if `prompt` is not supported by the current configuration.
	*
	* @template T
	* @param {string} message - The message to display in the prompt.
	* @param {T} [opts] - Optional options for the prompt. See {@link PromptOptions}.
	* @returns {promise<T>} A promise that infer with the prompt options. See {@link PromptOptions}.
	*/
	prompt(message, opts) {
		if (!this.options.prompt) throw new Error("prompt is not supported!");
		return this.options.prompt(message, opts);
	}
	/**
	* Creates a new instance of Consola, inheriting options from the current instance, with possible overrides.
	*
	* @param {Partial<ConsolaOptions>} options - Optional overrides for the new instance. See {@link ConsolaOptions}.
	* @returns {ConsolaInstance} A new Consola instance. See {@link ConsolaInstance}.
	*/
	create(options) {
		const instance = new Consola({
			...this.options,
			...options
		});
		if (this._mockFn) instance.mockTypes(this._mockFn);
		return instance;
	}
	/**
	* Creates a new Consola instance with the specified default log object properties.
	*
	* @param {InputLogObject} defaults - Default properties to include in any log from the new instance. See {@link InputLogObject}.
	* @returns {ConsolaInstance} A new Consola instance. See {@link ConsolaInstance}.
	*/
	withDefaults(defaults) {
		return this.create({
			...this.options,
			defaults: {
				...this.options.defaults,
				...defaults
			}
		});
	}
	/**
	* Creates a new Consola instance with a specified tag, which will be included in every log.
	*
	* @param {string} tag - The tag to include in each log of the new instance.
	* @returns {ConsolaInstance} A new Consola instance. See {@link ConsolaInstance}.
	*/
	withTag(tag) {
		return this.withDefaults({ tag: this.options.defaults.tag ? this.options.defaults.tag + ":" + tag : tag });
	}
	/**
	* Adds a custom reporter to the Consola instance.
	* Reporters will be called for each log message, depending on their implementation and log level.
	*
	* @param {ConsolaReporter} reporter - The reporter to add. See {@link ConsolaReporter}.
	* @returns {Consola} The current Consola instance.
	*/
	addReporter(reporter) {
		this.options.reporters.push(reporter);
		return this;
	}
	/**
	* Removes a custom reporter from the Consola instance.
	* If no reporter is specified, all reporters will be removed.
	*
	* @param {ConsolaReporter} reporter - The reporter to remove. See {@link ConsolaReporter}.
	* @returns {Consola} The current Consola instance.
	*/
	removeReporter(reporter) {
		if (reporter) {
			const i = this.options.reporters.indexOf(reporter);
			if (i !== -1) return this.options.reporters.splice(i, 1);
		} else this.options.reporters.splice(0);
		return this;
	}
	/**
	* Replaces all reporters of the Consola instance with the specified array of reporters.
	*
	* @param {ConsolaReporter[]} reporters - The new reporters to set. See {@link ConsolaReporter}.
	* @returns {Consola} The current Consola instance.
	*/
	setReporters(reporters) {
		this.options.reporters = Array.isArray(reporters) ? reporters : [reporters];
		return this;
	}
	wrapAll() {
		this.wrapConsole();
		this.wrapStd();
	}
	restoreAll() {
		this.restoreConsole();
		this.restoreStd();
	}
	/**
	* Overrides console methods with Consola logging methods for consistent logging.
	*/
	wrapConsole() {
		for (const type in this.options.types) {
			if (!console["__" + type]) console["__" + type] = console[type];
			console[type] = this[type].raw;
		}
	}
	/**
	* Restores the original console methods, removing Consola overrides.
	*/
	restoreConsole() {
		for (const type in this.options.types) if (console["__" + type]) {
			console[type] = console["__" + type];
			delete console["__" + type];
		}
	}
	/**
	* Overrides standard output and error streams to redirect them through Consola.
	*/
	wrapStd() {
		this._wrapStream(this.options.stdout, "log");
		this._wrapStream(this.options.stderr, "log");
	}
	_wrapStream(stream, type) {
		if (!stream) return;
		if (!stream.__write) stream.__write = stream.write;
		stream.write = (data) => {
			this[type].raw(String(data).trim());
		};
	}
	/**
	* Restores the original standard output and error streams, removing the Consola redirection.
	*/
	restoreStd() {
		this._restoreStream(this.options.stdout);
		this._restoreStream(this.options.stderr);
	}
	_restoreStream(stream) {
		if (!stream) return;
		if (stream.__write) {
			stream.write = stream.__write;
			delete stream.__write;
		}
	}
	/**
	* Pauses logging, queues incoming logs until resumed.
	*/
	pauseLogs() {
		paused = true;
	}
	/**
	* Resumes logging, processing any queued logs.
	*/
	resumeLogs() {
		paused = false;
		const _queue = queue.splice(0);
		for (const item of _queue) item[0]._logFn(item[1], item[2]);
	}
	/**
	* Replaces logging methods with mocks if a mock function is provided.
	*
	* @param {ConsolaOptions["mockFn"]} mockFn - The function to use for mocking logging methods. See {@link ConsolaOptions["mockFn"]}.
	*/
	mockTypes(mockFn) {
		const _mockFn = mockFn || this.options.mockFn;
		this._mockFn = _mockFn;
		if (typeof _mockFn !== "function") return;
		for (const type in this.options.types) {
			this[type] = _mockFn(type, this.options.types[type]) || this[type];
			this[type].raw = this[type];
		}
	}
	_wrapLogFn(defaults, isRaw) {
		return (...args) => {
			if (paused) {
				queue.push([
					this,
					defaults,
					args,
					isRaw
				]);
				return;
			}
			return this._logFn(defaults, args, isRaw);
		};
	}
	_logFn(defaults, args, isRaw) {
		if ((defaults.level || 0) > this.level) return false;
		const logObj = {
			date: /* @__PURE__ */ new Date(),
			args: [],
			...defaults,
			level: _normalizeLogLevel(defaults.level, this.options.types)
		};
		if (!isRaw && args.length === 1 && isLogObj(args[0])) Object.assign(logObj, args[0]);
		else logObj.args = [...args];
		if (logObj.message) {
			logObj.args.unshift(logObj.message);
			delete logObj.message;
		}
		if (logObj.additional) {
			if (!Array.isArray(logObj.additional)) logObj.additional = logObj.additional.split("\n");
			logObj.args.push("\n" + logObj.additional.join("\n"));
			delete logObj.additional;
		}
		logObj.type = typeof logObj.type === "string" ? logObj.type.toLowerCase() : "log";
		logObj.tag = typeof logObj.tag === "string" ? logObj.tag : "";
		const resolveLog = (newLog = false) => {
			const repeated = (this._lastLog.count || 0) - this.options.throttleMin;
			if (this._lastLog.object && repeated > 0) {
				const args2 = [...this._lastLog.object.args];
				if (repeated > 1) args2.push(`(repeated ${repeated} times)`);
				this._log({
					...this._lastLog.object,
					args: args2
				});
				this._lastLog.count = 1;
			}
			if (newLog) {
				this._lastLog.object = logObj;
				this._log(logObj);
			}
		};
		clearTimeout(this._lastLog.timeout);
		const diffTime = this._lastLog.time && logObj.date ? logObj.date.getTime() - this._lastLog.time.getTime() : 0;
		this._lastLog.time = logObj.date;
		if (diffTime < this.options.throttle) try {
			const serializedLog = JSON.stringify([
				logObj.type,
				logObj.tag,
				logObj.args
			]);
			const isSameLog = this._lastLog.serialized === serializedLog;
			this._lastLog.serialized = serializedLog;
			if (isSameLog) {
				this._lastLog.count = (this._lastLog.count || 0) + 1;
				if (this._lastLog.count > this.options.throttleMin) {
					this._lastLog.timeout = setTimeout(resolveLog, this.options.throttle);
					return;
				}
			}
		} catch {}
		resolveLog(true);
	}
	_log(logObj) {
		for (const reporter of this.options.reporters) reporter.log(logObj, { options: this.options });
	}
};
function _normalizeLogLevel(input, types = {}, defaultLevel = 3) {
	if (input === void 0) return defaultLevel;
	if (typeof input === "number") return input;
	if (types[input] && types[input].level !== void 0) return types[input].level;
	return defaultLevel;
}
Consola.prototype.add = Consola.prototype.addReporter;
Consola.prototype.remove = Consola.prototype.removeReporter;
Consola.prototype.clear = Consola.prototype.removeReporter;
Consola.prototype.withScope = Consola.prototype.withTag;
Consola.prototype.mock = Consola.prototype.mockTypes;
Consola.prototype.pause = Consola.prototype.pauseLogs;
Consola.prototype.resume = Consola.prototype.resumeLogs;
function createConsola$1(options = {}) {
	return new Consola(options);
}
//#endregion
//#region ../../node_modules/.pnpm/consola@3.4.2/node_modules/consola/dist/browser.mjs
var BrowserReporter = class {
	options;
	defaultColor;
	levelColorMap;
	typeColorMap;
	constructor(options) {
		this.options = { ...options };
		this.defaultColor = "#7f8c8d";
		this.levelColorMap = {
			0: "#c0392b",
			1: "#f39c12",
			3: "#00BCD4"
		};
		this.typeColorMap = { success: "#2ecc71" };
	}
	_getLogFn(level) {
		if (level < 1) return console.__error || console.error;
		if (level === 1) return console.__warn || console.warn;
		return console.__log || console.log;
	}
	log(logObj) {
		const consoleLogFn = this._getLogFn(logObj.level);
		const type = logObj.type === "log" ? "" : logObj.type;
		const tag = logObj.tag || "";
		const style = `
      background: ${this.typeColorMap[logObj.type] || this.levelColorMap[logObj.level] || this.defaultColor};
      border-radius: 0.5em;
      color: white;
      font-weight: bold;
      padding: 2px 0.5em;
    `;
		const badge = `%c${[tag, type].filter(Boolean).join(":")}`;
		if (typeof logObj.args[0] === "string") consoleLogFn(`${badge}%c ${logObj.args[0]}`, style, "", ...logObj.args.slice(1));
		else consoleLogFn(badge, style, ...logObj.args);
	}
};
function createConsola(options = {}) {
	return createConsola$1({
		reporters: options.reporters || [new BrowserReporter({})],
		prompt(message, options2 = {}) {
			if (options2.type === "confirm") return Promise.resolve(confirm(message));
			return Promise.resolve(prompt(message));
		},
		...options
	});
}
createConsola();
//#endregion
//#region src/cli/logger.ts
/**
* Console logger
*/
const logger = createConsola({ formatOptions: { date: false } });
//#endregion
//#region src/utils/bindingify-output-options.ts
function bindingifyOutputOptions(outputOptions) {
	const { dir, format, exports, hashCharacters, sourcemap, sourcemapBaseUrl, sourcemapDebugIds, sourcemapExcludeSources, sourcemapIgnoreList, sourcemapPathTransform, name, assetFileNames, entryFileNames, chunkFileNames, banner, footer, postBanner, postFooter, intro, outro, esModule, globals, paths, generatedCode, file, sanitizeFileName, preserveModules, virtualDirname, legalComments, comments, preserveModulesRoot, manualChunks, topLevelVar, cleanDir, strictExecutionOrder } = outputOptions;
	if (legalComments != null) logger.warn("`legalComments` option is deprecated, please use `comments.legal` instead.");
	const { inlineDynamicImports, advancedChunks } = bindingifyCodeSplitting(outputOptions.codeSplitting, outputOptions.inlineDynamicImports, outputOptions.advancedChunks, manualChunks);
	return {
		dir,
		file: file == null ? void 0 : file,
		format: bindingifyFormat(format),
		exports,
		hashCharacters,
		sourcemap: bindingifySourcemap(sourcemap),
		sourcemapBaseUrl,
		sourcemapDebugIds,
		sourcemapExcludeSources,
		sourcemapIgnoreList: sourcemapIgnoreList ?? /node_modules/,
		sourcemapPathTransform,
		banner: bindingifyAddon(banner),
		footer: bindingifyAddon(footer),
		postBanner: bindingifyAddon(postBanner),
		postFooter: bindingifyAddon(postFooter),
		intro: bindingifyAddon(intro),
		outro: bindingifyAddon(outro),
		extend: outputOptions.extend,
		globals,
		paths,
		generatedCode,
		esModule,
		name,
		assetFileNames: bindingifyAssetFilenames(assetFileNames),
		entryFileNames,
		chunkFileNames,
		plugins: [],
		minify: outputOptions.minify,
		externalLiveBindings: outputOptions.externalLiveBindings,
		inlineDynamicImports,
		dynamicImportInCjs: outputOptions.dynamicImportInCjs,
		manualCodeSplitting: advancedChunks,
		polyfillRequire: outputOptions.polyfillRequire,
		sanitizeFileName,
		preserveModules,
		virtualDirname,
		legalComments,
		comments: bindingifyComments(comments),
		preserveModulesRoot,
		topLevelVar,
		minifyInternalExports: outputOptions.minifyInternalExports,
		cleanDir,
		strictExecutionOrder,
		strict: outputOptions.strict
	};
}
function bindingifyAddon(configAddon) {
	if (configAddon == null || configAddon === "") return;
	if (typeof configAddon === "function") return async (chunk) => configAddon(transformRenderedChunk(chunk));
	return configAddon;
}
function bindingifyFormat(format) {
	switch (format) {
		case void 0:
		case "es":
		case "esm":
		case "module": return "es";
		case "cjs":
		case "commonjs": return "cjs";
		case "iife": return "iife";
		case "umd": return "umd";
		default: unimplemented(`output.format: ${format}`);
	}
}
function bindingifySourcemap(sourcemap) {
	switch (sourcemap) {
		case true: return "file";
		case "inline": return "inline";
		case false:
		case void 0: return;
		case "hidden": return "hidden";
		default: throw new Error(`unknown sourcemap: ${sourcemap}`);
	}
}
function bindingifyAssetFilenames(assetFileNames) {
	if (typeof assetFileNames === "function") return (asset) => {
		return assetFileNames({
			name: asset.name,
			names: asset.names,
			originalFileName: asset.originalFileName,
			originalFileNames: asset.originalFileNames,
			source: transformAssetSource(asset.source),
			type: "asset"
		});
	};
	return assetFileNames;
}
function bindingifyComments(comments) {
	if (comments == null) return;
	if (typeof comments === "boolean") return comments;
	return comments;
}
function bindingifyCodeSplitting(codeSplitting, inlineDynamicImportsOption, advancedChunks, manualChunks) {
	let inlineDynamicImports;
	let effectiveChunksOption;
	if (codeSplitting === false) {
		if (inlineDynamicImportsOption != null) logger.warn("`inlineDynamicImports` option is ignored because `codeSplitting: false` is set.");
		if (manualChunks != null) throw new Error("Invalid configuration: \"output.manualChunks\" cannot be used when \"output.codeSplitting\" is set to false.");
		if (advancedChunks != null) logger.warn("`advancedChunks` option is ignored because `codeSplitting` is set to `false`.");
		return {
			inlineDynamicImports: true,
			advancedChunks: void 0
		};
	} else if (codeSplitting === true) {
		if (inlineDynamicImportsOption != null) logger.warn("`inlineDynamicImports` option is ignored because `codeSplitting: true` is set.");
	} else if (codeSplitting == null) {
		if (inlineDynamicImportsOption != null) {
			logger.warn("`inlineDynamicImports` option is deprecated, please use `codeSplitting: false` instead.");
			inlineDynamicImports = inlineDynamicImportsOption;
		}
	} else {
		effectiveChunksOption = codeSplitting;
		if (inlineDynamicImportsOption != null) logger.warn("`inlineDynamicImports` option is ignored because the `codeSplitting` option is specified.");
	}
	if (inlineDynamicImports === true && manualChunks != null) throw new Error("Invalid value \"true\" for option \"output.inlineDynamicImports\" - this option is not supported for \"output.manualChunks\".");
	if (effectiveChunksOption == null) {
		if (advancedChunks != null) {
			logger.warn("`advancedChunks` option is deprecated, please use `codeSplitting` instead.");
			effectiveChunksOption = advancedChunks;
		}
	} else if (advancedChunks != null) logger.warn("`advancedChunks` option is ignored because the `codeSplitting` option is specified.");
	if (manualChunks != null && effectiveChunksOption != null) logger.warn("`manualChunks` option is ignored because the `codeSplitting` option is specified.");
	else if (manualChunks != null) effectiveChunksOption = { groups: [{ name(moduleId, ctx) {
		return manualChunks(moduleId, { getModuleInfo: (id) => ctx.getModuleInfo(id) });
	} }] };
	let advancedChunksResult;
	if (effectiveChunksOption != null) {
		const { groups, ...restOptions } = effectiveChunksOption;
		advancedChunksResult = {
			...restOptions,
			groups: groups?.map((group) => {
				const { name, ...restGroup } = group;
				return {
					...restGroup,
					name: typeof name === "function" ? (id, ctx) => name(id, new ChunkingContextImpl(ctx)) : name
				};
			})
		};
	}
	return {
		inlineDynamicImports,
		advancedChunks: advancedChunksResult
	};
}
//#endregion
//#region src/utils/create-bundler-option.ts
async function createBundlerOptions(inputOptions, outputOptions, watchMode) {
	const inputPlugins = await normalizePluginOption(inputOptions.plugins);
	const outputPlugins = await normalizePluginOption(outputOptions.plugins);
	const logLevel = inputOptions.logLevel || "info";
	const onLog = getLogger(getObjectPlugins(inputPlugins), getOnLog(inputOptions, logLevel), logLevel, watchMode);
	outputOptions = PluginDriver.callOutputOptionsHook([...inputPlugins, ...outputPlugins], outputOptions, onLog, logLevel, watchMode);
	const hookOutputPlugins = await normalizePluginOption(outputOptions.plugins);
	const normalizedInputPlugins = normalizePlugins(inputPlugins, ANONYMOUS_PLUGIN_PREFIX);
	const normalizedOutputPlugins = normalizePlugins(hookOutputPlugins, ANONYMOUS_OUTPUT_PLUGIN_PREFIX);
	let plugins = [...normalizedInputPlugins, ...checkOutputPluginOption(normalizedOutputPlugins, onLog)];
	if (inputOptions.experimental?.strictExecutionOrder !== void 0) console.warn("`experimental.strictExecutionOrder` has been stabilized and moved to `output.strictExecutionOrder`. Please update your configuration.");
	try {
		return {
			bundlerOptions: {
				inputOptions: bindingifyInputOptions(plugins, inputOptions, outputOptions, normalizedInputPlugins, normalizedOutputPlugins, onLog, logLevel, watchMode),
				outputOptions: bindingifyOutputOptions(outputOptions),
				parallelPluginsRegistry: void 0
			},
			inputOptions,
			onLog,
			stopWorkers: void 0
		};
	} catch (e) {
		await void 0;
		throw e;
	}
}
//#endregion
//#region src/api/rolldown/rolldown-build.ts
Symbol.asyncDispose ??= Symbol("Symbol.asyncDispose");
/**
* The bundle object returned by {@linkcode rolldown} function.
*
* @category Programmatic APIs
*/
var RolldownBuild = class RolldownBuild {
	#inputOptions;
	#bundler;
	#stopWorkers;
	/** @internal */
	static asyncRuntimeShutdown = false;
	/** @hidden should not be used directly */
	constructor(inputOptions) {
		this.#inputOptions = inputOptions;
		this.#bundler = new BindingBundler();
	}
	/**
	* Whether the bundle has been closed.
	*
	* If the bundle is closed, calling other methods will throw an error.
	*/
	get closed() {
		return this.#bundler.closed;
	}
	/**
	* Generate bundles in-memory.
	*
	* If you directly want to write bundles to disk, use the {@linkcode write} method instead.
	*
	* @param outputOptions The output options.
	* @returns The generated bundle.
	* @throws {@linkcode BundleError} When an error occurs during the build.
	*/
	async generate(outputOptions = {}) {
		return this.#build(false, outputOptions);
	}
	/**
	* Generate and write bundles to disk.
	*
	* If you want to generate bundles in-memory, use the {@linkcode generate} method instead.
	*
	* @param outputOptions The output options.
	* @returns The generated bundle.
	* @throws {@linkcode BundleError} When an error occurs during the build.
	*/
	async write(outputOptions = {}) {
		return this.#build(true, outputOptions);
	}
	/**
	* Close the bundle and free resources.
	*
	* This method is called automatically when using `using` syntax.
	*
	* @example
	* ```js
	* import { rolldown } from 'rolldown';
	*
	* {
	*   using bundle = await rolldown({ input: 'src/main.js' });
	*   const output = await bundle.generate({ format: 'esm' });
	*   console.log(output);
	*   // bundle.close() is called automatically here
	* }
	* ```
	*/
	async close() {
		await this.#stopWorkers?.();
		await this.#bundler.close();
		shutdownAsyncRuntime();
		RolldownBuild.asyncRuntimeShutdown = true;
		this.#stopWorkers = void 0;
	}
	/** @hidden documented in close method */
	async [Symbol.asyncDispose]() {
		await this.close();
	}
	/**
	* @experimental
	* @hidden not ready for public usage yet
	*/
	get watchFiles() {
		return Promise.resolve(this.#bundler.getWatchFiles());
	}
	async #build(isWrite, outputOptions) {
		validateOption("output", outputOptions);
		await this.#stopWorkers?.();
		const option = await createBundlerOptions(this.#inputOptions, outputOptions, false);
		if (RolldownBuild.asyncRuntimeShutdown) startAsyncRuntime();
		try {
			this.#stopWorkers = option.stopWorkers;
			let output;
			if (isWrite) output = await this.#bundler.write(option.bundlerOptions);
			else output = await this.#bundler.generate(option.bundlerOptions);
			return new RolldownOutputImpl(unwrapBindingResult(output));
		} catch (e) {
			await option.stopWorkers?.();
			throw e;
		}
	}
};
//#endregion
export { validateOption as a, arraify as c, transformToRollupOutput as i, RUNTIME_MODULE_ID as l, createBundlerOptions as n, PluginDriver as o, RolldownMagicString as r, LOG_LEVEL_WARN as s, RolldownBuild as t, VERSION as u };
