const { scanSecurity } = require("../services/staticAnalyzer");
const { calculateComplexity } = require("../utils/complexityCalculator");

exports.reviewCode = async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: "code and language are required" });
    }

    // 1️⃣ Static security scan
    const securityIssues = scanSecurity(code);

    // 2️⃣ Complexity calculation
    const complexityScore = calculateComplexity(code);

    // 3️⃣ Basic scoring logic
    const securityScore = 100 - securityIssues.length * 10;
    const qualityScore = 100 - complexityScore;

    res.json({
      qualityScore,
      securityScore,
        securityIssues,
        complexityScore,
        message:"Static analysis completed successfully"
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
