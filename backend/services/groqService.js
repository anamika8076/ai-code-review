const Groq = require("groq-sdk");

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function reviewWithAI(code, language = "javascript") {
    if (!process.env.GROQ_API_KEY) {
        return "GROQ_API_KEY missing in .env file";
    }

    try {
        const completion = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            max_tokens: 1024,
            messages: [
                {
                    role: "user",
                    content: `You are an expert code reviewer. Review this ${language} code and provide:

1. 🐛 Bugs & Logic Errors
2. 🔒 Security Issues
3. ⚡ Performance Problems
4. ✅ Best Practice Violations
5. 📊 Overall Score: X/10

Be concise and actionable.

Code:
\`\`\`${language}
${code}
\`\`\``
                }
            ]
        });

        return completion.choices[0].message.content;

    } catch (err) {
        console.error("[GroqService] Error:", err.message);
        return `AI review unavailable: ${err.message}`;
    }
}

module.exports = reviewWithAI;
