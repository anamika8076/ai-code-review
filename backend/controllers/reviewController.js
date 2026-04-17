const analyzeWithCache = require("../services/cachedAnalyzer");
const fixCodeService = require("../services/fixer");

exports.reviewCode = async (req, res) => {
  try {
    console.log("Request body:", req.body);

    const { code, language, dependencies } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        error: "Code and language required"
      });
    }

    const analysis = await analyzeWithCache(code, dependencies || []);

    console.log("🔥 FINAL RESULT SENT:", analysis);

    // ✅ FIXED RESPONSE
    res.json(analysis);

  } catch (error) {
    console.error("REAL ERROR:", error);

    return res.status(500).json({
      issues: [],
      score: 0,
      complexityLevel: "Unknown",
      error: "Failed to generate code review."
    });
  }
};

exports.fixCode = (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: "Code is required"
      });
    }

    const fixedCode = fixCodeService(code);

    console.log("✅ FIXED CODE:", fixedCode);

    res.json({
      success: true,
      fixedCode
    });

  } catch (error) {
    console.error("FIX ERROR:", error);

    res.status(500).json({
      error: "Failed to fix code"
    });
  }
};