const analyzeCode = require("./codeAnalyzer");

const cache = new Map();

async function analyzeWithCache(code, dependencies) {

  // ✅ Check cache first
  if (cache.has(code)) {
    console.log("⚡ Cache hit");
    return cache.get(code);
  }

  console.log("🐢 Running fresh analysis");

  // Run actual analysis
  const result = await analyzeCode(code, dependencies);

  // Store in cache
  cache.set(code, result);

  // Optional: auto-delete after 1 min
  setTimeout(() => {
    cache.delete(code);
  }, 60000);

  return result;
}

module.exports = analyzeWithCache;