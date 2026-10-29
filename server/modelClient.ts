import type {
  ModelExplainRequest,
  ModelExplanation,
  ModelStatus,
} from '../src/types/gitvox';

/**
 * Server-only integration with an OpenAI-compatible chat-completions endpoint.
 *
 * The default provider is OpenRouter and the default model is
 * Cohere North Mini Code (free tier: cohere/north-mini-code:free).
 * Credentials are read exclusively from the server process environment and are
 * never returned to, or accepted from, the browser.
 */

export const DEFAULT_MODEL_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_MODEL_NAME = 'cohere/north-mini-code:free';

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-lite';

export const GEMINI_MODEL_CASCADE = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

const MAX_FILE_CONTEXT_CHARS = 12_000;
const MAX_HUNK_LINES = 400;
const MAX_LINE_CHARS = 2_000;
const MAX_TITLE_CHARS = 500;
const MAX_TEXT_FIELD_CHARS = 4_000;
const MAX_CONTENT_INPUT_CHARS = 200_000;

export class ModelError extends Error {
  code: string;
  httpStatus: number;
  retryable: boolean;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    retryable: boolean
  ) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
  }
}

export interface ModelConfig {
  apiKey: string | null;
  baseUrl: string;
  model: string;
  providerLabel: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[\s_\-.]+/g, '');
}

