//#region src/utils/misc.ts
function arraify(value) {
	return Array.isArray(value) ? value : [value];
}
function isPromiseLike(value) {
	return value && (typeof value === "object" || typeof value === "function") && typeof value.then === "function";
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
//#region ../../node_modules/.pnpm/@rolldown+pluginutils@1.0.0/node_modules/@rolldown/pluginutils/dist/utils.js
const postfixRE = /[?#].*$/;
function cleanUrl(url) {
	return url.replace(postfixRE, "");
}
function extractQueryWithoutFragment(url) {
	const questionMarkIndex = url.indexOf("?");
	if (questionMarkIndex === -1) return "";
	const fragmentIndex = url.indexOf("#", questionMarkIndex);
	if (fragmentIndex === -1) return url.substring(questionMarkIndex);
	else return url.substring(questionMarkIndex, fragmentIndex);
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
var Not = class {
	kind;
	expr;
	constructor(expr) {
		this.expr = expr;
		this.kind = "not";
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
var ImporterId = class {
	kind;
	pattern;
	params;
	constructor(pattern, params) {
		this.pattern = pattern;
		this.kind = "importerId";
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
var Query = class {
	kind;
	key;
	pattern;
	constructor(key, pattern) {
		this.pattern = pattern;
		this.key = key;
		this.kind = "query";
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
function not(expr) {
	return new Not(expr);
}
function id(pattern, params) {
	return new Id(pattern, params);
}
function importerId(pattern, params) {
	return new ImporterId(pattern, params);
}
function moduleType(pattern) {
	return new ModuleType(pattern);
}
function code(pattern) {
	return new Code(pattern);
}
function query(key, pattern) {
	return new Query(key, pattern);
}
function include(expr) {
	return new Include(expr);
}
function exclude(expr) {
	return new Exclude(expr);
}
/**
* convert a queryObject to FilterExpression like
* ```js
*   and(query(k1, v1), query(k2, v2))
* ```
* @param queryFilterObject The query filter object needs to be matched.
* @returns a `And` FilterExpression
*/
function queries(queryFilter) {
	return and(...Object.entries(queryFilter).map(([key, value]) => {
		return new Query(key, value);
	}));
}
function interpreter(exprs, code, id, moduleType, importerId) {
	let arr = [];
	if (Array.isArray(exprs)) arr = exprs;
	else arr = [exprs];
	return interpreterImpl(arr, code, id, moduleType, importerId);
}
function interpreterImpl(expr, code, id, moduleType, importerId, ctx = {}) {
	let hasInclude = false;
	for (const e of expr) switch (e.kind) {
		case "include":
			hasInclude = true;
			if (exprInterpreter(e.expr, code, id, moduleType, importerId, ctx)) return true;
			break;
		case "exclude":
			if (exprInterpreter(e.expr, code, id, moduleType, importerId, ctx)) return false;
			break;
	}
	return !hasInclude;
}
function exprInterpreter(expr, code, id, moduleType, importerId, ctx = {}) {
	switch (expr.kind) {
		case "and": return expr.args.every((e) => exprInterpreter(e, code, id, moduleType, importerId, ctx));
		case "or": return expr.args.some((e) => exprInterpreter(e, code, id, moduleType, importerId, ctx));
		case "not": return !exprInterpreter(expr.expr, code, id, moduleType, importerId, ctx);
		case "id": {
			if (id === void 0) throw new Error("`id` is required for `id` expression");
			let idToMatch = id;
			if (expr.params.cleanUrl) idToMatch = cleanUrl(idToMatch);
			return typeof expr.pattern === "string" ? idToMatch === expr.pattern : expr.pattern.test(idToMatch);
		}
		case "importerId": {
			if (importerId === void 0) return false;
			let importerIdToMatch = importerId;
			if (expr.params.cleanUrl) importerIdToMatch = cleanUrl(importerIdToMatch);
			return typeof expr.pattern === "string" ? importerIdToMatch === expr.pattern : expr.pattern.test(importerIdToMatch);
		}
		case "moduleType":
			if (moduleType === void 0) throw new Error("`moduleType` is required for `moduleType` expression");
			return moduleType === expr.pattern;
		case "code":
			if (code === void 0) throw new Error("`code` is required for `code` expression");
			return typeof expr.pattern === "string" ? code.includes(expr.pattern) : expr.pattern.test(code);
		case "query": {
			if (id === void 0) throw new Error("`id` is required for `Query` expression");
			if (!ctx.urlSearchParamsCache) {
				let queryString = extractQueryWithoutFragment(id);
				ctx.urlSearchParamsCache = new URLSearchParams(queryString);
			}
			let urlParams = ctx.urlSearchParamsCache;
			if (typeof expr.pattern === "boolean") if (expr.pattern) return urlParams.has(expr.key);
			else return !urlParams.has(expr.key);
			else if (typeof expr.pattern === "string") return urlParams.get(expr.key) === expr.pattern;
			else return expr.pattern.test(urlParams.get(expr.key) ?? "");
		}
		default: throw new Error(`Expression ${JSON.stringify(expr)} is not expected.`);
	}
}
//#endregion
export { noop as _, id as a, unsupported as b, interpreter as c, not as d, or as f, isPromiseLike as g, arraify as h, exprInterpreter as i, interpreterImpl as l, query as m, code as n, importerId as o, queries as p, exclude as r, include as s, and as t, moduleType as u, unimplemented as v, unreachable as y };
