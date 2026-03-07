const analyzeCode = require("../services/codeAnalyzer");
const aiReview = require("../services/aiReviewer");

exports.reviewCode = async (req, res) => {

  try {

    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        error: "Code and language required"
      });
    }

    const analysis = analyzeCode(code,  dependencies);

    const aiSuggestions = await aiReview(code, language);

    
  res.json({
    staticAnalysis: analysis,
    aiReview: aiSuggestions
  });

  } catch (error) {

    res.status(500).json({
      error: "Server error"
    });

  }

};
