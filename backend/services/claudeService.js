const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

async function reviewWithAI(code, language = "javascript") {
    if (!process.env.ANTHROPIC_API_KEY) {
        return "ANTHROPIC_API_KEY missing in .env file";
    }

    try {
        const message = await client.messages.create({
            model: "claude-sonnet-4-20250514",
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

        return message.content[0].text;

    } catch (err) {
        console.error("[ClaudeService] Error:", err.message);
        return `AI review unavailable: ${err.message}`;
    }
}

module.exports = reviewWithAI;
