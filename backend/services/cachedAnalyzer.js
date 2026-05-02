const crypto = require("crypto");
const analyzeCode = require("./codeAnalyzer");

const MAX_CACHE_SIZE = 100;   // max entries
const TTL_MS = 60 * 1000;     // 1 minute

// ✅ Map insertion order = LRU order (oldest first)
const cache = new Map();

// ✅ Hash function — full code string key nahi, sirf 32-char MD5
function makeKey(code, dependencies, projectPath) {
    const raw = JSON.stringify({ code, dependencies, projectPath });
    return crypto.createHash("md5").update(raw).digest("hex");
}

// ✅ LRU eviction — sabse purana entry delete karo
function evictOldest() {
    const oldestKey = cache.keys().next().value;
    const entry = cache.get(oldestKey);
    clearTimeout(entry.timer);
    cache.delete(oldestKey);
    console.log(`[Cache] Evicted oldest entry. Size: ${cache.size}`);
}

/**
 * Analyze code with caching
 * @param {string} code
 * @param {Array}  dependencies
 * @param {string} projectPath
 */
async function analyzeWithCache(code, dependencies = [], projectPath = "") {

    const key = makeKey(code, dependencies, projectPath);

    // ✅ Cache hit — entry ko fresh karo (LRU refresh)
    if (cache.has(key)) {
        console.log(`[Cache] Hit — key: ${key.slice(0, 8)}...`);

        // LRU refresh: delete aur re-insert taaki order update ho
        const entry = cache.get(key);
        cache.delete(key);
        cache.set(key, entry);

        return entry.result;
    }

    console.log(`[Cache] Miss — running fresh analysis. Size: ${cache.size}`);

    // ✅ Size limit check — pehle jagah banao
    if (cache.size >= MAX_CACHE_SIZE) {
        evictOldest();
    }

    // ✅ Fresh analysis run karo
    const result = await analyzeCode(code, dependencies, projectPath);

    // ✅ TTL timer — auto-delete after 1 min
    const timer = setTimeout(() => {
        cache.delete(key);
        console.log(`[Cache] TTL expired — key: ${key.slice(0, 8)}...`);
    }, TTL_MS);

    // Node.js process exit pe timer ko hang nahi karne dena
    if (timer.unref) timer.unref();

    cache.set(key, { result, timer });

    return result;
}

// ✅ Cache stats — debugging ke liye useful
function getCacheStats() {
    return {
        size: cache.size,
        maxSize: MAX_CACHE_SIZE,
        ttlSeconds: TTL_MS / 1000
    };
}

// ✅ Manual cache clear — testing ya admin endpoint ke liye
function clearCache() {
    for (const entry of cache.values()) {
        clearTimeout(entry.timer);
    }
    cache.clear();
    console.log("[Cache] Cleared manually.");
}

module.exports = analyzeWithCache;
module.exports.getCacheStats = getCacheStats;
module.exports.clearCache = clearCache;