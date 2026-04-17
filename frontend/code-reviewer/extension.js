const vscode = require('vscode');
const axios = require('axios');

function activate(context) {
    console.log("EXTENSION ACTIVATED 🚀");

    let reviewCommand = vscode.commands.registerCommand('code-reviewer.reviewCode', async function () {

        const editor = vscode.window.activeTextEditor;

        if (!editor || !editor.document) {
            vscode.window.showErrorMessage("No active editor found!");
            return;
        }

        // ✅ STORE EDITOR (IMPORTANT FIX)
        const currentEditor = editor;

        const selection = editor.selection;
        const selectedCode = editor.document.getText(selection);

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

            const issues = Array.isArray(data.issues) ? data.issues : [];
            const score = data.score ?? 0;
            const complexity = data.complexityLevel ?? "Unknown";
            const complexityScore = data.complexityScore ?? 0;
            const dependencies = Array.isArray(data.vulnerableDependencies) ? data.vulnerableDependencies : [];
            const audit = Array.isArray(data.auditResults) ? data.auditResults : [];
            const errorMsg = data.error;

            if (errorMsg) {
                panel.webview.html = `<h1>❌ Error</h1><p>${errorMsg}</p>`;
                return;
            }

            const scoreColor = score > 7 ? 'green' : score > 4 ? 'orange' : 'red';

            // ================= UI =================
            panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial; padding:20px;">
                
                <h1>🚀 Code Review</h1>

                <h2 style="color:${scoreColor}">
                    Score: ${score}/10
                </h2>

                <p><b>Complexity:</b> ${complexity}</p>
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

                <h3>📦 Dependencies:</h3>
                ${
                    dependencies.length > 0
                        ? `<ul>
                            ${dependencies.map(dep => `
                                <li>${dep.name} → ${dep.latestVersion || dep.issue}</li>
                            `).join("")}
                        </ul>`
                        : "<p>✅ No dependency issues</p>"
                }

                <hr/>

                <h3>🛡️ Audit:</h3>
                ${
                    audit.length > 0
                        ? `<ul>
                            ${audit.map(a => `
                                <li style="color:red">${a.error || JSON.stringify(a)}</li>
                            `).join("")}
                        </ul>`
                        : "<p>✅ No audit issues</p>"
                }

                <hr/>

                <!-- 🔥 FIX BUTTON -->
                <button onclick="fixCode()" 
                    style="padding:10px; background:#28a745; color:white; border:none; cursor:pointer;">
                    🛠️ Fix Issues
                </button>

                <script>
                    const vscode = acquireVsCodeApi();

                    function fixCode() {
                        vscode.postMessage({
                            command: "fixCode"
                        });
                    }
                </script>

            </body>
            </html>
            `;

            // ================= HANDLE FIX =================
            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === "fixCode") {

                    if (!currentEditor) {
                        vscode.window.showErrorMessage("❌ No editor found!");
                        return;
                    }

                    const selection = currentEditor.selection;

                    const selectedCode = currentEditor.document.getText(
                        selection.isEmpty
                            ? new vscode.Range(
                                currentEditor.document.positionAt(0),
                                currentEditor.document.positionAt(currentEditor.document.getText().length)
                            )
                            : selection
                    );

                    try {
                        const res = await axios.post("http://localhost:3000/api/reviews/fix", {
                            code: selectedCode
                        });

                        const fixedCode = res.data.fixedCode;

                        const range = selection.isEmpty
                            ? new vscode.Range(
                                currentEditor.document.positionAt(0),
                                currentEditor.document.positionAt(currentEditor.document.getText().length)
                            )
                            : selection;

                        await currentEditor.edit(editBuilder => {
                            editBuilder.replace(range, fixedCode);
                        });

                        vscode.window.showInformationMessage("✅ Code Fixed!");

                    } catch (err) {
                        console.error("FIX ERROR:", err);
                        vscode.window.showErrorMessage("❌ Fix failed");
                    }
                }
            });

        } catch (error) {
            console.error("ERROR:", error.response?.data || error.message);
            vscode.window.showErrorMessage("Backend failed");
        }
    });

    context.subscriptions.push(reviewCommand);
}

exports.activate = activate;

function deactivate() {}

module.exports = {
    activate,
    deactivate
};