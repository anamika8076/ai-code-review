const { GoogleGenerativeAI } = require("@google/generative-ai");

// ✅ Proper client initialization
let ai;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing in .env file");
  }
  if (!ai) {
    ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return ai;
}

// ✅ Exponential backoff helper
function getDelay(attempt, baseMs = 1000) {
  // attempt 1 → 1s, attempt 2 → 2s, attempt 3 → 4s
  return baseMs * Math.pow(2, attempt - 1);
}

// ✅ Check if error is retryable
function isRetryable(err) {
  const retryableCodes = [429, 500, 502, 503, 504];
  const status = err?.status || err?.response?.status;
  return retryableCodes.includes(status) || err?.message?.includes("quota");
}

/**
 * Review code using Gemini AI
 * @param {string} code - Code to review
 * @param {string} language - Programming language (default: "javascript")
 * @param {number} maxRetries - Max retry attempts (default: 3)
 * @returns {Promise<string>} - AI review text
 */
async function reviewWithAI(code, language = "javascript", maxRetries = 3) {
  if (!code || !code.trim()) {
    return "No code provided for review.";
  }

  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const prompt = `You are an expert code reviewer. Analyze this ${language} code and provide:

1. 🐛 Bugs & Logic Errors
2. 🔒 Security Issues (XSS, injection, hardcoded secrets, etc.)
3. ⚡ Performance Problems
4. ✅ Best Practice Violations
5. 📊 Overall Score: X/10

Be concise and actionable. For each issue mention the line or pattern.

Code to review:
\`\`\`${language}
${code}
\`\`\``;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      if (!text) {
        throw new Error("Empty response from Gemini");
      }

      return text;

    } catch (err) {
      lastError = err;
      console.error(`[GeminiService] Attempt ${attempt}/${maxRetries} failed:`, err.message);

      // Don't retry on non-retryable errors
      if (!isRetryable(err) && attempt === 1) {
        console.error("[GeminiService] Non-retryable error, stopping.");
        break;
      }

      // Don't wait after last attempt
      if (attempt < maxRetries) {
        const delay = getDelay(attempt);
        console.log(`[GeminiService] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // All retries exhausted
  console.error("[GeminiService] All retries failed:", lastError?.message);
  return `AI review unavailable (${lastError?.message || "unknown error"}). Static analysis results are still shown above.`;
}

module.exports = reviewWithAI;