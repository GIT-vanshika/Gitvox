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
3. **Voice-First AI Assistant**:
   - One prominent microphone control opens a focused voice panel with the answer already in view. No command log or status panel needs to be dismissed.
   - The browser-native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) converts speech to text. Gitvox then selects the current route-aware context and sends it through the existing Phase 2 model bridge for a detailed, grounded answer. No voice SDK, account, or paid voice service is required; generating answers requires the existing `MODEL_API_KEY`.
   - Natural-language requests map to the existing actions:
     - Explain the current pull request (`explainPR`) — e.g. "Explain this PR to me", "Go through this pull request"
     - Summarize the current pull request (`summarizePR`) — e.g. "Summarize the changes", "What changes have been made here?"
     - Explain the selected file (`explainFile`) — e.g. "Walk me through this file"
     - Explain a line range (`explainCodeRange`) — e.g. "Explain lines 20 to 35", "Go through lines 12 to 18"
     - Explain the selected function — e.g. "What does this function do?"
   - Ambiguous requests ask for clarification instead of guessing. The voice panel includes a discreet "Use text instead" input as a fallback and shows clear idle, listening, processing, clarification, success, and error states.
   - Browser support, microphone permissions, and troubleshooting: `docs/voice-setup.md`.

---

## Installation & Execution

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests (diff math, file/ZIP parser, path validation, command router, voice matching, assistant context, model bridge)
npm test

# 3. Start the development server on port 3000
npm run dev

# 4. Build for production
npm run build
```

---

## Environment Configuration

Copy `.env.example` to `.env` and configure the existing model bridge:

- `MODEL_API_KEY`: Server-side OpenRouter key used by `/api/explain` and `/api/assistant/explain`. It is not exposed to the browser.
- `MODEL_BASE_URL`: OpenAI-compatible endpoint. Defaults to `https://openrouter.ai/api/v1`.
- `MODEL_NAME`: Configured model ID. The example uses the free `cohere/north-mini-code:free`.
- `MODEL_MAX_OUTPUT_TOKENS`: Output limit; `1400` allows detailed assistant answers.
- `VITE_SPEECH_LANGUAGE`: Optional recognition language for the browser Web Speech API. Defaults to `en-US`. The voice layer accepts any BCP-47 tag, so Hindi/Hinglish (for example `hi-IN`) can be enabled later without redesigning the UI.
