const vscode = require('vscode');
const axios  = require('axios');

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g,"&amp;").replace(/</g,"&lt;")
        .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}

function getBackendUrl() {
    const config = vscode.workspace.getConfiguration('codeReviewer');
    return config.get('backendUrl') || 'http://localhost:3000';
}

function activate(context) {
    let reviewCommand = vscode.commands.registerCommand(
        'code-reviewer.reviewCode',
        async function () {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !editor.document) {
                vscode.window.showErrorMessage("No active editor found!");
                return;
            }
            const currentEditor = editor;
            const currentDoc    = editor.document;
            const currentUri    = editor.document.uri;
            const selection     = editor.selection;
            const selectedCode  = currentDoc.getText(
                selection.isEmpty
                    ? new vscode.Range(currentDoc.positionAt(0), currentDoc.positionAt(currentDoc.getText().length))
                    : selection
            );
            if (!selectedCode || !selectedCode.trim()) {
                vscode.window.showErrorMessage("Select code first!");
                return;
            }
            const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || "";
            const backendUrl  = getBackendUrl();

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: "Analyzing code...", cancellable: false },
                async () => {
                    try {
                        const response = await axios.post(
                            `${backendUrl}/api/reviews`,
                            { code: selectedCode, language: currentDoc.languageId, dependencies: [], projectPath },
                            { timeout: 30000 }
                        );
                        const data            = response.data;
                        const issues          = data.issues || [];
                        const score           = data.score ?? 0;
                        const complexity      = data.complexityLevel ?? "Unknown";
                        const complexityScore = data.complexityScore ?? 0;
                        const dependencies    = data.vulnerableDependencies || [];
                        const audit           = data.auditResults || [];
                        const aiReview        = data.aiReview || "";
                        const scoreColor      = score > 7 ? "#2e7d32" : score > 4 ? "#e65100" : "#c62828";

                        const panel = vscode.window.createWebviewPanel(
                            'reviewResult', 'Code Analysis Result',
                            vscode.ViewColumn.Beside,
                            { enableScripts: true, retainContextWhenHidden: true }
                        );
                        panel.webview.html = buildWebviewHtml({ score, scoreColor, complexity: escapeHtml(complexity), complexityScore, issues, aiReview: escapeHtml(aiReview), dependencies, audit });

                        const msgDisposable = panel.webview.onDidReceiveMessage(async (message) => {
                            console.log("[Extension] Message from webview:", message);
                            if (message.command === "fixCode") {
                                await handleFixCode({ backendUrl, selectedCode, selection, currentEditor, currentUri, panel });
                            }
                        });
                        panel.onDidDispose(() => msgDisposable.dispose());

                    } catch (error) {
                        const msg = error.code === 'ECONNREFUSED' ? `Backend nahi chal raha at ${backendUrl}.`
                            : error.code === 'ETIMEDOUT' ? "Request timeout."
                            : error.response?.data?.error || error.message || "Unknown error";
                        vscode.window.showErrorMessage(`Code Review failed: ${msg}`);
                    }
                }
            );
        }
    );
    context.subscriptions.push(reviewCommand);
}

async function handleFixCode({ backendUrl, selectedCode, selection, currentEditor, currentUri, panel }) {
    try {
        panel.webview.postMessage({ command: "fixStarted" });
        console.log("[Extension] Calling fix API...");

        const res = await axios.post(`${backendUrl}/api/reviews/fix`, { code: selectedCode }, { timeout: 30000 });
        console.log("[Extension] Fix response:", res.status, res.data?.fixCount);

        const fixedCode = res.data?.fixedCode;
        const fixCount  = res.data?.fixCount || 0;

        if (typeof fixedCode !== "string" || fixedCode.trim() === "") {
            throw new Error("Backend ne valid fixedCode nahi bheja.");
        }

        // WorkspaceEdit — most reliable, no focus needed
        const workspaceEdit = new vscode.WorkspaceEdit();
        const doc = await vscode.workspace.openTextDocument(currentUri);
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
        const range = selection.isEmpty ? fullRange : selection;
        workspaceEdit.replace(currentUri, range, fixedCode);
        const success = await vscode.workspace.applyEdit(workspaceEdit);

        if (!success) throw new Error("applyEdit failed — file read-only ho sakti hai.");

        panel.webview.postMessage({ command: "fixDone", fixCount });
        vscode.window.showInformationMessage(`✅ ${fixCount} issues fixed!`);

        // ✅ 1 second baad auto re-review — file ko focus karo pehle
        setTimeout(async () => {
            try {
                const doc = await vscode.workspace.openTextDocument(currentUri);
                await vscode.window.showTextDocument(doc, {
                    viewColumn: currentEditor.viewColumn,
                    preserveFocus: false
                });
                await vscode.commands.executeCommand('code-reviewer.reviewCode');
            } catch(e) {
                console.error("[Extension] Auto re-review failed:", e.message);
            }
        }, 1500);

    } catch (err) {
        console.error("[Extension] Fix error:", err.message);
        panel.webview.postMessage({ command: "fixFailed" });
        const msg = err.code === 'ECONNREFUSED' ? `Backend band hai.`
            : err.code === 'ETIMEDOUT' ? "Fix timeout."
            : err.response?.data?.error || err.message || "Unknown error";
        vscode.window.showErrorMessage(`Fix failed: ${msg}`);
    }
}

