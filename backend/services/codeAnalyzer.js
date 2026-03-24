const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const axios = require("axios");
const runESLint = require("./eslintAnalyzer");
const runAudit = require("./auditAnalyzer");

async function analyzeCode(code, dependencies = []) {
  const auditResults = runAudit();
      if (auditResults[0]?.error) {
  console.log("Skipping audit...");
}
  



  const issues = [];
    const eslintIssues = await runESLint(code);
issues.push(...eslintIssues);

  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx"]
  });

  let complexity = 1;
  let consoleCount = 0;

  traverse(ast, {

    CallExpression(path) {

      const callee = path.node.callee;

      // eval()
      if (callee.type === "Identifier" && callee.name === "eval") {
        issues.push({
          type: "Security",
          severity: "High",
          message: "Avoid using eval(). It can execute arbitrary code."
        });
      }

      // setTimeout/setInterval with string
      if (
        callee.type === "Identifier" &&
        (callee.name === "setTimeout" || callee.name === "setInterval")
      ) {
        if (path.node.arguments[0]?.type === "StringLiteral") {
          issues.push({
            type: "Security",
            severity: "High",
            message: "Passing string to setTimeout/setInterval is unsafe."
          });
        }
      }
    },

    // console.log detection
    MemberExpression(path) {
      if (
        path.node.object.name === "console" &&
        path.node.property.name === "log"
      ) {
        consoleCount++;
      }

      // innerHTML detection
      if (path.node.property.name === "innerHTML") {
        issues.push({
          type: "Security",
          severity: "High",
          message: "Possible XSS via innerHTML."
        });
      }
    },

    // var usage
    VariableDeclaration(path) {
      if (path.node.kind === "var") {
        issues.push({
          type: "Best Practice",
          severity: "Medium",
          message: "Use let/const instead of var."
        });
      }
    },

    // == usage
    BinaryExpression(path) {
      if (path.node.operator === "==") {
        issues.push({
          type: "Best Practice",
          severity: "Medium",
          message: "Use === instead of ==."
        });
      }
    },

    // Hardcoded secrets (basic check)
    StringLiteral(path) {
      if (
        path.node.value.toLowerCase().includes("apikey") ||
        path.node.value.toLowerCase().includes("password")
      ) {
        issues.push({
          type: "Security",
          severity: "High",
          message: "Possible hardcoded secret detected."
        });
      }
    },

    // Complexity checks
    IfStatement() { complexity++; },
    ForStatement() { complexity++; },
    WhileStatement() { complexity++; },
    SwitchCase() { complexity++; }

  });

  // console log rule
  if (consoleCount > 3) {
    issues.push({
      type: "Code Quality",
      severity: "Low",
      message: "Too many console.log statements."
    });
  }

  // Complexity level
  let complexityLevel = "Low";
  if (complexity > 10) complexityLevel = "Medium";
  if (complexity > 20) complexityLevel = "High";

  // 🔥 Score system
  let score = 10;

  issues.forEach(issue => {
    if (issue.severity === "High") score -= 3;
    else if (issue.severity === "Medium") score -= 2;
    else score -= 1;
  });

  if (score < 0) score = 0;

  // Dependency scan (improved)
  const vulnerableDependencies = [];

  for (const dep of dependencies) {
    try {
      const response = await axios.get(
        `https://registry.npmjs.org/${dep}`
      );

      const latestVersion = response.data["dist-tags"].latest;

      vulnerableDependencies.push({
        name: dep,
        latestVersion,
        note: "Check npm audit for vulnerabilities"
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
    score,
    vulnerableDependencies,
    auditResults 
  };
}

module.exports = analyzeCode;