const Groq = require("groq-sdk");

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function fixWithAI(code, language = "javascript") {
    if (!process.env.GROQ_API_KEY) {
        return code;
    }

    try {
        const completion = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            max_tokens: 2048,
            messages: [
                {
                    role: "system",
                    content: `You are an expert code fixer. 
Fix ALL issues in the code — syntax, logic, security, performance.
Return ONLY the fixed code with no explanation, no markdown, no backticks.
Just raw fixed code.`
                },
                {
                    role: "user",
                    content: `Fix all issues in this ${language} code:

${code}`
                }
            ]
        });

        const fixed = completion.choices[0].message.content.trim();
        
        // ✅ Backticks remove karo agar AI ne daale
        return fixed
            .replace(/^```[\w]*\n?/m, "")
            .replace(/```$/m, "")
            .trim();

    } catch (err) {
        console.error("[AiFixer] Error:", err.message);
        return code; // Original code wapas karo agar fail ho
    }
}

module.exports = fixWithAI;
