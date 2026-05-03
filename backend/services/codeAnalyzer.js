const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const runESLint = require("./eslintAnalyzer");
const runAudit = require("./auditAnalyzer");

// ✅ Duplicate issue prevention — same message dobara push na ho
function addIssue(issues, issue) {
    const exists = issues.some(
        i => i.message === issue.message && i.type === issue.type
    );
    if (!exists) issues.push(issue);
}

async function analyzeCode(code, dependencies = [], projectPath = "") {


    // ─── Audit ────────────────────────────────────────────────
    // ✅ Backend ka audit user ko nahi dikhana
    const backendPath = __dirname.replace("/services", "");
    const isBackendPath = !projectPath || projectPath.trim() === "" || projectPath.startsWith(backendPath);

    console.log("[Audit Check] projectPath:", projectPath, "backendPath:", backendPath, "isBackendPath:", isBackendPath);
    let auditResults = [];
    if (!isBackendPath) {
        try {
            const result = await runAudit(projectPath);
            if (Array.isArray(result)) {
                auditResults = result;
            }
        } catch (err) {
            console.error("[Analyzer] Audit failed:", err.message);
        }
    }


    const issues = [];

    // ─── ESLint ───────────────────────────────────────────────
    // ✅ ESLint uncomment kiya — debug comment hata diya
    try {
        const eslintIssues = await runESLint(code);
        if (Array.isArray(eslintIssues)) {
            issues.push(...eslintIssues);
        }
    } catch (err) {
        console.error("[Analyzer] ESLint failed:", err.message);
    }

    // ─── Parse ────────────────────────────────────────────────
    let ast;

    try {
        ast = parser.parse(code, {
            sourceType: "module",
            plugins: ["jsx"]
        });
    } catch (err) {
        console.warn("[Analyzer] Parsing failed, trying fallback wrapper...");

        try {
            ast = parser.parse(`function temp(){\n${code}\n}`, {
                sourceType: "module",
                plugins: ["jsx"]
            });
        } catch (err2) {
            console.error("[Analyzer] Parsing completely failed:", err2.message);
            return {
                issues: [{
                    type: "Syntax",
                    severity: "High",
                    message: `Syntax error: ${err2.message}`  // ✅ actual error message dikhao
                }],
                complexityScore: 0,
                complexityLevel: "Unknown",
                score: 0,
                vulnerableDependencies: [],
                auditResults
            };
        }
    }

    // ─── AST Traversal ────────────────────────────────────────
    let complexity = 1;
    let consoleCount = 0;

    traverse(ast, {

        CallExpression(path) {
            const callee = path.node.callee;

            // eval() check — skip if inside setTimeout/setInterval (fixer adds it there)
            if (callee?.type === "Identifier" && callee.name === "eval") {
                const parentCall = path.parentPath?.parentPath?.node;
                const isInsideTimer =
                    parentCall?.type === "CallExpression" &&
                    (parentCall?.callee?.name === "setTimeout" ||
                     parentCall?.callee?.name === "setInterval");

                if (!isInsideTimer) {
                    addIssue(issues, {
                        type: "Security",
                        severity: "High",
                        message: "Avoid using eval() — it can execute arbitrary code."
                    });
                }
            }

            // setTimeout/setInterval string check
            if (
                callee?.type === "Identifier" &&
                (callee.name === "setTimeout" || callee.name === "setInterval") &&
                path.node.arguments?.[0]?.type === "StringLiteral"
            ) {
                addIssue(issues, {
                    type: "Security",
                    severity: "High",
                    message: `Passing a string to ${callee.name}() is unsafe. Use a function instead.`
                });
            }

            // console.log count
            if (
                callee?.type === "MemberExpression" &&
                callee.object?.name === "console"
            ) {
                consoleCount++;
            }
        },

        MemberExpression(path) {
            // innerHTML XSS check
            if (
                path.node.property?.name === "innerHTML" &&
                path.parent?.type === "AssignmentExpression"
            ) {
                addIssue(issues, {
                    type: "Security",
                    severity: "High",
                    message: "Possible XSS via innerHTML assignment. Use textContent or sanitize input."
                });
            }
        },

        VariableDeclaration(path) {
            if (path.node.kind === "var") {
                addIssue(issues, {
                    type: "Best Practice",
                    severity: "Medium",
                    message: "Use let or const instead of var."
                });
            }
        },

        BinaryExpression(path) {
            if (path.node.operator === "==") {
                addIssue(issues, {
                    type: "Best Practice",
                    severity: "Medium",
                    message: "Use === instead of == to avoid type coercion bugs."
                });
            }
            if (path.node.operator === "!=") {
                addIssue(issues, {
                    type: "Best Practice",
                    severity: "Medium",
                    message: "Use !== instead of != to avoid type coercion bugs."
                });
            }
        },

        // ✅ Hardcoded secret — variable name check (more reliable than string value)
        VariableDeclarator(path) {
            const name = path.node.id?.name?.toLowerCase() || "";
            const isSecretName =
                name.includes("password") ||
                name.includes("apikey") ||
                name.includes("secret") ||
                name.includes("token") ||
                name.includes("privatekey");

            if (isSecretName && path.node.init?.type === "StringLiteral") {
                addIssue(issues, {
                    type: "Security",
                    severity: "High",
                    message: `Possible hardcoded secret in variable "${path.node.id.name}". Use environment variables instead.`
                });
            }
        },

        // ✅ Complexity tracking
        IfStatement()     { complexity++; },
        ForStatement()    { complexity++; },
        ForInStatement()  { complexity++; },  // ✅ yeh pehle missing tha
        ForOfStatement()  { complexity++; },  // ✅ yeh pehle missing tha
        WhileStatement()  { complexity++; },
        DoWhileStatement(){ complexity++; },  // ✅ yeh pehle missing tha
        SwitchCase()      { complexity++; },
        CatchClause()     { complexity++; },  // ✅ yeh pehle missing tha
        LogicalExpression(path) {             // ✅ && / || bhi complexity badhate hain
            if (
                path.node.operator === "&&" ||
                path.node.operator === "||"
            ) complexity++;
        }
    });

    // console.log count rule
    if (consoleCount > 3) {
        addIssue(issues, {
            type: "Code Quality",
            severity: "Low",
            message: `Too many console statements (${consoleCount} found). Remove before production.`
        });
    }

    // ─── Complexity Level ─────────────────────────────────────
    let complexityLevel = "Low";
    if (complexity > 10) complexityLevel = "Medium";
    if (complexity > 20) complexityLevel = "High";

    // ─── Score ────────────────────────────────────────────────
    let score = 10;
    issues.forEach(issue => {
        // ✅ ESLint unused-vars warning score affect nahi karegi
        if (issue.message && issue.message.includes("assigned a value but never used")) return;
        if (issue.message && issue.message.includes("defined but never used")) return;
        if (issue.message && issue.message.includes("is defined but never used")) return;
        if (issue.severity === "High")        score -= 3;
        else if (issue.severity === "Medium") score -= 2;
        else                                  score -= 1;
    });
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