function readEnv(name: string): string | undefined {
  const direct = process.env[name];
  if (direct && direct.trim().length > 0) return direct.trim();
  const targetNormalized = normalizeKey(name);
  for (const [key, value] of Object.entries(process.env)) {
    if (normalizeKey(key) === targetNormalized && value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export function getModelConfig(): ModelConfig {
  let geminiKey = readEnv('GEMINI_API_KEY');

  // Ultra-forgiving search: check if any env variable contains 'gemini' and 'key'/'token'
  // (handles "Gemini API key", "Gemini Key", "gemini_api_key", etc.)
  if (!geminiKey) {
    for (const [key, val] of Object.entries(process.env)) {
      const norm = normalizeKey(key);
      if (norm.includes('gemini') && (norm.includes('key') || norm.includes('token') || norm.includes('secret'))) {
        if (val && val.trim().length > 0) {
          geminiKey = val.trim();
          break;
        }
      }
    }
  }

  const genericKey = readEnv('MODEL_API_KEY');
  const apiKey = geminiKey || genericKey || null;

  // Auto-detect if using Google Gemini (by explicit key name, key prefix AIzaSy or AQ., or explicit config)
  const isGemini =
    Boolean(geminiKey) ||
    Boolean(apiKey && (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.'))) ||
    (readEnv('MODEL_BASE_URL') || '').includes('generativelanguage.googleapis.com') ||
    (readEnv('MODEL_NAME') || '').toLowerCase().startsWith('gemini');

  let defaultBaseUrl = DEFAULT_MODEL_BASE_URL;
  let defaultModelName = DEFAULT_MODEL_NAME;

  if (isGemini) {
    defaultBaseUrl = GEMINI_DEFAULT_BASE_URL;
    defaultModelName = GEMINI_DEFAULT_MODEL;
  }

  const baseUrl = (readEnv('MODEL_BASE_URL') || defaultBaseUrl).replace(/\/+$/, '');
  const timeoutMs = Number(readEnv('MODEL_TIMEOUT_MS') || 45_000);
  const maxOutputTokens = Number(readEnv('MODEL_MAX_OUTPUT_TOKENS') || 3_000);

  return {
    apiKey,
    baseUrl,
    model: readEnv('MODEL_NAME') || defaultModelName,
    providerLabel:
      readEnv('MODEL_PROVIDER_LABEL') ||
      (baseUrl.includes('googleapis.com')
        ? 'Google Gemini'
        : baseUrl.includes('openrouter.ai')
        ? 'OpenRouter'
        : 'OpenAI-compatible'),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 1_000 ? timeoutMs : 45_000,
    maxOutputTokens:
      Number.isFinite(maxOutputTokens) && maxOutputTokens >= 64
        ? Math.min(maxOutputTokens, 8_000)
        : 3_000,
  };
}

/** Safe, key-free status payload for the browser. */
export function getPublicModelStatus(config: ModelConfig = getModelConfig()): ModelStatus {
  let endpointHost: string | null = null;
  try {
    endpointHost = new URL(config.baseUrl).host;
  } catch {
    endpointHost = null;
  }

  return {
    configured: Boolean(config.apiKey),
    model: config.model,
    providerLabel: config.providerLabel,
    endpointHost,
  };
}

function requireString(
  value: unknown,
  field: string,
  maxChars: number
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ModelError('invalid_request', `Field "${field}" must be a non-empty string.`, 400, false);
  }
  if (value.length > maxChars) {
    throw new ModelError(
      'invalid_request',
      `Field "${field}" exceeds the ${maxChars.toLocaleString()} character limit.`,
      400,
      false
    );
  }
  return value;
}

function requireNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ModelError(
      'invalid_request',
      `Field "${field}" must be a number between ${min} and ${max}.`,
      400,
      false
    );
  }
  return value;
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ModelError('invalid_request', `Field "${field}" must be an object.`, 400, false);
  }
  return value as Record<string, unknown>;
}

/**
 * Validates the browser payload before any content is forwarded to the model.
 * Caps input sizes so a tampered client cannot build arbitrarily large prompts.
 */
export function validateExplainRequest(raw: unknown): ModelExplainRequest {
  const body = requireRecord(raw, 'body');
  const pr = requireRecord(body.pullRequest, 'pullRequest');
  const file = requireRecord(body.file, 'file');
  const hunk = requireRecord(body.hunk, 'hunk');

  if (!Array.isArray(hunk.lines) || hunk.lines.length === 0) {
    throw new ModelError('invalid_request', 'Field "hunk.lines" must be a non-empty array.', 400, false);
  }
  if (hunk.lines.length > MAX_HUNK_LINES) {
    throw new ModelError(
      'invalid_request',
      `Field "hunk.lines" exceeds the ${MAX_HUNK_LINES} line limit.`,
      400,
      false
    );
  }

  const lines = hunk.lines.map((rawLine, index) => {
    const line = requireRecord(rawLine, `hunk.lines[${index}]`);
    if (
      line.type !== 'unchanged' &&
      line.type !== 'added' &&
      line.type !== 'deleted'
    ) {
      throw new ModelError(
        'invalid_request',
        `Field "hunk.lines[${index}].type" must be unchanged, added, or deleted.`,
        400,
        false
      );
    }
    const type: 'unchanged' | 'added' | 'deleted' = line.type;

    const oldLineNumber =
      line.oldLineNumber === null
        ? null
        : requireNumber(line.oldLineNumber, `hunk.lines[${index}].oldLineNumber`, 1, 10_000_000);
    const newLineNumber =
      line.newLineNumber === null
        ? null
        : requireNumber(line.newLineNumber, `hunk.lines[${index}].newLineNumber`, 1, 10_000_000);

    if (typeof line.content !== 'string' || line.content.length > MAX_LINE_CHARS) {
      throw new ModelError(
        'invalid_request',
        `Field "hunk.lines[${index}].content" must be a string under ${MAX_LINE_CHARS} characters.`,
        400,
        false
      );
    }

    return {
      type,
      oldLineNumber,
      newLineNumber,
      content: line.content,
    };
  });

  return {
    pullRequest: {
      number: requireNumber(pr.number, 'pullRequest.number', 1, 10_000_000),
      title: requireString(pr.title, 'pullRequest.title', MAX_TITLE_CHARS),
      repository: requireString(pr.repository, 'pullRequest.repository', MAX_TITLE_CHARS),
      author: requireString(pr.author, 'pullRequest.author', MAX_TITLE_CHARS),
      sourceBranch: requireString(pr.sourceBranch, 'pullRequest.sourceBranch', MAX_TITLE_CHARS),
      targetBranch: requireString(pr.targetBranch, 'pullRequest.targetBranch', MAX_TITLE_CHARS),
      overview: requireString(pr.overview, 'pullRequest.overview', MAX_TEXT_FIELD_CHARS),
      purpose: requireString(pr.purpose, 'pullRequest.purpose', MAX_TEXT_FIELD_CHARS),
    },
    file: {
      path: requireString(file.path, 'file.path', MAX_TITLE_CHARS),
      language: requireString(file.language, 'file.language', 100),
      summary: requireString(file.summary, 'file.summary', MAX_TEXT_FIELD_CHARS),
      baseContent: requireString(file.baseContent, 'file.baseContent', MAX_CONTENT_INPUT_CHARS),
      proposedContent: requireString(
        file.proposedContent,
        'file.proposedContent',
        MAX_CONTENT_INPUT_CHARS
      ),
    },
    hunk: {
      header: requireString(hunk.header, 'hunk.header', MAX_TITLE_CHARS),
      oldStart: requireNumber(hunk.oldStart, 'hunk.oldStart', 0, 10_000_000),
      oldLines: requireNumber(hunk.oldLines, 'hunk.oldLines', 0, MAX_HUNK_LINES),
      newStart: requireNumber(hunk.newStart, 'hunk.newStart', 0, 10_000_000),
      newLines: requireNumber(hunk.newLines, 'hunk.newLines', 0, MAX_HUNK_LINES),
      lines,
    },
  };
}

function truncate(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  const omitted = text.length - maxChars;
  return {
    text: `${text.slice(0, maxChars)}\n[... ${omitted.toLocaleString()} characters omitted from context ...]`,
    truncated: true,
  };
}

function formatUnifiedHunk(input: ModelExplainRequest, truncated: boolean): string {
  const rendered = input.hunk.lines.map((line) => {
    const marker = line.type === 'added' ? '+' : line.type === 'deleted' ? '-' : ' ';
    const oldNo = line.oldLineNumber === null ? '' : String(line.oldLineNumber);
    const newNo = line.newLineNumber === null ? '' : String(line.newLineNumber);
    return `${oldNo.padStart(4)} ${newNo.padStart(4)} ${marker} ${line.content}`;
  });

  return [
    `Hunk header: ${input.hunk.header}`,
    `Base lines ${input.hunk.oldStart}–${input.hunk.oldStart + Math.max(0, input.hunk.oldLines - 1)}, proposed lines ${input.hunk.newStart}–${input.hunk.newStart + Math.max(0, input.hunk.newLines - 1)}.`,
    truncated ? 'Note: long hunk lines were truncated before sending.' : '',
    rendered.join('\n'),
  ]
    .filter(Boolean)
    .join('\n');
}

export interface BuiltPrompt {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  truncated: boolean;
}

/**
 * Builds the grounded prompt from the real diff hunk plus the real base and
 * proposed file contents. Nothing is invented: if a file is missing or too
 * large, the prompt says so explicitly.
 */
export function buildModelPrompt(input: ModelExplainRequest): BuiltPrompt {
  let truncated = false;

  const hunkLines = input.hunk.lines.slice(0, MAX_HUNK_LINES).map((line) => {
    const clipped = line.content.slice(0, MAX_LINE_CHARS);
    if (clipped.length !== line.content.length) truncated = true;
    return { ...line, content: clipped };
  });
  if (hunkLines.length !== input.hunk.lines.length) truncated = true;

  const base = truncate(input.file.baseContent, MAX_FILE_CONTEXT_CHARS);
  const proposed = truncate(input.file.proposedContent, MAX_FILE_CONTEXT_CHARS);
  truncated = truncated || base.truncated || proposed.truncated;

  const hunkText = formatUnifiedHunk(
    { ...input, hunk: { ...input.hunk, lines: hunkLines } },
    truncated
  );

  const system = [
    'You are a senior code reviewer analysing a pull request diff.',
    'Use ONLY the supplied diff hunk and file contents. Do not invent files, behaviour, dependencies, or runtime configuration that are not shown.',
    'If the evidence is insufficient for a claim, say so explicitly instead of guessing.',
    'Cite concrete file paths and line numbers from the supplied context.',
    'Return plain text (no Markdown headings, no JSON) in exactly three short sections:',
    '1. What changed',
    '2. Why it matters',
    '3. Review focus',
    'Keep the entire answer under 220 words.',
  ].join('\n');

  const user = [
    `Pull request #${input.pullRequest.number}: ${input.pullRequest.title}`,
    `Repository: ${input.pullRequest.repository}`,
    `Branches: ${input.pullRequest.sourceBranch} → ${input.pullRequest.targetBranch}`,
    `Author: ${input.pullRequest.author}`,
    `PR overview: ${input.pullRequest.overview}`,
    `PR purpose: ${input.pullRequest.purpose}`,
    '',
    `File: ${input.file.path} (${input.file.language})`,
    `File summary: ${input.file.summary}`,
    '',
    '--- CHANGED HUNK (exact unified diff) ---',
    hunkText,
    '',
    '--- FULL PROPOSED FILE (context) ---',
    proposed.text,
    '',
    '--- FULL BASE FILE (context) ---',
    base.text,
  ].join('\n');

  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    truncated,
  };
}

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { content?: string | Array<{ type?: string; text?: string }> };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function extractMessageText(response: ChatCompletionResponse): string {
  const choice = response.choices?.[0];
  const message = choice?.message;
  const content = message?.content;
  if (typeof content === 'string' && content.trim().length > 0) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (text.length > 0) return text;
  }
  // If the model is a reasoning model that returned thought text
  const reasoning = (message as { reasoning?: string })?.reasoning;
  if (typeof reasoning === 'string' && reasoning.trim().length > 0) {
    return reasoning.trim();
  }
  return '';
}

