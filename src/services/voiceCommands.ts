/**
 * Interprets a normalized speech transcript into a Gitvox action.
 *
 * This is deliberately separate from recognition (see `speechRecognition.ts`)
 * and from explanation generation (the existing command router and Phase 2
 * model bridge). It supports natural English variations, extracts line numbers
 * written as digits or words, and asks for clarification instead of guessing.
 */

export type VoiceTranscriptOutcome = 'executed' | 'clarification' | 'unsupported';

export type VoiceCommandMatch =
  | { kind: 'explain-pr'; transcript: string; normalized: string }
  | { kind: 'summarize-pr'; transcript: string; normalized: string }
  | { kind: 'explain-file'; transcript: string; normalized: string }
  | { kind: 'explain-function'; transcript: string; normalized: string }
  | { kind: 'explain-range'; startLine: number; endLine: number; transcript: string; normalized: string }
  | { kind: 'check-pr-errors'; transcript: string; normalized: string }
  | { kind: 'check-security'; transcript: string; normalized: string }
  | { kind: 'check-file-errors'; transcript: string; normalized: string }
  | { kind: 'ask-repo'; transcript: string; normalized: string }
  | { kind: 'clarify'; reason: string; message: string; transcript: string; normalized: string }
  | { kind: 'unsupported'; message: string; transcript: string; normalized: string };

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

export const VOICE_COMMAND_EXAMPLES = [
  'Explain the current PR',
  'Summarize the current PR',
  'Explain the selected file',
  'Explain lines 20 to 35',
  'Check this PR for errors',
  'Run a security check',
  'Check this file for errors',
];

export const CLARIFY_MESSAGE =
  'I can explain the current pull request, summarize it, explain the selected file, explain a line range, check for errors, or run a security analysis. For example, "Explain the current PR" or "Check this PR for errors".';

export const UNSUPPORTED_MESSAGE =
  'I did not catch a Gitvox command in that. Try "Explain the current PR", "Summarize the current PR", "Explain the selected file", "Explain lines 20 to 35", "Check this PR for errors", or "Run a security check".';

const LINE_WORD_PATTERN = /\b(line|lines)\b/;
const FUNCTION_PATTERN = /\b(function|method)\b/;
const FILE_PATTERN = /\b(file|files)\b/;
const PR_PATTERN = /\b(pr|pull request|pull requests|pulling|pull)\b/;
const SUMMARIZE_PATTERN =
  /\b(summarize|summarise|summary|what changed|what changes|what has changed|what have changed|changes have been made|what is different|difference|diff)\b/;
const EXPLAIN_VERB_PATTERN =
  /\b(explain|describe|walk|go through|going through|tell me about)\b/;

/* ── New command detection patterns ── */
const ERROR_PATTERN =
  /\b(error|errors|bug|bugs|issue|issues|problem|problems|mistake|mistakes|break|broken|wrong|fault|faults|defect|defects)\b/;
const SECURITY_PATTERN =
  /\b(security|secure|vulnerability|vulnerabilities|vulnerable|threat|threats|harmful|malicious|injection|xss|csrf|exploit|exploits|attack|attacks|unsafe|insecure|hack|hacked|compromised|secret|secrets|hardcoded|credential|credentials|leak|leaks|dangerous)\b/;
const CHECK_VERB_PATTERN =
  /\b(check|scan|analyze|analyse|review|audit|inspect|find|detect|identify|look for|search for|test for|verify|validate|assess|evaluate)\b/;

/** Converts spoken number words ("twenty five", "twenty-five") into digits. */
export function convertNumberWords(input: string): string {
  const tokens = input.split(' ').filter((token) => token.length > 0);
  const output: string[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    const isNumberToken = NUMBER_WORDS[token] !== undefined || token === 'hundred';

    if (!isNumberToken) {
      output.push(token);
      index += 1;
      continue;
    }

    let total = 0;
    let consumed = 0;

    while (index + consumed < tokens.length) {
      const candidate = tokens[index + consumed];
      if (candidate === 'hundred') {
        total = (total || 1) * 100;
        consumed += 1;
      } else if (NUMBER_WORDS[candidate] !== undefined) {
        total += NUMBER_WORDS[candidate];
        consumed += 1;
      } else {
        break;
      }
    }

    output.push(String(total));
    index += consumed;
  }

  return output.join(' ');
}

/** Lowercases, removes punctuation, and converts number words to digits. */
export function normalizeTranscript(transcript: string): string {
  const prepared = transcript
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\bwhats\b/g, 'what is')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return convertNumberWords(prepared);
}

interface RangeExtraction {
  startLine: number;
  endLine: number;
}

type RangeResult =
  | { ok: true; range: RangeExtraction }
  | { ok: false; reason: 'missing-numbers' | 'missing-end' };

function extractLineRange(normalized: string): RangeResult {
  const pairPatterns = [
    /(?:from\s+)?(?:line|lines)\s+(\d+)\s*(?:to|through|until|till|and)\s*(?:line\s+|lines\s+)?(\d+)/,
    /(\d+)\s*(?:to|through|until|till)\s+(\d+)/,
  ];

  for (const pattern of pairPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      if (Number.isInteger(first) && Number.isInteger(second) && first > 0 && second > 0) {
        return first <= second
          ? { ok: true, range: { startLine: first, endLine: second } }
          : { ok: true, range: { startLine: second, endLine: first } };
      }
    }
  }

  const singleMatch = normalized.match(/(?:line|lines)\s+(\d+)/);
  if (singleMatch && Number(singleMatch[1]) > 0) {
    return { ok: false, reason: 'missing-end' };
  }

  return { ok: false, reason: 'missing-numbers' };
}

