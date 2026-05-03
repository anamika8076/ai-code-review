const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

const SECRET_VAR_NAMES = [
    "password", "apikey", "api_key", "secret",
    "token", "privatekey", "private_key", "accesskey"
];

function isSecretVarName(name) {
    return SECRET_VAR_NAMES.some(s => name.toLowerCase().includes(s));
}

function toEnvKey(name) {
    return name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

function fixCode(code) {
    if (!code || !code.trim()) {
        return { fixedCode: code, fixCount: 0, fixLog: [] };
    }

    let fixCount = 0;
    const fixLog = [];

    let ast;
    try {
        ast = parser.parse(code, { sourceType: "module", plugins: ["jsx"] });
    } catch (err) {
        return {
            fixedCode: code, fixCount: 0,
            fixLog: [`Parse failed: ${err.message} — no fixes applied`]
        };
    }

    // ─── Pass 1: Collect all used identifiers ─────────────────
    const declaredVars = new Map();
    const usedVars     = new Set();

    traverse(ast, {
        VariableDeclarator(path) {
            const name = path.node.id?.name;
            if (name) declaredVars.set(name, path);
        },
        FunctionDeclaration(path) {
            const name = path.node.id?.name;
            if (name) declaredVars.set(name, path);
        },
        Identifier(path) {
            // Declaration ke alawa sab references collect karo
            const isDeclarationId =
                path.parent.type === "VariableDeclarator" &&
                path.parent.id === path.node;
            if (!isDeclarationId) {
                usedVars.add(path.node.name);
            }
        },
        // Function parameters bhi "used" hain
        FunctionDeclaration(path) {
            path.node.params?.forEach(p => {
                if (p.name) usedVars.add(p.name);
            });
        },
        ArrowFunctionExpression(path) {
            path.node.params?.forEach(p => {
                if (p.name) usedVars.add(p.name);
            });
        },
        // Export mein jo hai woh bhi used hai
        ExportDefaultDeclaration(path) {
            if (path.node.declaration?.name) {
                usedVars.add(path.node.declaration.name);
            }
        }
    });

    console.log("[Fixer] Declared:", [...declaredVars.keys()]);
    console.log("[Fixer] Used:", [...usedVars]);
    console.log("[Fixer] Unused:", [...declaredVars.keys()].filter(v => !usedVars.has(v)));

    // ─── Pass 2: All fixes ────────────────────────────────────
    traverse(ast, {

        // ✅ == → ===  and  != → !==
        BinaryExpression(path) {
            if (path.node.operator === "==") {
                path.node.operator = "===";
                fixCount++;
                fixLog.push(`Line ${path.node.loc?.start?.line}: == → ===`);
            }
            if (path.node.operator === "!=") {
                path.node.operator = "!==";
                fixCount++;
                fixLog.push(`Line ${path.node.loc?.start?.line}: != → !==`);
            }
        },

        CallExpression(path) {
            const callee = path.node.callee;

            // ✅ eval() — remove karo
            if (t.isIdentifier(callee, { name: "eval" })) {
                const line = path.node.loc?.start?.line;
                try {
                    path.parentPath.remove();
                    fixCount++;
                    fixLog.push(`Line ${line}: eval() statement removed`);
                } catch(e) {
                    fixLog.push(`Line ${line}: eval() detected — manual review needed`);
                }
                return;
            }

            // ✅ setTimeout/setInterval string → empty arrow function
            if (
                t.isIdentifier(callee, { name: "setTimeout" }) ||
                t.isIdentifier(callee, { name: "setInterval" })
            ) {
                const firstArg = path.node.arguments[0];
                if (firstArg && t.isStringLiteral(firstArg)) {
                    path.node.arguments[0] = t.arrowFunctionExpression(
                        [], t.blockStatement([])
                    );
                    fixCount++;
                    fixLog.push(`Line ${path.node.loc?.start?.line}: ${callee.name}(string) → ${callee.name}(() => {})`);
                }
            }

            // ✅ console.log/warn/info remove
            if (
                t.isMemberExpression(callee) &&
                t.isIdentifier(callee.object, { name: "console" }) &&
                ["log", "warn", "info"].includes(callee.property?.name) &&
                path.parent?.type === "ExpressionStatement"
            ) {
                const line = path.node.loc?.start?.line;
                path.parentPath.remove();
                fixCount++;
                fixLog.push(`Line ${line}: console.${callee.property.name}() removed`);
            }
        },

        // ✅ var → let
        VariableDeclaration(path) {
            if (path.node.kind === "var") {
                path.node.kind = "let";
                fixCount++;
                fixLog.push(`Line ${path.node.loc?.start?.line}: var → let`);
            }
        },


        // ✅ Unused variable remove karo — secret ho ya na ho
        VariableDeclarator(path) {
            const varName = path.node.id?.name;
            if (!varName) return;

            // ✅ Pehle unused check — agar unused hai toh remove karo
            if (!usedVars.has(varName)) {
                const line = path.node.loc?.start?.line;
                try {
                    const declaration = path.parentPath;
                    if (declaration.node.declarations.length === 1) {
                        declaration.remove();
                    } else {
                        path.remove();
                    }
                    fixCount++;
                    fixLog.push(`Line ${line}: unused variable "${varName}" removed`);
                } catch(e) {
                    fixLog.push(`Line ${line}: unused "${varName}" — manual review needed`);
                }
                return;
            }

            // ✅ Used secret variable → process.env
            if (isSecretVarName(varName) && t.isStringLiteral(path.node.init)) {
                const envKey = toEnvKey(varName);
                path.node.init = t.memberExpression(
                    t.memberExpression(t.identifier("process"), t.identifier("env")),
                    t.identifier(envKey)
                );
                fixCount++;
                fixLog.push(`Line ${path.node.loc?.start?.line}: "${varName}" → process.env.${envKey}`);
            }
        },

        // ✅ Object property mein hardcoded password fix
        ObjectProperty(path) {
            const keyName = path.node.key?.name || path.node.key?.value || "";
            if (
                isSecretVarName(keyName) &&
                t.isStringLiteral(path.node.value)
            ) {
                const envKey = toEnvKey(keyName);
                path.node.value = t.memberExpression(
                    t.memberExpression(t.identifier("process"), t.identifier("env")),
                    t.identifier(envKey)
                );
                fixCount++;
                fixLog.push(`Line ${path.node.loc?.start?.line}: object property "${keyName}" → process.env.${envKey}`);
            }
        },

        // ✅ innerHTML → textContent
        AssignmentExpression(path) {
            if (
                t.isMemberExpression(path.node.left) &&
                path.node.left.property?.name === "innerHTML"
            ) {
                path.node.left.property.name = "textContent";
                fixCount++;
                fixLog.push(`Line ${path.node.loc?.start?.line}: .innerHTML → .textContent`);
            }
        }
    });

    return {
        fixedCode: generate(ast, { retainLines: false }).code,
        fixCount,
        fixLog
    };
}

module.exports = fixCode;
