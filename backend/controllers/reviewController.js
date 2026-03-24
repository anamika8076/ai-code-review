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

    
    res.json({
      staticAnalysis: analysis,
      
    });
  } catch (error) {
    console.error("Review error:", error);
    return res.status(500).json({ error: "Failed to generate code review." });
  }
};
