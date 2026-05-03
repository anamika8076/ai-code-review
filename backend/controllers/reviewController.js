const analyzeWithCache = require("../services/cachedAnalyzer");
const fixCodeService   = require("../services/fixer");
const reviewWithAI     = require("../services/groqService");

// ─── Review ───────────────────────────────────────────────────

exports.reviewCode = async (req, res) => {
  try {
    const { code, language, dependencies, projectPath } = req.body; // ✅ projectPath add

    if (!code || !language) {
      return res.status(400).json({ error: "Code and language required" });
    }

    console.log(`[Controller] Review request — lang: ${language}, size: ${code.length} chars`);

    // 🔍 Static analysis
    const staticAnalysis = await analyzeWithCache(code, dependencies || [], projectPath || "");

    // 🤖 AI analysis
    let aiReview = "";
    try {
      aiReview = await reviewWithAI(code, language); // ✅ language pass karo
    } catch (err) {
      console.error("[Controller] AI failed:", err.message);
      aiReview = `AI review unavailable: ${err.message}`;
    }

    res.json({ ...staticAnalysis, aiReview });

  } catch (error) {
    console.error("[Controller] Review error:", error.message, error.stack);
    res.status(500).json({
      issues: [],
      score: 0,
      complexityLevel: "Unknown",
      error: "Failed to generate code review: " + error.message
    });
  }
};

// ─── Fix ──────────────────────────────────────────────────────

exports.fixCode = async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    console.log(`[Controller] Fix request — code size: ${code.length} chars`);

    // ✅ Loop mein fix karo jab tak koi fix na bache
    let currentCode = code;
    let totalFixCount = 0;
    let allFixLogs = [];
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
        const result = fixCodeService(currentCode);
        totalFixCount += result.fixCount;
        allFixLogs.push(...(result.fixLog || []));
        currentCode = result.fixedCode;
        iterations++;

        console.log(`[Controller] Iteration ${iterations} — ${result.fixCount} fixes`);

        if (result.fixCount === 0) break;
    }

    // ✅ AI fix — final pass
    const fixWithAI = require("../services/aiFixer");
    let aiFixedCode = await fixWithAI(currentCode, language || "javascript");
    console.log(`[Controller] AI fix done`);

    // ✅ AI fix ke baad bhi rule-based loop chalao
    let postAiIterations = 0;
    while (postAiIterations < MAX_ITERATIONS) {
        const postResult = fixCodeService(aiFixedCode);
        if (postResult.fixCount === 0) break;
        totalFixCount += postResult.fixCount;
        allFixLogs.push(...(postResult.fixLog || []));
        aiFixedCode = postResult.fixedCode;
        postAiIterations++;
        console.log(`[Controller] Post-AI iteration ${postAiIterations} — ${postResult.fixCount} fixes`);
    }

    console.log(`[Controller] All done — total fixes: ${totalFixCount}`);

    res.json({
      fixedCode: aiFixedCode,
      fixCount:  totalFixCount,
      fixLog:    allFixLogs
    });

  } catch (error) {
    console.error("[Controller] Fix error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to fix code: " + error.message });
  }
};