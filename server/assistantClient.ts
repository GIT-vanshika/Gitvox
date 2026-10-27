import type {
  AssistantAction,
  AssistantFileContext,
  AssistantPrFileContext,
  AssistantProjectContext,
  AssistantRequest,
} from '../src/types/gitvox';
import {
  ModelError,
  callModelChat,
  getModelConfig,
  type ModelCallDeps,
  type ModelChatResult,
  type ModelConfig,
} from './modelClient';

const MAX_TRANSCRIPT_CHARS = 2_000;
const MAX_TEXT_FIELD_CHARS = 4_000;
const MAX_CONTENT_INPUT_CHARS = 200_000;
const MAX_PR_FILES = 12;
const MAX_PROJECT_FILES = 200;
const MAX_FUNCTIONS = 100;
const PR_CONTENT_CHARS = 7_000;
const FILE_CONTENT_CHARS = 20_000;
const RANGE_CONTENT_CHARS = 16_000;
const ASSISTANT_MAX_OUTPUT_TOKENS = 1_400;

const ACTIONS: AssistantAction[] = [
  'explain-pr',
  'summarize-pr',
  'explain-file',
  'explain-range',
  'explain-function',
];

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ModelError('invalid_request', `Field "${field}" must be an object.`, 400, false);
  }
  return value as Record<string, unknown>;
}

function requireString(
  value: unknown,
  field: string,
  maxChars: number,
  allowEmpty = false
): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new ModelError(
      'invalid_request',
      `Field "${field}" must be a ${allowEmpty ? '' : 'non-empty '}string.`,
      400,
      false
    );
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

function optionalArray(value: unknown, field: string, maxItems: number): unknown[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ModelError(
      'invalid_request',
      `Field "${field}" must be an array with at most ${maxItems} items.`,
      400,
      false
    );
  }
  return value;
}

function validatePrFile(rawFile: unknown, index: number): AssistantPrFileContext {
  const file = requireRecord(rawFile, `pullRequest.files[${index}]`);
  return {
    path: requireString(file.path, `pullRequest.files[${index}].path`, 500),
    language: requireString(file.language, `pullRequest.files[${index}].language`, 100),
    summary: requireString(file.summary, `pullRequest.files[${index}].summary`, MAX_TEXT_FIELD_CHARS),
    baseContent: requireString(
      file.baseContent,
      `pullRequest.files[${index}].baseContent`,
      MAX_CONTENT_INPUT_CHARS,
      true
    ),
    proposedContent: requireString(
      file.proposedContent,
      `pullRequest.files[${index}].proposedContent`,
      MAX_CONTENT_INPUT_CHARS,
      true
    ),
    additions: requireNumber(file.additions, `pullRequest.files[${index}].additions`, 0, 1_000_000),
    deletions: requireNumber(file.deletions, `pullRequest.files[${index}].deletions`, 0, 1_000_000),
  };
}

function validateProject(rawProject: unknown): AssistantProjectContext {
  const project = requireRecord(rawProject, 'project');
  const rawFiles = optionalArray(project.files, 'project.files', MAX_PROJECT_FILES);
  return {
    name: requireString(project.name, 'project.name', 500),
    description: requireString(project.description, 'project.description', MAX_TEXT_FIELD_CHARS, true),
    files: rawFiles.map((rawFile, index) => {
      const file = requireRecord(rawFile, `project.files[${index}]`);
      return {
        path: requireString(file.path, `project.files[${index}].path`, 500),
        language: requireString(file.language, `project.files[${index}].language`, 100),
      };
    }),
  };
}

function validateFile(rawFile: unknown): AssistantFileContext {
  const file = requireRecord(rawFile, 'file');
  const rawFunctions = Array.isArray(file.functions)
    ? optionalArray(file.functions, 'file.functions', MAX_FUNCTIONS)
    : [];

  return {
    path: requireString(file.path, 'file.path', 500),
    language: requireString(file.language, 'file.language', 100),
    summary: requireString(file.summary, 'file.summary', MAX_TEXT_FIELD_CHARS, true),
    content: requireString(file.content, 'file.content', MAX_CONTENT_INPUT_CHARS, true),
    functions: rawFunctions.map((rawFunction, index) => {
      const fn = requireRecord(rawFunction, `file.functions[${index}]`);
      return {
        name: requireString(fn.name, `file.functions[${index}].name`, 300),
        signature: requireString(fn.signature, `file.functions[${index}].signature`, 1_000),
        summary: requireString(fn.summary, `file.functions[${index}].summary`, MAX_TEXT_FIELD_CHARS, true),
        startLine: requireNumber(fn.startLine, `file.functions[${index}].startLine`, 1, 1_000_000),
        endLine: requireNumber(fn.endLine, `file.functions[${index}].endLine`, 1, 1_000_000),
      };
    }),
  };
}

