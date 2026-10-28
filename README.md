# Gitvox

**Your code. Your voice. Your clarity.**

🌐 **Live Demo:** [https://gitvox-dun.vercel.app/](https://gitvox-dun.vercel.app/)

Gitvox is a voice-first AI platform for understanding codebases and reviewing pull requests. It allows developers to explore repositories, inspect line-by-line diffs, identify potential bugs and security threats, and review changes through natural spoken commands and grounded, evidence-based AI explanations.

---

## ✨ Core Capabilities

1. **Wake-Word & Voice-First AI Assistant**:
   - Speak **"Gitvox"** to open the microphone hands-free, then speak your command directly.
   - Anchored by a floating microphone at the bottom-left of the viewport with animated radar/listening states.
   - Driven entirely by the browser-native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) with zero third-party voice SDK dependencies.
   - Conversational, route-aware context routing that passes actual diff hunks, file contents, or line ranges to the AI model.
   - Built-in text fallback drawer available at any time.

2. **Pre-Merge Error & Bug Audit**:
   - Detects logic bugs, type mismatches, unhandled null/undefined references, and race conditions before accepting or pulling a PR.
   - Analyzes breaking changes in API routes, exported interfaces, and contracts.

3. **Security Analysis & Vulnerability Scanning**:
   - Performs automated security checks across repository files and PR diffs.
   - Checks for hardcoded secrets, timing attacks in HMAC/hash verification, injection flaws (SQL, XSS), permissive CORS, and insecure fallback defaults.

4. **Universal Repository Q&A**:
   - Ask any question about any file, line of code, architectural pattern, or PR.
   - Grounded directly in loaded ASTs, LCS diffs, and real file contents without hallucinations.

5. **Cohesive Code-Review Workspace**:
   - Three-panel layout (changed files explorer, central diff viewer, and review findings) aligned with consistent heights and independent scroll areas.
   - Code diff remains the primary focus without awkward responsive wrapping on standard desktop screens (1024px–1440px).
   - Long code lines scroll internally within the diff viewer rather than expanding the page or causing horizontal document blowout.

