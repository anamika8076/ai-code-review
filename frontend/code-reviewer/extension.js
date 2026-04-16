const vscode = require('vscode');
const axios = require('axios');

function activate(context) {
    console.log("EXTENSION ACTIVATED 🚀");

    let disposable = vscode.commands.registerCommand('code-reviewer.reviewCode', async function () {

        const editor = vscode.window.activeTextEditor;

        // ✅ Safety check
        if (!editor || !editor.document) {
            vscode.window.showErrorMessage("No active editor found!");
            return;
        }

        const selection = editor.selection;
        const selectedCode = editor.document.getText(selection);

        console.log("SELECTED CODE:", selectedCode);

        if (!selectedCode) {
            vscode.window.showErrorMessage('Please highlight some code first!');
            return;
        }

        try {
            const response = await axios.post('http://localhost:3000/api/reviews', {
                code: selectedCode,
                language: editor.document.languageId,
                dependencies: []
            });

            const data = response.data;

            const panel = vscode.window.createWebviewPanel(
                'reviewResult',
                'Code Analysis Result',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
        retainContextWhenHidden: true
                }
            );

            // ✅ Normalize safely
            const issues = Array.isArray(data.issues) ? data.issues : [];
            const score = data.score ?? 0;
            const complexity = data.complexityLevel ?? "Unknown";
            const complexityScore = data.complexityScore ?? 0;
            const dependencies = Array.isArray(data.vulnerableDependencies) ? data.vulnerableDependencies : [];
            const audit = Array.isArray(data.auditResults) ? data.auditResults : [];
            const errorMsg = data.error;

            // ❌ Handle backend error
            if (errorMsg) {
                panel.webview.html = `
                    <h1>❌ Error</h1>
                    <p>${errorMsg}</p>
                `;
                return;
            }

            // 🎨 Score color logic
            const scoreColor = score > 7 ? 'green' : score > 4 ? 'orange' : 'red';

            // ✅ Render UI
            panel.webview.html = `
            <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Code Review</title>
    <style>
        body { 
            font-family: Arial; 
            padding: 20px; 
        }
        h1 { color: #007acc; }
        hr { margin: 15px 0; }
    </style>
</head>

<body>
                <h1>🚀 Code Review</h1>

                <h2 style="color:${scoreColor}">
                    Score: ${score}/10
                </h2>

                <p><b>Complexity Level:</b> ${complexity}</p>
                <p><b>Complexity Score:</b> ${complexityScore}</p>

                <hr/>

                <h3>🔍 Issues:</h3>
                ${
                    issues.length > 0
                        ? `<ul>
                            ${issues.map(issue => `
                                <li style="color:${
                                    issue.severity === 'High'
                                        ? 'red'
                                        : issue.severity === 'Medium'
                                        ? 'orange'
                                        : 'gray'
                                }">
                                    (${issue?.severity || "Info"}) ${issue?.message || "No message"}
                                </li>
                            `).join("")}
                        </ul>`
                        : "<p>✅ No issues found</p>"
                }

                <hr/>

                <h3>📦 Dependency Check:</h3>
                ${
                    dependencies.length > 0
                        ? `<ul>
                            ${dependencies.map(dep => `
                                <li>
                                    ${dep.name} → ${dep.latestVersion || dep.issue}
                                </li>
                            `).join("")}
                        </ul>`
                        : "<p>✅ No dependency issues</p>"
                }

                <hr/>

                <h3>🛡️ Audit Results:</h3>
                ${
                    audit.length > 0
                        ? `<ul>
                            ${audit.map(a => `
                                <li style="color:red">
                                    ${a.error || JSON.stringify(a)}
                                </li>
                            `).join("")}
                        </ul>`
                        : "<p>✅ No audit issues</p>"
                }
            `;

        } catch (error) {
            console.error("FULL ERROR:", error.response?.data || error.message);

            vscode.window.showErrorMessage(
                error.response?.data?.error || "Backend failed"
            );
        }
    });

    context.subscriptions.push(disposable);
}

exports.activate = activate;