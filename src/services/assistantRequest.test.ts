import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_PROJECT } from '../data/sampleProject';
import { SAMPLE_PULL_REQUEST } from '../data/samplePullRequest';
import { interpretVoiceTranscript } from './voiceCommands';
import { buildAssistantRequest, type AssistantContext } from './assistantRequest';

const prContext: AssistantContext = {
  route: 'pr',
  pullRequest: SAMPLE_PULL_REQUEST,
  selectedPrFile: SAMPLE_PULL_REQUEST.files[1],
  project: SAMPLE_PROJECT,
  selectedFile: SAMPLE_PROJECT.files[0],
  selectedFunctionName: 'authenticateRequest',
};

const projectContext: AssistantContext = {
  ...prContext,
  route: 'project',
};

test('PR explanation request carries every real file diff', () => {
  const match = interpretVoiceTranscript('Explain this PR to me');
  assert.equal(match.kind, 'explain-pr');

  const built = buildAssistantRequest(match, prContext);
  assert.equal(built.ok, true);
  if (!built.ok) return;

  assert.equal(built.request.action, 'explain-pr');
  assert.equal(built.request.pullRequest?.files.length, SAMPLE_PULL_REQUEST.files.length);
  assert.equal(
    built.request.pullRequest?.files[0].proposedContent,
    SAMPLE_PULL_REQUEST.files[0].proposedContent
  );
  assert.equal(
    built.request.pullRequest?.files[0].baseContent,
    SAMPLE_PULL_REQUEST.files[0].baseContent
  );
  assert.match(built.title, /PR #284/);
});

test('summarize request uses the same real PR context with a summary action', () => {
  const match = interpretVoiceTranscript('Summarize the changes');
  assert.equal(match.kind, 'summarize-pr');

  const built = buildAssistantRequest(match, prContext);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.request.action, 'summarize-pr');
  assert.match(built.title, /Summary/);
});

test('selected-file request resolves the PR file on the PR route', () => {
  const match = interpretVoiceTranscript('Walk me through this file');
  assert.equal(match.kind, 'explain-file');

  const built = buildAssistantRequest(match, prContext);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.request.file?.path, 'src/services/tokenService.js');
  assert.equal(
    built.request.file?.content,
    SAMPLE_PULL_REQUEST.files[1].proposedContent
  );
});

test('selected-file request resolves the project file on the project route', () => {
  const match = interpretVoiceTranscript('Explain the selected file');
  const built = buildAssistantRequest(match, projectContext);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.request.file?.path, 'src/middleware/auth.js');
  assert.equal(built.request.file?.content, SAMPLE_PROJECT.files[0].content);
});

test('line-range request carries the real selected file and range', () => {
  const match = interpretVoiceTranscript('Explain lines 5 to 27');
  assert.equal(match.kind, 'explain-range');

  const built = buildAssistantRequest(match, projectContext);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.deepEqual(built.request.range, { startLine: 5, endLine: 27 });
  assert.equal(built.request.file?.path, 'src/middleware/auth.js');
  assert.match(built.title, /lines 5–27/);
});

test('function request uses the selected function and explains missing context', () => {
  const match = interpretVoiceTranscript('What does this function do?');
  assert.equal(match.kind, 'explain-function');

  const built = buildAssistantRequest(
    { ...match, kind: 'explain-function' },
    { ...projectContext, selectedFunctionName: 'requireScope' }
  );
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.request.function?.name, 'requireScope');
  assert.equal(built.request.action, 'explain-function');

  const readme = SAMPLE_PROJECT.files.find((file) => file.path === 'README.md');
  assert.ok(readme);
  const noFunction = buildAssistantRequest(match, {
    ...projectContext,
    selectedFile: readme,
    selectedFunctionName: null,
  });
  assert.equal(noFunction.ok, false);
  if (!noFunction.ok) {
    assert.match(noFunction.reason, /No parsed function/i);
  }
});

test('clarification and unsupported matches never build a model request', () => {
  const ambiguous = buildAssistantRequest(interpretVoiceTranscript('Explain this'), prContext);
  assert.equal(ambiguous.ok, false);

  const unsupported = buildAssistantRequest(
    interpretVoiceTranscript('Tell me a joke'),
    prContext
  );
  assert.equal(unsupported.ok, false);
});