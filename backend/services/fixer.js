const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");

function fixCode(code) {
    const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["jsx"]
    });

    traverse(ast, {

        // ✅ Fix == and !=
        BinaryExpression(path) {
            if (path.node.operator === "==") {
                path.node.operator = "===";
            }
            if (path.node.operator === "!=") {
                path.node.operator = "!==";
            }
        },

        // ✅ Fix function calls
        CallExpression(path) {
            const callee = path.node.callee;

            // 🚨 eval fix
            if (callee.name === "eval") {
                const arg = path.node.arguments[0];
                if (t.isStringLiteral(arg)) {
                    path.replaceWith(t.identifier(arg.value));
                }
            }

            // 🚨 setTimeout("string") fix
            if (
                callee.name === "setTimeout" &&
                t.isStringLiteral(path.node.arguments[0])
            ) {
                const codeStr = path.node.arguments[0].value;

                path.node.arguments[0] = t.arrowFunctionExpression(
                    [],
                    t.blockStatement([
                        t.expressionStatement(
                            t.identifier(codeStr)
                        )
                    ])
                );
            }

            // 🧹 remove console.log
            if (
                callee.object &&
                callee.object.name === "console"
            ) {
                path.remove();
            }
        },

        // ✅ var → let
        VariableDeclaration(path) {
            if (path.node.kind === "var") {
                path.node.kind = "let";
            }
        },

        // 🔐 hardcoded password fix
        VariableDeclarator(path) {
            if (
                path.node.id.name &&
                path.node.id.name.toLowerCase().includes("password") &&
                t.isStringLiteral(path.node.init)
            ) {
                path.node.init = t.identifier("process.env.PASSWORD");
            }
        },

        // 🚨 innerHTML → textContent
        AssignmentExpression(path) {
            if (
                path.node.left.property &&
                path.node.left.property.name === "innerHTML"
            ) {
                path.node.left.property.name = "textContent";
            }
        }

    });

    return generate(ast).code;
}

module.exports = fixCode;