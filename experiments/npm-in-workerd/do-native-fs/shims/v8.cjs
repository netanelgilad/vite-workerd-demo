// node:v8 shim for workerd.
//
// workerd's node:v8 reports getHeapStatistics().heap_size_limit === 0. npm's Arborist sizes
// its PackumentCache as `Math.floor(heap_size_limit * 0.25)` and hands that to lru-cache as
// `maxSize` — with 0 it throws "cannot set sizeCalculation without setting maxSize". Re-export
// the real node:v8 but guarantee a sane non-zero heap_size_limit so the REAL npm install runs.
const v8 = require("node:v8");

const DEFAULT_HEAP_LIMIT = 2 * 1024 * 1024 * 1024; // 2 GiB — only used for cache sizing

function getHeapStatistics() {
  let s = {};
  try { s = (v8.getHeapStatistics && v8.getHeapStatistics()) || {}; } catch {}
  const lim = Number(s.heap_size_limit);
  return { ...s, heap_size_limit: lim && lim > 0 ? lim : DEFAULT_HEAP_LIMIT };
}

module.exports = Object.assign({}, v8, { getHeapStatistics });
module.exports.default = module.exports;