/**
 * Validates the grounded assistant request before any content reaches the model.
 * Context requirements are action-specific so a file request cannot silently be
 * answered from a pull-request payload (or vice versa).
 */
export function validateAssistantRequest(raw: unknown): AssistantRequest {
  const body = requireRecord(raw, 'body');
  const actionRaw = requireString(body.action, 'action', 100);
  if (!ACTIONS.includes(actionRaw as AssistantAction)) {
    throw new ModelError('invalid_request', `Unsupported assistant action "${actionRaw}".`, 400, false);
  }
  const action = actionRaw as AssistantAction;

  const transcript =
    body.transcript === undefined ? '' : requireString(body.transcript, 'transcript', MAX_TRANSCRIPT_CHARS, true);

  const request: AssistantRequest = { action, transcript };

  if (body.pullRequest !== undefined) {
    const pr = requireRecord(body.pullRequest, 'pullRequest');
    const rawFiles = optionalArray(pr.files, 'pullRequest.files', MAX_PR_FILES);
    if (rawFiles.length === 0) {
      throw new ModelError('invalid_request', 'pullRequest.files must contain at least one file.', 400, false);
    }
    request.pullRequest = {
      number: requireNumber(pr.number, 'pullRequest.number', 1, 10_000_000),
      title: requireString(pr.title, 'pullRequest.title', 500),
      repository: requireString(pr.repository, 'pullRequest.repository', 500),
      author: requireString(pr.author, 'pullRequest.author', 500),
      sourceBranch: requireString(pr.sourceBranch, 'pullRequest.sourceBranch', 500),
      targetBranch: requireString(pr.targetBranch, 'pullRequest.targetBranch', 500),
      overview: requireString(pr.overview, 'pullRequest.overview', MAX_TEXT_FIELD_CHARS),
      purpose: requireString(pr.purpose, 'pullRequest.purpose', MAX_TEXT_FIELD_CHARS),
      files: rawFiles.map(validatePrFile),
    };
  }

  if (body.project !== undefined) {
    request.project = validateProject(body.project);
  }
  if (body.file !== undefined) {
    request.file = validateFile(body.file);
  }
  if (body.range !== undefined) {
    const range = requireRecord(body.range, 'range');
    const startLine = requireNumber(range.startLine, 'range.startLine', 1, 10_000_000);
    const endLine = requireNumber(range.endLine, 'range.endLine', 1, 10_000_000);
    request.range =
      startLine <= endLine
        ? { startLine, endLine }
        : { startLine: endLine, endLine: startLine };
  }
  if (body.function !== undefined) {
    const fn = requireRecord(body.function, 'function');
    request.function = {
      name: requireString(fn.name, 'function.name', 300),
      startLine: requireNumber(fn.startLine, 'function.startLine', 1, 10_000_000),
      endLine: requireNumber(fn.endLine, 'function.endLine', 1, 10_000_000),
    };
  }

  if ((action === 'explain-pr' || action === 'summarize-pr') && !request.pullRequest) {
    throw new ModelError('invalid_request', 'A pull-request context is required for this action.', 400, false);
  }
  if (action === 'explain-file' && !request.file) {
    throw new ModelError('invalid_request', 'A file context is required for this action.', 400, false);
  }
  if (action === 'explain-range' && (!request.file || !request.range)) {
    throw new ModelError('invalid_request', 'File and range contexts are required for this action.', 400, false);
  }
  if (action === 'explain-function' && (!request.file || !request.function)) {
    throw new ModelError(
      'invalid_request',
      'File and function contexts are required for this action.',
      400,
      false
    );
  }

  return request;
}

interface TruncatedText {
  text: string;
  truncated: boolean;
}

