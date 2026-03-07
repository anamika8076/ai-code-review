const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const axios = require("axios");

async function analyzeCode(code, dependencies = []) {

  const issues = [];

  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx"]
  });

  let complexity = 1;
  let consoleCount = 0;

  traverse(ast, {

    // Detect eval()
    CallExpression(path) {

      const callee = path.node.callee.name;

      if (callee === "eval") {
        issues.push({
          type: "Security",
          message: "Avoid using eval(). It can execute arbitrary code."
        });
      }

      if (callee === "setTimeout" || callee === "setInterval") {
        if (path.node.arguments[0]?.type === "StringLiteral") {
          issues.push({
            type: "Security",
            message: "Passing string to setTimeout/setInterval is unsafe."
          });
        }
      }

    },

    // console detection
    MemberExpression(path) {
      if (path.node.object.name === "console") {
        consoleCount++;
      }
    },

    // Complexity checks
    IfStatement() {
      complexity++;
    },

    ForStatement() {
      complexity++;
    },

    WhileStatement() {
      complexity++;
    },

    SwitchCase() {
      complexity++;
    }

  });

  if (consoleCount > 5) {
    issues.push({
      type: "Code Quality",
      message: "Too many console logs. Remove them in production."
    });
  }

  // Complexity rating
  let complexityLevel = "Low";

  if (complexity > 10) complexityLevel = "Medium";
  if (complexity > 20) complexityLevel = "High";

  // Dependency vulnerability scan
  const vulnerableDependencies = [];

  for (const dep of dependencies) {

    try {

      const response = await axios.get(
        `https://registry.npmjs.org/${dep}`
      );

      const latestVersion = response.data["dist-tags"].latest;

      vulnerableDependencies.push({
        name: dep,
        latestVersion
      });

    } catch (error) {

      vulnerableDependencies.push({
        name: dep,
        issue: "Unable to check dependency"
      });

    }

  }

  return {
    issues,
    complexityScore: complexity,
    complexityLevel,
    vulnerableDependencies
  };
}

module.exports = analyzeCode;