const analyzeWithCache = require("../services/cachedAnalyzer");

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