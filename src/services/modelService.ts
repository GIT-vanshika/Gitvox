import type {
  AssistantRequest,
  DiffHunk,
  ModelErrorInfo,
  ModelExplainRequest,
  ModelExplanation,
  ModelStatus,
  PRFileChange,
  PullRequestData,
} from '../types/gitvox';
import { buildAssistantPrompt } from '../../server/assistantClient';

const CLIENT_TIMEOUT_MS = 60_000;

export class ModelServiceError extends Error {
  info: ModelErrorInfo;
  httpStatus: number | null;

  constructor(info: ModelErrorInfo, httpStatus: number | null = null) {
    super(info.message);
    this.name = 'ModelServiceError';
    this.info = info;
    this.httpStatus = httpStatus;
  }
}

export function toModelErrorInfo(error: unknown): ModelErrorInfo {
  if (error instanceof ModelServiceError) return error.info;
  return {
    code: 'network_error',
    message:
      error instanceof Error
        ? error.message
        : 'Gitvox could not reach the local model bridge.',
    retryable: true,
  };
}

function parseErrorPayload(payload: unknown, status: number): ModelServiceError {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const raw = (payload as { error?: unknown }).error;
    if (raw && typeof raw === 'object') {
      const candidate = raw as Partial<ModelErrorInfo>;
      if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
        return new ModelServiceError(
          {
            code: candidate.code,
            message: candidate.message,
            retryable: Boolean(candidate.retryable),
          },
          status
        );
      }
    }
  }

  return new ModelServiceError(
    {
      code: status === 429 ? 'rate_limited' : 'api_error',
      message:
        status === 429
          ? 'Too many explanation requests. Wait a minute and retry.'
          : `The model bridge returned HTTP ${status}.`,
      retryable: status === 429 || status >= 500,
    },
    status
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Builds the exact request sent to the server: real hunk + real file contents. */
export function buildExplainRequest(
  pullRequest: PullRequestData,
  file: PRFileChange,
  hunk: DiffHunk
): ModelExplainRequest {
  return {
    pullRequest: {
      number: pullRequest.number,
      title: pullRequest.title,
      repository: pullRequest.repository,
      author: pullRequest.author,
      sourceBranch: pullRequest.sourceBranch,
      targetBranch: pullRequest.targetBranch,
      overview: pullRequest.overview,
      purpose: pullRequest.purpose,
    },
    file: {
      path: file.path,
      language: file.language,
      summary: file.summary,
      baseContent: file.baseContent,
      proposedContent: file.proposedContent,
    },
    hunk: {
      header: hunk.header,
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      lines: hunk.lines.map((line) => ({
        type: line.type,
        oldLineNumber: line.oldLineNumber,
        newLineNumber: line.newLineNumber,
        content: line.content,
      })),
    },
  };
}

export async function fetchModelStatus(signal?: AbortSignal): Promise<ModelStatus> {
  const response = await fetch('/api/model/status', {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    const payload = await readJson(response);
    throw parseErrorPayload(payload, response.status);
  }

  const payload = (await response.json()) as Partial<ModelStatus>;
  if (typeof payload.model !== 'string' || typeof payload.configured !== 'boolean') {
    throw new ModelServiceError({
      code: 'invalid_status',
      message: 'The model bridge returned an unexpected status payload.',
      retryable: true,
    });
  }

  return {
    configured: payload.configured,
    model: payload.model,
    providerLabel:
      typeof payload.providerLabel === 'string' ? payload.providerLabel : 'OpenAI-compatible',
    endpointHost: typeof payload.endpointHost === 'string' ? payload.endpointHost : null,
  };
}

/**
 * Shared bridge call used by the PR hunk review and the voice assistant.
 * Authentication stays server-side; the browser only sees the model response.
 */
async function postExplanation(
  endpoint: string,
  body: unknown,
  signal?: AbortSignal
): Promise<ModelExplanation> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await readJson(response);
      throw parseErrorPayload(payload, response.status);
    }

    const payload = (await response.json()) as { explanation?: Partial<ModelExplanation> };
    const explanation = payload.explanation;

    if (
      !explanation ||
      typeof explanation.text !== 'string' ||
      explanation.text.trim().length === 0 ||
      typeof explanation.model !== 'string'
    ) {
      throw new ModelServiceError({
        code: 'invalid_model_response',
        message: 'The model bridge returned an incomplete explanation. Retry the request.',
        retryable: true,
      });
    }

    return {
      text: explanation.text,
      model: explanation.model,
      provider:
        typeof explanation.provider === 'string' ? explanation.provider : 'OpenAI-compatible',
      usage: explanation.usage,
      latencyMs:
        typeof explanation.latencyMs === 'number' ? explanation.latencyMs : CLIENT_TIMEOUT_MS,
      generatedAt:
        typeof explanation.generatedAt === 'string'
          ? explanation.generatedAt
          : new Date().toISOString(),
      truncatedContext: Boolean(explanation.truncatedContext),
    };
  } catch (error) {
    if (error instanceof ModelServiceError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ModelServiceError({
        code: signal?.aborted ? 'request_cancelled' : 'client_timeout',
        message: signal?.aborted
          ? 'The explanation request was cancelled.'
          : 'The model did not respond within 60 seconds. Retry the explanation.',
        retryable: !signal?.aborted,
      });
    }

    throw new ModelServiceError({
      code: 'network_error',
      message:
        'Gitvox could not reach the local model bridge. Make sure the API server is running (npm run dev).',
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

function getClientGeminiKey(): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const env = import.meta.env as Record<string, unknown>;
    for (const [key, val] of Object.entries(env)) {
      const norm = key.toLowerCase().replace(/[\s_\-.]+/g, '');
      if (norm.includes('gemini') && (norm.includes('key') || norm.includes('token'))) {
        if (typeof val === 'string' && val.trim().length > 0) {
          return val.trim();
        }
      }
    }
  }
  return undefined;
}

export const CLIENT_GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

async function callDirectGemini(
  request: AssistantRequest,
  apiKey: string,
  signal?: AbortSignal
): Promise<ModelExplanation> {
  const { messages, truncated } = buildAssistantPrompt(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const startedAt = Date.now();
  let lastError: Error | null = null;

  try {
    for (const modelName of CLIENT_GEMINI_MODELS) {
      try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: 0.3,
            max_tokens: 2500,
          }),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: ModelExplanation['usage'];
          };
          const content = data.choices?.[0]?.message?.content;
          if (content && typeof content === 'string') {
            return {
              text: content,
              model: modelName,
              provider: 'Google Gemini',
              usage: data.usage,
              latencyMs: Date.now() - startedAt,
              generatedAt: new Date().toISOString(),
              truncatedContext: truncated,
            };
          }
        }

        // Capture model failure (e.g. 503 high load or 429 quota) and cascade to next model
        let msg = `Gemini returned HTTP ${res.status}`;
        try {
          const errJson = (await res.json()) as { error?: { message?: string } };
          if (errJson.error?.message) {
            msg = errJson.error.message;
          }
        } catch {}

        console.warn(`[callDirectGemini] Model ${modelName} returned HTTP ${res.status} (${msg}). Trying next fallback model...`);
        const isQuota = msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('exceeded');
        lastError = new ModelServiceError({
          code: res.status === 429 ? 'upstream_rate_limited' : 'upstream_error',
          message: isQuota
            ? 'Gemini API free tier quota limit reached. Switch models or update your Gemini key.'
            : msg,
          retryable: res.status === 429 || res.status >= 500,
        });
      } catch (err) {
        if (signal?.aborted) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (lastError instanceof ModelServiceError) throw lastError;
    throw new ModelServiceError({
      code: 'upstream_error',
      message: lastError ? lastError.message : 'All Gemini models in fallback fleet are currently busy.',
      retryable: true,
    });
  } catch (error) {
    if (error instanceof ModelServiceError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ModelServiceError({
        code: signal?.aborted ? 'request_cancelled' : 'client_timeout',
        message: signal?.aborted
          ? 'The explanation request was cancelled.'
          : 'The model did not respond within 60 seconds. Retry the explanation.',
        retryable: !signal?.aborted,
      });
    }
    throw new ModelServiceError({
      code: 'network_error',
      message: error instanceof Error ? error.message : 'Could not reach Gemini API.',
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

/**
 * Calls the grounded voice-assistant endpoint with the real selected context.
 */
export async function explainAssistantWithModel(
  request: AssistantRequest,
  signal?: AbortSignal
): Promise<ModelExplanation> {
  try {
    return await postExplanation('/api/assistant/explain', request, signal);
  } catch (error) {
    if (signal?.aborted) throw error;

    // If server bridge is unreachable, try direct client-side Gemini if key is in client env!
    const clientKey = getClientGeminiKey();
    if (clientKey) {
      console.warn('[modelService] Server bridge failed, attempting direct Gemini call with client key...');
      return await callDirectGemini(request, clientKey, signal);
    }

    throw error;
  }
}

/**
 * Calls the Phase 2 PR-hunk endpoint. Kept unchanged for the existing Explain
 * Hunk actions in the pull-request review panel.
 */
export async function explainHunkWithModel(
  request: ModelExplainRequest,
  signal?: AbortSignal
): Promise<ModelExplanation> {
  return postExplanation('/api/explain', request, signal);
}