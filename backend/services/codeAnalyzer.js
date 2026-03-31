const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const axios = require("axios");
const runESLint = require("./eslintAnalyzer");
const runAudit = require("./auditAnalyzer");

async function analyzeCode(code, dependencies = []) {

  // ✅ FIX 1: Safe audit
  let auditResults = [];
  try {
    const result = await runAudit();
    if (Array.isArray(result)) {
      auditResults = result;
    }
  } catch (err) {
    console.log("Audit failed:", err.message);
  }

  const issues = [];

  // ✅ FIX 2: TEMP disable ESLint (DEBUG PURPOSE)
  // 🔥 IMPORTANT: Comment this for now
  /*
  try {
    const eslintIssues = await runESLint(code);
    if (Array.isArray(eslintIssues)) {
      issues.push(...eslintIssues);
    }
  } catch (err) {
    console.log("ESLint failed:", err.message);
  }
  */

  // ✅ FIX 3: Safe parser
  let ast;

  try {
    ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx"]
    });
  } catch (err) {
    console.log("⚠️ Parsing failed, using fallback wrapper...");

    const wrappedCode = `function temp(){\n${code}\n}`;

    try {
      ast = parser.parse(wrappedCode, {
        sourceType: "module",
        plugins: ["jsx"]
      });
    } catch (err2) {
      console.log("❌ Parsing completely failed:", err2.message);

      return {
        issues: [{
          type: "Syntax",
          severity: "High",
          message: "Invalid or incomplete code."
        }],
        complexityScore: 0,
        complexityLevel: "Unknown",
        score: 0,
        vulnerableDependencies: [],
        auditResults: []
      };
    }
  }

  let complexity = 1;
  let consoleCount = 0;

  // ✅ FIX 4: Traversal (add logs)
  traverse(ast, {

    CallExpression(path) {
      const callee = path.node.callee;

      console.log("CALL FOUND:", callee?.name);

      if (callee?.type === "Identifier" && callee.name === "eval") {
        console.log("🔥 DETECTED eval");
        issues.push({
          type: "Security",
          severity: "High",
          message: "Avoid using eval(). It can execute arbitrary code."
        });
      }

      if (
        callee?.type === "Identifier" &&
        (callee.name === "setTimeout" || callee.name === "setInterval")
      ) {
        if (path.node.arguments?.[0]?.type === "StringLiteral") {
          console.log("🔥 DETECTED setTimeout string");
          issues.push({
            type: "Security",
            severity: "High",
            message: "Passing string to setTimeout/setInterval is unsafe."
          });
        }
      }
    },

    MemberExpression(path) {

      if (
        path.node.object?.name === "console" &&
        path.node.property?.name === "log"
      ) {
        console.log("🔥 DETECTED console.log");
        consoleCount++;
      }

      if (path.node.property?.name === "innerHTML") {
        issues.push({
          type: "Security",
          severity: "High",
          message: "Possible XSS via innerHTML."
        });
      }
    },

    VariableDeclaration(path) {
      if (path.node.kind === "var") {
        console.log("🔥 DETECTED var");
        issues.push({
          type: "Best Practice",
          severity: "Medium",
          message: "Use let/const instead of var."
        });
      }
    },

    BinaryExpression(path) {
      if (path.node.operator === "==") {
        console.log("🔥 DETECTED ==");
        issues.push({
          type: "Best Practice",
          severity: "Medium",
          message: "Use === instead of ==."
        });
      }
    },

    StringLiteral(path) {
      const value = path.node.value?.toLowerCase?.();

      if (
        value?.includes("apikey") ||
        value?.includes("password")
      ) {
        console.log("🔥 DETECTED secret");
        issues.push({
          type: "Security",
          severity: "High",
          message: "Possible hardcoded secret detected."
        });
      }
    },

    IfStatement() { complexity++; },
    ForStatement() { complexity++; },
    WhileStatement() { complexity++; },
    SwitchCase() { complexity++; }

  });

  // ✅ console rule
  if (consoleCount > 3) {
    issues.push({
      type: "Code Quality",
      severity: "Low",
      message: "Too many console.log statements."
    });
  }

  console.log("🔥 FINAL ISSUES:", issues);

  // ✅ complexity
  let complexityLevel = "Low";
  if (complexity > 10) complexityLevel = "Medium";
  if (complexity > 20) complexityLevel = "High";

  // ✅ score
  let score = 10;

  issues.forEach(issue => {
    if (issue.severity === "High") score -= 3;
    else if (issue.severity === "Medium") score -= 2;
    else score -= 1;
  });

  if (score < 0) score = 0;

  return {
    issues,
    complexityScore: complexity,
    complexityLevel,
    score,
    vulnerableDependencies: [],
    auditResults
  };
}

module.exports = analyzeCode;