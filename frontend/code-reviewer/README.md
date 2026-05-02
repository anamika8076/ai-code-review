# AI Code Reviewer

AI-powered VS Code extension for automated code review and auto-fix.

## Features

- 🔍 **Static Analysis** — Detects bugs, security issues, bad practices
- 🤖 **AI Review** — Powered by Groq LLM for all languages
- 🛠️ **Auto Fix** — One click fixes for JavaScript code
- 📊 **Score** — Code quality score out of 10
- 🛡️ **Security** — Detects eval, XSS, hardcoded secrets
- 📦 **Audit** — npm vulnerability check

## Supported Languages

- **JavaScript** — Full static analysis + AI fix
- **All other languages** (Python, Java, TypeScript, C++) — AI-powered review via Groq

## How to Use

1. Open any code file in VS Code
2. Select code (or press `Cmd+A` to select all)
3. Right click → **"AI Review: Analyze This"**
4. View issues, AI review, and score
5. Click **"Fix Issues"** to auto-fix

## Requirements

Backend server must be running at `http://localhost:3000` or configure custom URL in settings.

## Extension Settings

- `codeReviewer.backendUrl` — Backend server URL (default: `http://localhost:3000`)
