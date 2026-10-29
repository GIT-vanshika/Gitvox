import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFileDiff } from '../src/services/diffService';
import { buildExplainRequest } from '../src/services/modelService';
import { SAMPLE_PULL_REQUEST } from '../src/data/samplePullRequest';
import {
  ModelError,
  buildModelPrompt,
  requestModelExplanation,
  validateExplainRequest,
  type ModelConfig,
} from './modelClient';

const sampleFile = SAMPLE_PULL_REQUEST.files[0];
const sampleDiff = computeFileDiff(sampleFile.baseContent, sampleFile.proposedContent, sampleFile.path);
const sampleHunk = sampleDiff.hunks[0];
const validPayload = buildExplainRequest(SAMPLE_PULL_REQUEST, sampleFile, sampleHunk);

const testConfig: ModelConfig = {
  apiKey: 'test-server-key',
  baseUrl: 'http://127.0.0.1:9999/v1',
  model: 'cohere/north-mini-code:free',
  providerLabel: 'Test Provider',
  timeoutMs: 5_000,
  maxOutputTokens: 700,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('validateExplainRequest accepts the real sample hunk and rejects malformed payloads', () => {
  const validated = validateExplainRequest(validPayload);
  assert.equal(validated.file.path, 'src/middleware/auth.js');
  assert.equal(validated.pullRequest.number, 284);
  assert.ok(validated.hunk.lines.some((line) => line.type === 'added'));

  assert.throws(
    () => validateExplainRequest({ ...validPayload, hunk: { ...validPayload.hunk, lines: [] } }),
    /non-empty array/i
  );
  assert.throws(
    () => validateExplainRequest({ ...validPayload, file: { ...validPayload.file, path: '' } }),
    /non-empty string/i
  );
  assert.throws(
    () =>
      validateExplainRequest({
        ...validPayload,
        hunk: { ...validPayload.hunk, lines: Array(401).fill(validPayload.hunk.lines[0]) },
      }),
    /line limit/i
  );
});

test('buildModelPrompt sends the actual hunk, base file, and proposed file context', () => {
  const { messages } = buildModelPrompt(validateExplainRequest(validPayload));
  const userMessage = messages.find((m) => m.role === 'user');
  assert.ok(userMessage);

  assert.match(userMessage.content, /Pull request #284/);
  assert.match(userMessage.content, new RegExp(sampleFile.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(userMessage.content, /--- CHANGED HUNK \(exact unified diff\) ---/);
  assert.match(userMessage.content, /verifyAccessToken/);
  assert.match(userMessage.content, /--- FULL PROPOSED FILE \(context\) ---/);
  assert.match(userMessage.content, /--- FULL BASE FILE \(context\) ---/);
  assert.ok(userMessage.content.includes(sampleFile.baseContent.split('\n')[0]));

  const systemMessage = messages.find((m) => m.role === 'system');
  assert.match(systemMessage?.content || '', /Use ONLY the supplied diff hunk and file contents/i);
});

test('requestModelExplanation sends the server-held credential and returns provider text unchanged', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const modelText = 'What changed: auth.js now verifies a Bearer token.\nWhy it matters: legacy x-api-key checks are gone.\nReview focus: confirm TOKEN_SECRET is set.';

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return jsonResponse({
      model: 'cohere/north-mini-code:free',
      choices: [{ message: { content: modelText } }],
      usage: { prompt_tokens: 900, completion_tokens: 80, total_tokens: 980 },
    });
  }) as typeof fetch;

  const result = await requestModelExplanation(validPayload, testConfig, { fetchImpl });

  assert.equal(result.text, modelText);
  assert.equal(result.model, 'cohere/north-mini-code:free');
  assert.equal(result.provider, 'Test Provider');
  assert.equal(result.usage?.totalTokens, 980);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:9999/v1/chat/completions');
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer test-server-key');
  assert.equal(headers['Content-Type'], 'application/json');

  const requestBody = JSON.parse(String(calls[0].init?.body)) as {
    model: string;
    stream: boolean;
    messages: Array<{ role: string; content: string }>;
  };
  assert.equal(requestBody.model, 'cohere/north-mini-code:free');
  assert.equal(requestBody.stream, false);
  assert.ok(requestBody.messages.some((m) => m.content.includes('verifyAccessToken')));
  assert.ok(!JSON.stringify(requestBody).includes('test-server-key'));
});

test('requestModelExplanation never fabricates a response when the credential or content is missing', async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return jsonResponse({});
  }) as typeof fetch;

  await assert.rejects(
    () => requestModelExplanation(validPayload, { ...testConfig, apiKey: null }, { fetchImpl }),
    (error: unknown) =>
      error instanceof ModelError &&
      error.code === 'not_configured' &&
      error.httpStatus === 503 &&
      error.retryable === false
  );
  assert.equal(called, false, 'No provider request should occur without a credential');

  const emptyContentFetch = (async () =>
    jsonResponse({
      model: 'cohere/north-mini-code:free',
      choices: [{ message: { content: '   ' } }],
    })) as typeof fetch;

  await assert.rejects(
    () => requestModelExplanation(validPayload, testConfig, { fetchImpl: emptyContentFetch }),
    (error: unknown) => error instanceof ModelError && error.code === 'empty_response'
  );
});

