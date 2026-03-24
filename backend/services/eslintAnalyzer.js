const { ESLint } = require("eslint");

async function runESLint(code) {
  const eslint = new ESLint({
    overrideConfigFile: true, // ✅ THIS IS THE REAL FIX

    overrideConfig: [
      {
        languageOptions: {
          ecmaVersion: "latest",
          sourceType: "module"
        },
        rules: {
          "no-eval": "error",
          "no-unused-vars": "warn",
          "no-console": "warn"
        }
      }
    ]
  });

  const results = await eslint.lintText(code);

  return results[0].messages.map(msg => ({
    type: "ESLint",
    severity: msg.severity === 2 ? "High" : "Medium",
    message: msg.message,
    line: msg.line
  }));
}

module.exports = runESLint;