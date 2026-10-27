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
];

export const CLARIFY_MESSAGE =
  'I can explain the current pull request, summarize it, explain the selected file, or explain a line range. For example, "Explain the current PR" or "Explain lines 20 to 35".';

export const UNSUPPORTED_MESSAGE =
  'I did not catch a Gitvox command in that. Try "Explain the current PR", "Summarize the current PR", "Explain the selected file", or "Explain lines 20 to 35".';

const LINE_WORD_PATTERN = /\b(line|lines)\b/;
const FUNCTION_PATTERN = /\b(function|method)\b/;
const FILE_PATTERN = /\b(file|files)\b/;
const PR_PATTERN = /\b(pr|pull request|pull requests)\b/;
const SUMMARIZE_PATTERN =
  /\b(summarize|summarise|summary|what changed|what changes|what has changed|what have changed|changes have been made|what is different|difference|diff)\b/;
const EXPLAIN_VERB_PATTERN =
  /\b(explain|describe|walk|go through|going through|tell me about|what does|what is|how does|break down)\b/;

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
    .replace(/[’']/g, '')
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

  if (LINE_WORD_PATTERN.test(normalized)) {
    const range = extractLineRange(normalized);
    if (range.ok) {
      return {
        kind: 'explain-range',
        startLine: range.range.startLine,
        endLine: range.range.endLine,
        transcript,
        normalized,
      };
    }
    return {
      kind: 'clarify',
      reason: range.reason,
      message:
        range.reason === 'missing-end'
          ? 'I heard a line but not a full range. Say both lines, for example "Explain lines 20 to 35".'
          : 'I heard a request about lines but could not read the numbers reliably. Say, for example, "Explain lines 20 to 35".',
      transcript,
      normalized,
    };
  }

  if (FUNCTION_PATTERN.test(normalized) && EXPLAIN_VERB_PATTERN.test(normalized)) {
    return { kind: 'explain-function', transcript, normalized };
  }

  if (
    FILE_PATTERN.test(normalized) &&
    (EXPLAIN_VERB_PATTERN.test(normalized) || /\b(selected|current|this|the)\b/.test(normalized))
  ) {
    return { kind: 'explain-file', transcript, normalized };
  }

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

  if (SUMMARIZE_PATTERN.test(normalized)) {
    return { kind: 'summarize-pr', transcript, normalized };
  }

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
    default:
      return null;
  }
}