function buildWebviewHtml({ score, scoreColor, complexity, complexityScore, issues, aiReview, dependencies, audit }) {
    const issuesHtml = issues.length > 0
        ? `<ul>${issues.map(i => {
            const color = i.severity==='High' ? '#f48771' : i.severity==='Medium' ? '#cca700' : '#888';
            return `<li style="color:${color};margin-bottom:8px;"><b>(${escapeHtml(i.severity)})</b> ${escapeHtml(i.message)}</li>`;
          }).join("")}</ul>`
        : `<p class="ok">&#10003; No issues found</p>`;
    const aiReviewHtml = aiReview ? `<pre class="ai-box">${aiReview}</pre>` : `<p class="warn">&#9888; No AI response</p>`;
    const depsHtml = dependencies.length > 0
        ? `<ul>${dependencies.map(d=>`<li>${escapeHtml(d.name)} &rarr; ${escapeHtml(d.latestVersion||d.issue||"")}</li>`).join("")}</ul>`
        : `<p class="ok">&#10003; No dependency issues</p>`;
    const auditHtml = audit.length > 0
        ? `<ul>${audit.map(a=>{
            const text = a.error ? escapeHtml(a.error) : `${escapeHtml(a.name)} (${escapeHtml(a.severity)})${a.fixAvailable?" &mdash; fix available":""}`;
            return `<li class="audit-item">${text}</li>`;
          }).join("")}</ul>`
        : `<p class="ok">&#10003; No audit issues</p>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-cr2024';">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;background:#1e1e1e;color:#d4d4d4;padding:24px;max-width:820px;margin:0 auto;font-size:14px;line-height:1.6;}
  h1{text-align:center;font-size:20px;color:#fff;margin-bottom:4px;}
  .score{text-align:center;font-size:42px;font-weight:600;margin:8px 0 2px;}
  .meta{text-align:center;color:#888;font-size:13px;margin-bottom:20px;}
  h3{font-size:12px;font-weight:600;color:#9cdcfe;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #333;padding-bottom:6px;margin:20px 0 10px;}
  ul{padding-left:18px;} li{margin-bottom:6px;}
  .ok{color:#4ec9b0;} .warn{color:#cca700;}
  .ai-box{background:#111;border:1px solid #333;padding:14px;border-radius:8px;color:#4ec9b0;white-space:pre-wrap;font-size:13px;font-family:'Courier New',monospace;}
  .audit-item{color:#f48771;}
  #fix-btn{display:block;width:180px;margin:24px auto 8px;padding:11px 0;background:#28a745;color:#fff;border:none;cursor:pointer;border-radius:6px;font-size:14px;font-weight:500;}
  #fix-btn:hover{background:#22863a;} #fix-btn:disabled{opacity:.5;cursor:not-allowed;}
  #fix-status{text-align:center;font-size:12px;color:#888;min-height:18px;}
</style>
</head>
<body>
<h1>&#128269; Code Review</h1>
<div class="score" style="color:${scoreColor}">${score}/10</div>
<p class="meta">Complexity: <b>${complexity}</b> &nbsp;|&nbsp; Score: ${complexityScore}</p>
<h3>Issues</h3>${issuesHtml}
<h3>AI Review</h3>${aiReviewHtml}
<h3>Dependencies</h3>${depsHtml}
<h3>Audit</h3>${auditHtml}
<button id="fix-btn" >&#128295; Fix Issues</button>
<div id="fix-status"></div>
<script nonce="cr2024">
    const vscode=acquireVsCodeApi();
    const btn=document.getElementById('fix-btn');
    const status=document.getElementById('fix-status');

    // NO onclick — addEventListener use karo (CSP safe)
    btn.addEventListener('click', function() {
        btn.disabled=true;
        btn.textContent='Fixing...';
        status.style.color='#888';
        status.textContent='Sending to backend...';
        vscode.postMessage({command:'fixCode'});
    });

    window.addEventListener('message',function(e){
        var m=e.data;
        if(m.command==='fixStarted'){status.style.color='#888';status.textContent='Applying fixes...';}
        if(m.command==='fixDone'){btn.disabled=false;btn.textContent='Fix Issues';status.style.color='#4ec9b0';status.textContent=m.fixCount+' fix(es) applied!';}
        if(m.command==='fixFailed'){btn.disabled=false;btn.textContent='Fix Issues';status.style.color='#f48771';status.textContent='Fix failed. Check notification.';}
    });
</script>
</body>
</html>`;
}

function deactivate() {}
module.exports = { activate, deactivate };