async function readProviderError(response: Response): Promise<string> {
  try {
    const text = (await response.text()).slice(0, 2_000);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: unknown } };
      if (parsed.error && typeof parsed.error.message === 'string') {
        return parsed.error.message.slice(0, 500);
      }
    } catch {
      // Fall through to the raw text snippet.
    }
    return text.slice(0, 500);
  } catch {
    return '';
  }
}

function mapProviderHttpError(status: number, providerMessage: string): ModelError {
  if (status === 401 || status === 403) {
    return new ModelError(
      'upstream_auth',
      'The configured model credential was rejected by the provider. Check MODEL_API_KEY.',
      502,
      false
    );
  }
  if (status === 429) {
    const isQuota = providerMessage.toLowerCase().includes('quota') || providerMessage.toLowerCase().includes('exceeded');
    return new ModelError(
      'upstream_rate_limited',
      isQuota
        ? 'Gemini API free tier quota limit reached (20 requests/day). Please try again tomorrow, switch models, or use a new Gemini key.'
        : 'The model provider is rate limiting requests. Wait a moment and retry.',
      429,
      true
    );
  }
  if (status === 402) {
    return new ModelError(
      'upstream_quota',
      'The model provider account has insufficient credits for this request.',
      502,
      false
    );
  }
  if (status === 400 || status === 404) {
    return new ModelError(
      'upstream_bad_request',
      `The model provider rejected the request${providerMessage ? `: ${providerMessage}` : '.'}`,
      502,
      false
    );
  }
  return new ModelError(
    'upstream_error',
    `The model provider returned HTTP ${status}. Retry in a moment.`,
    502,
    true
  );
}