test('provider HTTP failures are mapped to honest retryable/non-retryable errors', async () => {
  const authFailFetch = (async () =>
    jsonResponse({ error: { message: 'No auth credentials found' } }, 401)) as typeof fetch;

  await assert.rejects(
    () => requestModelExplanation(validPayload, testConfig, { fetchImpl: authFailFetch }),
    (error: unknown) =>
      error instanceof ModelError &&
      error.code === 'upstream_auth' &&
      error.retryable === false &&
      !error.message.includes('No auth credentials')
  );

  const rateLimitFetch = (async () => jsonResponse({ error: { message: 'slow down' } }, 429)) as typeof fetch;

  await assert.rejects(
    () => requestModelExplanation(validPayload, testConfig, { fetchImpl: rateLimitFetch }),
    (error: unknown) =>
      error instanceof ModelError &&
      error.code === 'upstream_rate_limited' &&
      error.retryable === true
  );

  const abortFetch = (async () => {
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    throw abort;
  }) as typeof fetch;

  await assert.rejects(
    () => requestModelExplanation(validPayload, testConfig, { fetchImpl: abortFetch }),
    (error: unknown) =>
      error instanceof ModelError && error.code === 'model_timeout' && error.retryable === true
  );
});

test('getModelConfig auto-detects Gemini and falls back to OpenRouter correctly', async () => {
  const { getModelConfig } = await import('./modelClient');
  
  // Test with OpenRouter
  process.env.MODEL_API_KEY = 'sk-or-v1-test';
  delete process.env.GEMINI_API_KEY;
  delete process.env.MODEL_BASE_URL;
  delete process.env.MODEL_NAME;
  const orConfig = getModelConfig();
  assert.equal(orConfig.providerLabel, 'OpenRouter');
  assert.equal(orConfig.model, 'cohere/north-mini-code:free');

  // Test with Gemini key
  process.env.GEMINI_API_KEY = 'AIzaSy-test-gemini-key';
  const geminiConfig = getModelConfig();
  assert.equal(geminiConfig.providerLabel, 'Google Gemini');
  assert.equal(geminiConfig.model, 'gemini-3.5-flash');
  assert.ok(geminiConfig.baseUrl.includes('googleapis.com'));

  // Test with space-separated variable name (e.g. "Gemini API key")
  delete process.env.GEMINI_API_KEY;
  process.env['Gemini API key'] = 'AQ.Ab8RN6-test';
  const spacesConfig = getModelConfig();
  assert.equal(spacesConfig.providerLabel, 'Google Gemini');
  assert.equal(spacesConfig.model, 'gemini-3.5-flash');
  assert.equal(spacesConfig.apiKey, 'AQ.Ab8RN6-test');

  // Clean up
  delete process.env['Gemini API key'];
});
