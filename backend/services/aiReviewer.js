const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function aiReview(code, language) {

  const prompt = `
You are a senior software engineer.

Review the following ${language} code and provide:
1. Bugs
2. Security issues
3. Code quality improvements
4. Refactoring suggestions

Code:
${code}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "user", content: prompt }
    ]
  });

  return response.choices[0].message.content;

}

module.exports = aiReview;