function truncate(text: string, maxChars: number): TruncatedText {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}\n[... ${(text.length - maxChars).toLocaleString()} characters omitted ...]`,
    truncated: true,
  };
}

function numberedContent(content: string, startLine: number, endLine: number, maxChars: number): TruncatedText {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const clampedStart = Math.min(Math.max(startLine, 1), Math.max(1, lines.length));
  const clampedEnd = Math.min(Math.max(endLine, clampedStart), Math.max(1, lines.length));
  const rendered = lines
    .slice(clampedStart - 1, clampedEnd)
    .map((line, index) => `${clampedStart + index}: ${line}`)
    .join('\n');
  return truncate(rendered, maxChars);
}

function formatFunctionMap(file: AssistantFileContext, selectedName?: string): string {
  if (file.functions.length === 0) return 'No function boundaries were supplied for this file.';
  const lines = file.functions.slice(0, 40).map((fn) => {
    const marker = selectedName && fn.name === selectedName ? ' (selected)' : '';
    return `- ${fn.name}${marker} · L${fn.startLine}–L${fn.endLine} · ${fn.signature} — ${fn.summary}`;
  });
  if (file.functions.length > 40) {
    lines.push(`- ... ${file.functions.length - 40} additional functions omitted`);
  }
  return lines.join('\n');
}

interface BuiltAssistantPrompt {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  truncated: boolean;
}

function actionInstruction(action: AssistantAction): string {
  switch (action) {
    case 'explain-pr':
      return [
        'Explain this pull request in depth. Cover:',
        '1. The overall purpose and approach.',
        '2. Each important changed file (one bullet per file, with the path) and how the changes connect.',
        '3. The implementation logic and data/control flow.',
        '4. Risks, security concerns, edge cases, and what a reviewer should verify.',
        'Aim for 450–700 words. Use ## headings and bullet lists. Do not repeat the raw diff.',
      ].join('\n');
    case 'summarize-pr':
      return [
        'Summarize this pull request concisely but substantively (about 200–350 words).',
        'Cover the objective, the main changed files as bullets, and the top risk or verification point.',
        'Use ## headings. Do not pad or repeat the full diff.',
      ].join('\n');
    case 'explain-file':
      return [
        'Explain the selected file for a developer who is new to it.',
        'Cover its purpose, the important functions and how control flows between them, key dependencies, and risks or edge cases.',
        'Cite concrete line ranges from the supplied functions. Aim for 300–600 words. Use ## headings and bullets.',
      ].join('\n');
    case 'explain-range':
      return [
        'Explain exactly the selected line range and its role in the file.',
        'Cover what the code does, how it works step by step, important dependencies, and edge cases or failure modes.',
        'Quote 1–3 short relevant lines from the range with > blockquotes. Aim for 250–500 words. Use ## headings.',
      ].join('\n');
    case 'explain-function':
      return [
        'Explain the selected function in detail.',
        'Cover its purpose, inputs and outputs, implementation logic, dependencies, and edge cases or failure modes.',
        'Cite the function line range. Aim for 250–500 words. Use ## headings and bullets.',
      ].join('\n');
  }
}

function formatPrContext(pr: NonNullable<AssistantRequest['pullRequest']>): {
  text: string;
  truncated: boolean;
} {
  let truncated = false;
  const parts: string[] = [
    `PR #${pr.number}: ${pr.title}`,
    `Repository: ${pr.repository}`,
    `Branches: ${pr.sourceBranch} → ${pr.targetBranch}`,
    `Author: ${pr.author}`,
    `Overview: ${pr.overview}`,
    `Purpose: ${pr.purpose}`,
    `Changed files: ${pr.files.length}`,
  ];

  for (const file of pr.files) {
    const base = truncate(file.baseContent, PR_CONTENT_CHARS);
    const proposed = truncate(file.proposedContent, PR_CONTENT_CHARS);
    truncated = truncated || base.truncated || proposed.truncated;
    parts.push(
      '',
      `### FILE: ${file.path} (${file.language}) +${file.additions}/-${file.deletions}`,
      `Summary: ${file.summary}`,
      '--- BASE VERSION ---',
      base.text || '(empty file)',
      '--- PROPOSED VERSION ---',
      proposed.text || '(empty file)'
    );
  }

  return { text: parts.join('\n'), truncated };
}

function formatFileContext(file: AssistantFileContext): { text: string; truncated: boolean } {
  const numbered = numberedContent(file.content, 1, Number.MAX_SAFE_INTEGER, FILE_CONTENT_CHARS);
  return {
    text: [
      `File: ${file.path} (${file.language})`,
      `Summary: ${file.summary || '(none supplied)'}`,
      '',
      '--- FUNCTIONS ---',
      formatFunctionMap(file),
      '',
      '--- FILE CONTENT (line-numbered) ---',
      numbered.text || '(empty file)',
    ].join('\n'),
    truncated: numbered.truncated,
  };
}

function formatRangeContext(
  file: AssistantFileContext,
  range: NonNullable<AssistantRequest['range']>
): { text: string; truncated: boolean } {
  const lines = file.content.replace(/\r\n/g, '\n').split('\n');
  const start = Math.min(Math.max(range.startLine, 1), Math.max(1, lines.length));
  const end = Math.min(Math.max(range.endLine, start), Math.max(1, lines.length));
  const selected = numberedContent(file.content, start, end, 8_000);
  const context = numberedContent(file.content, 1, Number.MAX_SAFE_INTEGER, RANGE_CONTENT_CHARS);

  return {
    text: [
      `File: ${file.path} (${file.language})`,
      `Summary: ${file.summary || '(none supplied)'}`,
      `Selected range: L${start}–L${end}`,
      '',
      '--- FUNCTIONS ---',
      formatFunctionMap(file),
      '',
      `--- SELECTED LINES L${start}–L${end} ---`,
      selected.text,
      '',
      '--- FULL FILE CONTEXT (line-numbered) ---',
      context.text,
    ].join('\n'),
    truncated: selected.truncated || context.truncated,
  };
}

