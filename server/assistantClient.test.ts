import test from 'node:test';
import assert from 'node:assert/strict';
import type { AssistantRequest } from '../src/types/gitvox';
import { SAMPLE_PROJECT } from '../src/data/sampleProject';
import { SAMPLE_PULL_REQUEST } from '../src/data/samplePullRequest';
import {
  buildAssistantPrompt,
  requestAssistantExplanation,
  validateAssistantRequest,
} from './assistantClient';
import type { ModelConfig } from './modelClient';

const prFile = SAMPLE_PULL_REQUEST.files[0];
const projectFile = SAMPLE_PROJECT.files[0];

const explainPrRequest: AssistantRequest = {
  action: 'explain-pr',
  transcript: 'Explain this PR to me',
  pullRequest: {
    number: SAMPLE_PULL_REQUEST.number,
    title: SAMPLE_PULL_REQUEST.title,
    repository: SAMPLE_PULL_REQUEST.repository,
    author: SAMPLE_PULL_REQUEST.author,
    sourceBranch: SAMPLE_PULL_REQUEST.sourceBranch,
    targetBranch: SAMPLE_PULL_REQUEST.targetBranch,
    overview: SAMPLE_PULL_REQUEST.overview,
    purpose: SAMPLE_PULL_REQUEST.purpose,
    files: SAMPLE_PULL_REQUEST.files.map((file) => ({
      path: file.path,
      language: file.language,
      summary: file.summary,
      baseContent: file.baseContent,
      proposedContent: file.proposedContent,
      additions: file.expectedAdditions,
      deletions: file.expectedDeletions,
    })),
  },
  project: {
    name: SAMPLE_PROJECT.name,
    description: SAMPLE_PROJECT.description,
    files: SAMPLE_PROJECT.files.map((file) => ({ path: file.path, language: file.language })),
  },
};

const rangeRequest: AssistantRequest = {
  action: 'explain-range',
  transcript: 'Explain lines 5 to 27',
  file: {
    path: projectFile.path,
    language: projectFile.language,
    summary: 'auth middleware',
    content: projectFile.content,
    functions: projectFile.functions.map((fn) => ({
      name: fn.name,
      signature: fn.signature,
      summary: fn.summary,
      startLine: fn.startLine,
      endLine: fn.endLine,
    })),
  },
  range: { startLine: 5, endLine: 27 },
  project: explainPrRequest.project,
};

const securityRequest: AssistantRequest = {
  action: 'check-security',
  transcript: 'Run a security analysis',
  pullRequest: explainPrRequest.pullRequest,
  project: explainPrRequest.project,
};

const config: ModelConfig = {
  apiKey: 'test-key',
  baseUrl: 'http://127.0.0.1:9999/v1',
  model: 'test-model',
  providerLabel: 'Test Provider',
  timeoutMs: 5_000,
  maxOutputTokens: 700,
};

test('validateAssistantRequest enforces action-specific context', () => {
  const validated = validateAssistantRequest(explainPrRequest);
  assert.equal(validated.action, 'explain-pr');
  assert.equal(validated.pullRequest?.files.length, 5);

  assert.throws(
    () => validateAssistantRequest({ ...explainPrRequest, pullRequest: undefined }),
    /pull-request context is required/i
  );
  assert.throws(
    () => validateAssistantRequest({ action: 'explain-file', transcript: 'x' }),
    /file context is required/i
  );
  assert.throws(
    () => validateAssistantRequest({ action: 'check-file-errors', transcript: 'x' }),
    /file context is required/i
  );
  assert.throws(
    () => validateAssistantRequest({ action: 'not-a-real-action', transcript: 'x' }),
    /unsupported assistant action/i
  );
});

test('PR prompt includes real base/proposed code and every changed file', () => {
  const { messages } = buildAssistantPrompt(validateAssistantRequest(explainPrRequest));
  const user = messages.find((message) => message.role === 'user');
  const system = messages.find((message) => message.role === 'system');
  assert.ok(user && system);

  for (const file of SAMPLE_PULL_REQUEST.files) {
    assert.ok(user.content.includes(`### FILE: ${file.path}`), file.path);
  }
  assert.ok(user.content.includes(prFile.baseContent.split('\n')[0]));
  assert.ok(user.content.includes('verifyAccessToken'));
  assert.match(system.content, /450–700 words/);
  assert.match(system.content, /Never invent/);
});

test('security check prompt contains security-focused instructions', () => {
  const { messages } = buildAssistantPrompt(validateAssistantRequest(securityRequest));
  const system = messages.find((message) => message.role === 'system');
  assert.ok(system);
  assert.match(system.content, /security audit/i);
  assert.match(system.content, /timing attack/i);
  assert.match(system.content, /vulnerability/i);
});

test('range prompt includes numbered selected lines and function context', () => {
  const { messages } = buildAssistantPrompt(validateAssistantRequest(rangeRequest));
  const user = messages.find((message) => message.role === 'user');
  assert.ok(user);
  assert.match(user.content, /Selected range: L5–L27/);
  assert.match(user.content, /SELECTED LINES L5–L27/);
  assert.match(user.content, /5: export function authenticateRequest/);
  assert.match(user.content, /FUNCTIONS/);
});

test('requestAssistantExplanation requests a detailed response with real context', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify({
        model: 'test-model',
        choices: [
          {
            message: {
              content:
                '## Purpose\nThis PR adds token auth.\n\n- auth.js verifies bearer tokens.\n> verifyAccessToken(token)',
            },
          },
        ],
        usage: { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  const result = await requestAssistantExplanation(explainPrRequest, config, { fetchImpl });

  assert.match(result.text, /## Purpose/);
  assert.equal(result.provider, 'Test Provider');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:9999/v1/chat/completions');

  const body = JSON.parse(String(calls[0].init?.body)) as {
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
  };
  assert.ok(body.max_tokens >= 1400);
  const userPrompt = body.messages.find((message) => message.role === 'user');
  assert.ok(userPrompt?.content.includes('verifyAccessToken'));
  assert.ok(userPrompt?.content.includes('src/middleware/auth.js'));
});
