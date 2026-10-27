# Browser Voice Setup (Web Speech API)

Gitvox voice commands use the browser-native **Web Speech API** (`SpeechRecognition`, or `webkitSpeechRecognition` in Chromium-based browsers). There is no voice SDK, account, API key, model file, or paid voice service for recognition.

Voice recognition and code understanding stay separate:

1. The browser converts microphone audio into a transcript.
2. `src/services/voiceCommands.ts` normalizes the transcript and matches it to an existing Gitvox action.
3. `src/services/assistantRequest.ts` selects the real route-aware context (PR diff, selected file, line range, or function), and `server/assistantClient.ts` sends a grounded prompt through the existing Phase 2 model bridge.
4. The full answer renders in the focused voice panel.

The Phase 2 model bridge is not involved in recognition. It generates the answer and requires the existing server-side `MODEL_API_KEY`; without it, the panel shows a concise configuration error. The original `/api/explain` hunk-review endpoint is unchanged.

## Requirements

- A browser with `SpeechRecognition` or `webkitSpeechRecognition`
- A microphone
- A secure context: `http://localhost` is treated as secure, but any other host must use HTTPS
- Microphone permission for the site

No environment variable or key is required for speech recognition. An optional language can be set, and generating answers uses the existing `MODEL_API_KEY`:

```bash
VITE_SPEECH_LANGUAGE="en-US"
```

English is the initial language. The voice layer passes the configured BCP-47 tag to the browser, so Hindi/Hinglish can be enabled later (for example `hi-IN`) without redesigning the voice panel or context selection.

## Browser compatibility and limitations

| Browser | Behavior |
| --- | --- |
| Chrome / Edge (desktop) | `webkitSpeechRecognition` is available and is the recommended path |
| Safari | Web Speech recognition availability varies by version and OS; `webkitSpeechRecognition` may be exposed |
| Firefox | Typically does not expose the API; Gitvox shows an unsupported-browser state and keeps the text fallback |
| Other browsers | Depends on the vendor's Web Speech implementation |

Important limitations:

- The Web Speech API is **not guaranteed to be fully offline**. Some browsers send audio to their own speech service, so recognition may depend on a network connection.
- Support, accuracy, and interim results vary by browser and platform.
- Gitvox detects API availability at runtime and never shows a false success state. If voice is unavailable, the text command input and presets remain fully functional.

## Microphone permissions

1. Click the microphone control in the voice panel for the first time.
2. Approve the browser's microphone prompt.
3. If permission was denied, use the site controls (lock icon in the address bar) to allow microphone access, then click the microphone again.

Each listening session captures one question. The microphone stops after a final transcript, which keeps the experience predictable and avoids duplicate execution.

## Supported natural-language commands

The matcher understands multiple phrasings for each action. It normalizes case, punctuation, contractions, and spoken numbers.

### Explain the current pull request

- "Explain this PR to me"
- "Go through this pull request"
- "Describe the current PR"
- "Tell me about this PR"

### Summarize the current pull request

- "Summarize the current PR"
- "Summarize the changes"
- "What changes have been made here?"
- "What changed?"
- "Give me the diff summary"

### Explain the selected file

- "Explain the selected file"
- "Walk me through this file"
- "Describe the current file"
- "Explain this file"

### Explain a line range

- "Explain lines 20 to 35"
- "Go through lines 12 to 18"
- "Explain code from line 5 to line 15"
- "Explain lines twenty to thirty five"
- "Go through lines twelve through eighteen"

Line numbers must be positive and extractable. Reversed ranges are normalized. If numbers are missing or ambiguous, Gitvox asks for clarification instead of guessing.

### Explain the selected function

The existing function explanation is also reachable:

- "What does this function do?"
- "Explain this method"

### Clarification and unsupported requests

- "Explain this" → asks which target: PR, file, or line range.
- "Explain lines" (no numbers) → asks for both line numbers.
- "Tell me a joke" → reports that no Gitvox command matched; nothing executes.
- "The PR" (target only, no action) → asks whether to explain or summarize.

No ambiguous or unsupported transcript is ever executed.

## Testing locally

1. Start Gitvox with `npm run dev`.
2. Open the sample PR or project workspace.
3. Click the floating microphone at the bottom-right, or **Ask Gitvox**.
4. The focused voice panel opens. Its microphone is the primary control.
5. Click the microphone, allow microphone access, and say one of the examples above.
6. The panel shows a listening state, then a short processing state, then the full grounded answer. You do not need to close a status panel to read it.
7. Click the microphone again to ask another question; the panel replaces the previous answer.
8. Use **Use text instead** at the bottom of the panel to test the text fallback.

To test unsupported-browser behavior, use a browser without `SpeechRecognition`/`webkitSpeechRecognition` (for example desktop Firefox). The panel shows a concise unsupported message and opens the text input automatically.

To test permission denial, block microphone access for the site and click the microphone; the panel shows concise recovery guidance and keeps the text fallback available.

To test the answer path without a microphone, type the same command into **Use text instead**. Answers still go through the model bridge; without `MODEL_API_KEY`, the panel reports that the AI model is not configured.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Voice is not available in this browser" | No `SpeechRecognition` / `webkitSpeechRecognition` | Use a supported browser, or type the question in the panel |
| "Microphone access is blocked" | Browser blocked audio | Allow microphone access for the site and retry |
| "I didn't hear anything" | Silence or microphone input problem | Check the input device, click the microphone, and speak clearly |
| "Speech recognition is unavailable right now" | Recognition network/service issue | Check the connection; the API is not guaranteed offline |
| Nothing recognized after one command | Expected: one question per listen | Click the microphone again |
| Wrong language recognized | `VITE_SPEECH_LANGUAGE` mismatch | Set an appropriate BCP-47 language and restart |
| "The AI model is not configured" | Server has no `MODEL_API_KEY` | Configure the existing Phase 2 model key and restart the API server |
| "The explanation took too long" | Model/provider timeout | Retry; check the provider status and server logs |
| Clarification message instead of an answer | Ambiguous target or missing line numbers | Include the target and/or both line numbers, then retry |

## Architecture and files

| Piece | Location |
| --- | --- |
| SpeechRecognition lifecycle, dedupe, error mapping | `src/services/speechRecognition.ts` |
| Transcript normalization and command matching | `src/services/voiceCommands.ts` |
| Route-aware assistant context builder | `src/services/assistantRequest.ts` |
| Grounded prompt, validation, and detailed answer instructions | `server/assistantClient.ts` |
| Assistant API route | `server/index.ts` (`POST /api/assistant/explain`) |
| Shared model transport and Phase 2 hunk endpoint | `server/modelClient.ts`, `src/services/modelService.ts` |
| Voice panel, microphone states, retry, and text fallback | `src/components/voice/VoiceCommandBar.tsx` |
| Safe Markdown answer rendering | `src/components/voice/AssistantMarkdown.tsx`, `src/services/assistantMarkdown.ts` |
| Microphone permission helpers | `src/services/voiceService.ts` |

## Future language support

`createSpeechRecognitionSession()` accepts any BCP-47 language code, and `SPEECH_LANGUAGE_PRESETS` already includes English (US), English (India), and a Hindi (India) placeholder. Adding Hindi/Hinglish recognition later only requires selecting the language (and, if desired, adding Hindi phrase patterns to `voiceCommands.ts`); the microphone lifecycle, panel states, context selection, and model backend do not need to change.