function formatFunctionContext(
  file: AssistantFileContext,
  fn: NonNullable<AssistantRequest['function']>
): { text: string; truncated: boolean } {
  const matched = file.functions.find((candidate) => candidate.name === fn.name);
  const start = matched?.startLine ?? fn.startLine;
  const end = matched?.endLine ?? fn.endLine;
  const snippet = numberedContent(file.content, start, end, 8_000);
  const context = numberedContent(file.content, 1, Number.MAX_SAFE_INTEGER, RANGE_CONTENT_CHARS);

  return {
    text: [
      `File: ${file.path} (${file.language})`,
      `Summary: ${file.summary || '(none supplied)'}`,
      `Selected function: ${fn.name} · L${start}–L${end}`,
      matched ? `Signature: ${matched.signature}` : '',
      matched ? `Function summary: ${matched.summary}` : '',
      '',
      '--- FUNCTIONS IN FILE ---',
      formatFunctionMap(file, fn.name),
      '',
      `--- SELECTED FUNCTION BODY L${start}–L${end} ---`,
      snippet.text,
      '',
      '--- FULL FILE CONTEXT (line-numbered) ---',
      context.text,
    ]
      .filter(Boolean)
      .join('\n'),
    truncated: snippet.truncated || context.truncated,
  };
}

/**
 * Builds the grounded voice-assistant prompt from the real selected context.
 * The prompt explicitly forbids inventing code, dependencies, or behavior.
 */
export function buildAssistantPrompt(input: AssistantRequest): BuiltAssistantPrompt {
  const system = [
    'You are Gitvox, a senior software engineer and code reviewer.',
    'Answer ONLY from the supplied context. Never invent files, functions, dependencies, behavior, or risks.',
    'If the supplied context is insufficient, say so explicitly and explain what evidence is missing.',
    'Write a detailed, readable Markdown answer with ## headings, bullet lists, and short > blockquotes for code references.',
    'Do not output JSON. Do not mention prompts, tokens, or internal implementation details.',
    '',
    actionInstruction(input.action),
  ].join('\n');

  let contextText = '';
  let truncated = false;

  if (input.pullRequest) {
    const prContext = formatPrContext(input.pullRequest);
    contextText = prContext.text;
    truncated = prContext.truncated;
  }

  if (input.file) {
    const fileContext =
      input.action === 'explain-range' && input.range
        ? formatRangeContext(input.file, input.range)
        : input.action === 'explain-function' && input.function
        ? formatFunctionContext(input.file, input.function)
        : formatFileContext(input.file);
    contextText = [contextText, fileContext.text].filter(Boolean).join('\n\n');
    truncated = truncated || fileContext.truncated;
  }

  if (input.project) {
    const projectText = [
      `Project: ${input.project.name}`,
      input.project.description ? `Project description: ${input.project.description}` : '',
      'Project files:',
      ...input.project.files
        .slice(0, 80)
        .map((file) => `- ${file.path} (${file.language})`),
      input.project.files.length > 80
        ? `- ... ${input.project.files.length - 80} additional files omitted`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    contextText = [projectText, contextText].filter(Boolean).join('\n\n');
  }

  if (truncated) {
    contextText +=
      '\n\n[... some context was truncated for length; base claims only on the supplied text ...]';
  }

  const user = [
    `Action: ${input.action}`,
    `Original user request: ${input.transcript || '(not supplied)'}`,
    '',
    '--- SUPPLIED CODE AND PR CONTEXT ---',
    contextText || '(no context supplied)',
  ].join('\n');

  return {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    truncated,
  };
}

/**
 * Sends the grounded assistant prompt through the same server-side model
 * transport used by Phase 2. The client never sees provider credentials.
 */
export async function requestAssistantExplanation(
  input: AssistantRequest,
  config: ModelConfig = getModelConfig(),
  deps: ModelCallDeps = {}
): Promise<ModelChatResult & { truncatedContext: boolean }> {
  const { messages, truncated } = buildAssistantPrompt(input);
  const result = await callModelChat(messages, config, {
    ...deps,
    maxOutputTokens: Math.max(config.maxOutputTokens, ASSISTANT_MAX_OUTPUT_TOKENS),
  });
  return { ...result, truncatedContext: truncated };
}