6. **Pull-Request Review (Sample PR #284)**:
   - Pre-loaded with PR `#284` (*Add token-based authentication middleware* in `acme-platform/api-server`, `+86` additions, `-24` deletions across 5 files).
   - Genuine Longest Common Subsequence (LCS) line-by-line diffs supporting both **Unified** and **Split** views.
   - Severity-labeled review findings with uncertainty disclosures and one-click line jumping.
   - Per-file review tracking with visual toggle indicators.

7. **Local-First Project Explorer**:
   - Upload individual source files (up to 2 MB) or ZIP archives (up to 10 MB text) parsed in-memory.
   - Automatic function extraction, path traversal protection, and exclusion of `node_modules/`, `dist/`, and `.git/`.
   - Zero execution of uploaded code.

---

## 🎙️ Supported Voice Commands

Gitvox includes an intelligent, rule-backed voice command pipeline that normalizes transcripts, expands contractions, parses spoken numbers into digits, and maps natural phrases to deterministic actions.

> **Wake Word:** Say **"Gitvox"** at any time while viewing the application to activate the microphone hands-free!

### 1. Explain the Pull Request
*Gives a comprehensive walkthrough of the active PR's purpose, modified files, architectural impact, and risks.*
- `"Explain this PR"`
- `"Explain the current pull request"`
- `"Walk me through this PR"`
- `"Go through this pull request"`

### 2. Summarize the Pull Request
*Provides a high-level executive summary of key changes and the primary objective.*
- `"Summarize the changes"`
- `"Summarize this PR"`
- `"What changes have been made here?"`
- `"Give me a summary of the current pull request"`

### 3. Pre-Merge Error Detection & Bug Audit
*Audits pull requests for potential bugs, breaking changes, and errors before merging or pulling.*
- `"Check this PR for errors"`
- `"Are there any errors before pulling?"`
- `"Will this PR break anything?"`
- `"Check for bugs in this pull request"`
- `"Find defects in this PR"`

### 4. Security Audit & Vulnerability Checks
*Scans repository files and diffs for harmful code, security risks, timing attacks, or credential leaks.*
- `"Run a security analysis"`
- `"Check this PR for security vulnerabilities"`
- `"Are there any security threats?"`
- `"Check security in this file"`
- `"Scan for malicious code"`
- `"Check for hardcoded secrets"`

### 5. File Bug & Error Inspection
*Deep-dives into a specific file to identify edge-case errors, null checks, and logic flaws.*
- `"Check this file for errors"`
- `"Are there bugs in this file?"`
- `"Find errors in this file"`
- `"Check for issues in the selected file"`

### 6. Explain the Selected File
*Analyzes the currently active file, its responsibilities, dependencies, and internal logic.*
- `"Explain this file"`
- `"Explain the selected file"`
- `"Walk me through this file"`
- `"Summarize this file"`

### 7. Explain a Line Range
*Explains a specific range of code lines step-by-step. Supports digits as well as spoken English number words.*
- `"Explain lines 5 to 27"`
- `"Explain code from line 20 to line 35"`
- `"Go through lines twelve to thirty"`
- `"Explain lines one to fifteen"`

### 8. Explain the Selected Function
*Deep-dives into a specific function's logic, parameters, return types, and edge cases.*
- `"Explain the selected function"`
- `"What does this function do?"`
- `"Explain this function"`

### 9. Navigation and File Selection
*Switches the active workspace viewer to a specific file or component.*
- `"Show the authentication middleware"`
- `"Open tokenService.js"`
- `"Go to auth.js"`

### 10. Universal Repository Q&A
*Ask any natural-language question grounded in the loaded codebase or PR.*
- `"How does the auth token get generated?"`
- `"What dependencies does this project use?"`
- `"Why is crypto used instead of jsonwebtoken?"`
- `"Where is the signing secret stored?"`

### 💡 Ambiguity Handling & Clarifications
- If a request is incomplete (e.g. *"Explain this"* or *"Lines 15"*), Gitvox prompts for clarification instead of guessing or hallucinating.
- If an unsupported query is spoken (e.g. *"Tell me a joke"*), Gitvox politely explains what review commands are available.
- If voice input is unavailable or denied, you can switch seamlessly to the built-in text command input in the chat drawer or workspace panels.

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js 18+ (tested on Node v20/v22)
- npm or pnpm

### 1. Installation

```bash
git clone https://github.com/GIT-vanshika/Gitvox.git
cd Gitvox
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your model credentials in `.env`:
- `MODEL_API_KEY`: OpenRouter API key (kept strictly on the server, never sent to the browser).
- `MODEL_BASE_URL`: Defaults to `https://openrouter.ai/api/v1`.
- `MODEL_NAME`: Defaults to the free model `cohere/north-mini-code:free`.
- `MODEL_MAX_OUTPUT_TOKENS`: Maximum output token length (default: `1400`).
- `VITE_SPEECH_LANGUAGE`: Browser Web Speech API locale (default: `en-US`).

> **Note**: Even without `MODEL_API_KEY`, Gitvox works completely for local-grounded summaries, AST function inspections, and LCS diffing.

### 3. Running the Application

```bash
# Start Vite client + Express API bridge concurrently
npm run dev

# Or build and run production server
npm run build
npm start
```

Open [https://gitvox-dun.vercel.app/](https://gitvox-dun.vercel.app/) in your browser.

---

## 🧪 Testing & Verification

Gitvox maintains a strict, verified test suite covering diff algorithms, command routing, speech parsing, and model request builders:

```bash
# Run unit & integration tests (48 passing tests)
npm test

# Run TypeScript typechecks
npm run lint

# Build client and server bundles
npm run build

# Verify git cleanliness
git diff --check
```

### Testing the Workspace Layout
1. Open [https://gitvox-dun.vercel.app/?route=pr](https://gitvox-dun.vercel.app/?route=pr) to view the PR #284 workspace.
2. Verify that the file list, code diff viewer, and findings panel share matching top/bottom bounds with independent internal scrolling.
3. Toggle between **Unified** and **Split** diff modes.
4. Resize your browser down to tablet (`768px`) and mobile (`375px`) widths to confirm the mobile tab strip (`Files`, `Diff`, `Review`) and bottom-left floating mic behavior.

---

## 🔮 Future Direction: GitHub Extension & Two-Way Voice Conversations

The long-term vision for Gitvox is to bridge the gap between static code reviews and conversational pair-programming:

1. **GitHub Native Extension / App**:
   - Package Gitvox as an official GitHub Extension and GitHub App.
   - Directly embed voice-assisted review into the GitHub Pull Request interface, GitHub CLI (`gh`), and GitHub Codespaces.
   - Developers and open-source maintainers will be able to review PRs directly on github.com without downloading repos or switching context.

2. **Full Two-Way Conversational Voice Interaction**:
   - Transform code review into a true two-way conversation with any repository.
   - You speak to the repo: *"Walk me through the new authentication middleware and tell me if there are any timing attack risks."*
   - The repository speaks back with real-time audio generation and automatically highlights relevant code lines, scrolls to hunks, and drafts inline review comments for you.
   - Hands-free code reviews on desktop, tablet, or mobile — making code understanding faster, more inclusive, and accessible to everyone.