export interface ModelCallDeps {
  fetchImpl?: typeof fetch;
}

export interface ModelChatOptions extends ModelCallDeps {
  maxOutputTokens?: number;
}

export interface ModelChatResult {
  text: string;
  model: string;
  provider: string;
  usage?: ModelExplanation['usage'];
  latencyMs: number;
  generatedAt: string;
}

/**
 * Shared OpenAI-compatible chat transport used by both the Phase 2 hunk review
 * and the grounded voice assistant. Provider selection, credentials, timeouts,
 * and error mapping remain server-side and unchanged.
 */
export async function callModelChat(
  messages: BuiltPrompt['messages'],
  config: ModelConfig = getModelConfig(),
  options: ModelChatOptions = {}
): Promise<ModelChatResult> {
  if (!config.apiKey) {
    throw new ModelError(
      'not_configured',
      'No server-side model credential is configured. Set MODEL_API_KEY in .env and restart the API server.',
      503,
      false
    );
  }

  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();

  try {
    const requestHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.baseUrl.includes('openrouter.ai')
        ? {
            'HTTP-Referer': readEnv('MODEL_APP_URL') || 'http://localhost:3000',
            'X-Title': readEnv('MODEL_APP_NAME') || 'Gitvox',
          }
        : {}),
    };

    let activeModel = config.model;
    let response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        model: activeModel,
        messages,
        temperature: 0.3,
        max_tokens: options.maxOutputTokens ?? config.maxOutputTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    // Auto-fallback cascade across available Gemini models if one hits daily quota (429), overload (503), or server errors (500/502/504/404)
    if (
      !response.ok &&
      config.baseUrl.includes('googleapis.com') &&
      (response.status === 429 ||
        response.status === 503 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 504 ||
        response.status === 404)
    ) {
      const remainingModels = GEMINI_MODEL_CASCADE.filter((m) => m !== activeModel);
      for (const fallbackModel of remainingModels) {
        console.warn(`[model] ${activeModel} returned HTTP ${response.status}. Retrying with fallback model ${fallbackModel}...`);
        try {
          const fallbackResponse = await fetchImpl(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify({
              model: fallbackModel,
              messages,
              temperature: 0.3,
              max_tokens: options.maxOutputTokens ?? config.maxOutputTokens,
              stream: false,
            }),
            signal: controller.signal,
          });
          if (fallbackResponse.ok) {
            response = fallbackResponse;
            activeModel = fallbackModel;
            break;
          }
        } catch {
          // Continue to next fallback model in cascade
        }
      }
    }

    if (!response.ok) {
      throw mapProviderHttpError(response.status, await readProviderError(response));
    }

    let payload: ChatCompletionResponse;
    try {
      payload = (await response.json()) as ChatCompletionResponse;
    } catch {
      throw new ModelError(
        'invalid_upstream_response',
        'The model provider returned a response that could not be parsed.',
        502,
        true
      );
    }

    const text = extractMessageText(payload);
    if (!text) {
      throw new ModelError(
        'empty_response',
        'The model returned no explanation text. Retry to generate a new response.',
        502,
        true
      );
    }

    return {
      text,
      model: payload.model || activeModel || config.model,
      provider: config.providerLabel,
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens,
          }
        : undefined,
      latencyMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof ModelError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ModelError(
        'model_timeout',
        `The model did not respond within ${Math.round(config.timeoutMs / 1000)} seconds. Retry the explanation.`,
        504,
        true
      );
    }

    throw new ModelError(
      'model_unreachable',
      'Gitvox could not reach the configured model endpoint. Check the server logs and MODEL_BASE_URL.',
      502,
      true
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sends the validated PR-hunk request to the configured open-weight model and
 * returns the provider's genuine completion text plus provenance metadata.
 */
export async function requestModelExplanation(
  input: ModelExplainRequest,
  config: ModelConfig = getModelConfig(),
  deps: ModelCallDeps = {}
): Promise<ModelExplanation & { truncatedContext: boolean }> {
  const { messages, truncated } = buildModelPrompt(input);
  const result = await callModelChat(messages, config, deps);
  return { ...result, truncatedContext: truncated };
}