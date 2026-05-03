# CodeWise AI

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

1. Install the extension from VS Code Marketplace
2. Open any code file in VS Code
3. Select code (or press `Cmd+A` to select all)
4. Right click → **"AI Review: Analyze This"**
5. View issues, AI review, and score
6. Click **"Fix Issues"** to auto-fix

## Requirements

No setup required! Backend is hosted on cloud. ☁️

## Extension Settings

- `codeReviewer.backendUrl` — Custom backend URL (optional, default is cloud hosted)