export function interpretVoiceTranscript(transcript: string): VoiceCommandMatch {
  const normalized = normalizeTranscript(transcript);

  if (!normalized) {
    return {
      kind: 'clarify',
      reason: 'empty',
      message: CLARIFY_MESSAGE,
      transcript,
      normalized,
    };
  }

  // ── Line-range requests (highest specificity when valid numbers are provided) ──
  const lineRange = extractLineRange(normalized);
  if (lineRange.ok) {
    return {
      kind: 'explain-range',
      startLine: lineRange.range.startLine,
      endLine: lineRange.range.endLine,
      transcript,
      normalized,
    };
  }

  // Only ask for line clarification if the user explicitly spoke a line command without numbers
  // (e.g. "Explain lines" or "Explain line 20" with no end), NOT when asking questions or about errors.
  const isExplicitLineCommand =
    !ERROR_PATTERN.test(normalized) &&
    !/\b(which|what|where|why|how|who|is|are|does|do|can|could|has|have)\b/.test(normalized) &&
    /^(?:explain|describe|go through)\s+(?:the\s+)?(?:code\s+)?(?:from\s+)?(?:this\s+)?(?:line|lines)\b/.test(normalized);

  if (isExplicitLineCommand) {
    return {
      kind: 'clarify',
      reason: lineRange.reason,
      message:
        lineRange.reason === 'missing-end'
          ? 'I heard a line but not a full range. Say both lines, for example "Explain lines 20 to 35".'
          : 'I heard a request about lines but could not read the numbers reliably. Say, for example, "Explain lines 20 to 35".',
      transcript,
      normalized,
    };
  }

  // ── Security analysis requests ──
  if (SECURITY_PATTERN.test(normalized)) {
    return { kind: 'check-security', transcript, normalized };
  }

  // ── Error/bug detection in PR (or before pulling/accepting) ──
  if (ERROR_PATTERN.test(normalized) && (PR_PATTERN.test(normalized) || /\b(before|pulling|accepting|merge|merging)\b/.test(normalized))) {
    return { kind: 'check-pr-errors', transcript, normalized };
  }

  // ── Error/bug detection in file ──
  if (ERROR_PATTERN.test(normalized) && FILE_PATTERN.test(normalized)) {
    return { kind: 'check-file-errors', transcript, normalized };
  }

  // ── General error checking (defaults to PR scope) ──
  if (ERROR_PATTERN.test(normalized) && CHECK_VERB_PATTERN.test(normalized)) {
    return { kind: 'check-pr-errors', transcript, normalized };
  }

  // ── Function explanation ──
  if (FUNCTION_PATTERN.test(normalized) && (EXPLAIN_VERB_PATTERN.test(normalized) || /\b(what does|what is|how does)\b/.test(normalized))) {
    return { kind: 'explain-function', transcript, normalized };
  }

  // ── File explanation ──
  if (
    FILE_PATTERN.test(normalized) &&
    (EXPLAIN_VERB_PATTERN.test(normalized) || /\b(selected|current|this|the)\b/.test(normalized))
  ) {
    return { kind: 'explain-file', transcript, normalized };
  }

  // ── PR-specific commands ──
  if (PR_PATTERN.test(normalized)) {
    if (SUMMARIZE_PATTERN.test(normalized)) {
      return { kind: 'summarize-pr', transcript, normalized };
    }
    if (EXPLAIN_VERB_PATTERN.test(normalized)) {
      return { kind: 'explain-pr', transcript, normalized };
    }
    return {
      kind: 'clarify',
      reason: 'pr-without-verb',
      message: 'Did you want me to explain the pull request or summarize it?',
      transcript,
      normalized,
    };
  }

  // ── Bare summarize (no PR mentioned, assume PR) ──
  if (SUMMARIZE_PATTERN.test(normalized)) {
    return { kind: 'summarize-pr', transcript, normalized };
  }

  // ── Freeform repo question / code intelligence: route to AI as ask-repo ──
  const isQuestion = /\b(what|how|why|where|when|who|which|is|are|does|do|can|could|should|would|will|has|have|did)\b/.test(normalized);
  if ((isQuestion || ERROR_PATTERN.test(normalized)) && normalized.split(' ').length >= 3) {
    return { kind: 'ask-repo', transcript, normalized };
  }

  // ── Bare explain verb without target (e.g. "Explain this") ──
  if (EXPLAIN_VERB_PATTERN.test(normalized)) {
    return {
      kind: 'clarify',
      reason: 'missing-target',
      message: CLARIFY_MESSAGE,
      transcript,
      normalized,
    };
  }

  return {
    kind: 'unsupported',
    message: UNSUPPORTED_MESSAGE,
    transcript,
    normalized,
  };
}

/** Canonical text command for the shared Gitvox command router. */
export function voiceCommandToText(match: VoiceCommandMatch): string | null {
  switch (match.kind) {
    case 'explain-pr':
      return 'Explain the current PR.';
    case 'summarize-pr':
      return 'Summarize the current PR.';
    case 'explain-file':
      return 'Explain the selected file.';
    case 'explain-function':
      return 'Explain the selected function.';
    case 'explain-range':
      return `Explain code from line ${match.startLine} to line ${match.endLine}.`;
    case 'check-pr-errors':
      return 'Check this PR for errors.';
    case 'check-security':
      return 'Run a security analysis.';
    case 'check-file-errors':
      return 'Check this file for errors.';
    case 'ask-repo':
      return match.transcript;
    default:
      return null;
  }
}
