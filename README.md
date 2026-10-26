# Gitvox

**Your code. Your voice. Your clarity.**

Gitvox is a voice-first AI code-understanding and pull-request review platform. It enables developers to upload source code or ZIP archives, explore unfamiliar repositories, inspect individual files and functions, and review pull requests through grounded explanations and conversational commands.

---

## Core Capabilities

1. **Project Understanding Workspace**:
   - Upload individual text-based source files (up to 2 MB) or multi-file ZIP archives (up to 10 MB decompressed text) directly into browser memory.
   - Automatic exclusion of `node_modules/`, `dist/`, `build/`, `.git/`, and path traversal (`../`) protection.
   - Zero execution of uploaded code.
   - Searchable file tree, syntax-highlighted source viewer with line numbers, and automatic function extraction with one-click function explanations.
2. **Pull-Request Review Workspace (Sample PR #284)**:
   - Built-in sample Pull Request `#284` (`Add token-based authentication middleware` in `acme-platform/api-server` by Maya Chen, `feature/token-auth` → `main`, 5 files changed, `+86` additions, `-24` deletions).
   - Genuine Longest Common Subsequence (LCS) line-by-line diffs supporting both **Unified** and **Split** diff views.
   - Interactive diff hunk explanations, severity-labeled review findings with uncertainty disclosures, and dynamic per-file review progress tracking.
3. **Alan AI Voice & Deterministic Command Router**:
   - Shared deterministic command router supporting natural developer intents via Alan AI voice recognition (when configured) or text command fallback:
     - `"Explain this project."`
     - `"Summarize this file."`
     - `"Explain the selected function."`
     - `"Show the authentication middleware."`
     - `"Explain this pull request."`
     - `"Summarize the changes."`
     - `"Check these changes for potential bugs."`

---

## Installation & Execution

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests (diff math, file/ZIP parser, path validation, command router)
npx --yes tsx --test src/services/gitvoxLogic.test.ts

# 3. Start the development server on port 3000
npm run dev

# 4. Build for production
npm run build
```

---

## Optional Environment Configuration

Copy `.env.example` to `.env` if configuring external integrations:

- `VITE_ALAN_SDK_KEY`: Optional Alan AI project key for live browser voice streaming. When omitted, Gitvox honestly labels live Alan AI voice recognition as unavailable and keeps the text-based command router and microphone permission checker fully functional.
- `GEMINI_API_KEY`: Optional server-side model API key. The built-in sample project and local grounded analysis work end-to-end without external API credentials.
