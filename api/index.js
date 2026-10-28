// server/modelClient.ts
var DEFAULT_MODEL_BASE_URL = "https://openrouter.ai/api/v1";
var DEFAULT_MODEL_NAME = "qwen/qwen-2.5-coder-32b-instruct";
var MAX_FILE_CONTEXT_CHARS = 12e3;
var MAX_HUNK_LINES = 400;
var MAX_LINE_CHARS = 2e3;
var MAX_TITLE_CHARS = 500;
var MAX_TEXT_FIELD_CHARS = 4e3;
var MAX_CONTENT_INPUT_CHARS = 2e5;
var ModelError = class extends Error {
  constructor(code, message, httpStatus, retryable) {
    super(message);
    this.name = "ModelError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
  }
};
function readEnv(name) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : void 0;
}
function getModelConfig() {
  const baseUrl = (readEnv("MODEL_BASE_URL") || DEFAULT_MODEL_BASE_URL).replace(/\/+$/, "");
  const timeoutMs = Number(readEnv("MODEL_TIMEOUT_MS") || 45e3);
  const maxOutputTokens = Number(readEnv("MODEL_MAX_OUTPUT_TOKENS") || 700);
  return {
    apiKey: readEnv("MODEL_API_KEY") || null,
    baseUrl,
    model: readEnv("MODEL_NAME") || DEFAULT_MODEL_NAME,
    providerLabel: readEnv("MODEL_PROVIDER_LABEL") || (baseUrl.includes("openrouter.ai") ? "OpenRouter" : "OpenAI-compatible"),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 1e3 ? timeoutMs : 45e3,
    maxOutputTokens: Number.isFinite(maxOutputTokens) && maxOutputTokens >= 64 ? Math.min(maxOutputTokens, 4e3) : 700
  };
}
function getPublicModelStatus(config = getModelConfig()) {
  let endpointHost = null;
  try {
    endpointHost = new URL(config.baseUrl).host;
  } catch {
    endpointHost = null;
  }
  return {
    configured: Boolean(config.apiKey),
    model: config.model,
    providerLabel: config.providerLabel,
    endpointHost
  };
}
function requireString(value, field, maxChars) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ModelError("invalid_request", `Field "${field}" must be a non-empty string.`, 400, false);
  }
  if (value.length > maxChars) {
    throw new ModelError(
      "invalid_request",
      `Field "${field}" exceeds the ${maxChars.toLocaleString()} character limit.`,
      400,
      false
    );
  }
  return value;
}
function requireNumber(value, field, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new ModelError(
      "invalid_request",
      `Field "${field}" must be a number between ${min} and ${max}.`,
      400,
      false
    );
  }
  return value;
}
function requireRecord(value, field) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ModelError("invalid_request", `Field "${field}" must be an object.`, 400, false);
  }
  return value;
}
function validateExplainRequest(raw) {
  const body = requireRecord(raw, "body");
  const pr = requireRecord(body.pullRequest, "pullRequest");
  const file = requireRecord(body.file, "file");
  const hunk = requireRecord(body.hunk, "hunk");
  if (!Array.isArray(hunk.lines) || hunk.lines.length === 0) {
    throw new ModelError("invalid_request", 'Field "hunk.lines" must be a non-empty array.', 400, false);
  }
  if (hunk.lines.length > MAX_HUNK_LINES) {
    throw new ModelError(
      "invalid_request",
      `Field "hunk.lines" exceeds the ${MAX_HUNK_LINES} line limit.`,
      400,
      false
    );
  }
  const lines = hunk.lines.map((rawLine, index) => {
    const line = requireRecord(rawLine, `hunk.lines[${index}]`);
    if (line.type !== "unchanged" && line.type !== "added" && line.type !== "deleted") {
      throw new ModelError(
        "invalid_request",
        `Field "hunk.lines[${index}].type" must be unchanged, added, or deleted.`,
        400,
        false
      );
    }
    const type = line.type;
    const oldLineNumber = line.oldLineNumber === null ? null : requireNumber(line.oldLineNumber, `hunk.lines[${index}].oldLineNumber`, 1, 1e7);
    const newLineNumber = line.newLineNumber === null ? null : requireNumber(line.newLineNumber, `hunk.lines[${index}].newLineNumber`, 1, 1e7);
    if (typeof line.content !== "string" || line.content.length > MAX_LINE_CHARS) {
      throw new ModelError(
        "invalid_request",
        `Field "hunk.lines[${index}].content" must be a string under ${MAX_LINE_CHARS} characters.`,
        400,
        false
      );
    }
    return {
      type,
      oldLineNumber,
      newLineNumber,
      content: line.content
    };
  });
  return {
    pullRequest: {
      number: requireNumber(pr.number, "pullRequest.number", 1, 1e7),
      title: requireString(pr.title, "pullRequest.title", MAX_TITLE_CHARS),
      repository: requireString(pr.repository, "pullRequest.repository", MAX_TITLE_CHARS),
      author: requireString(pr.author, "pullRequest.author", MAX_TITLE_CHARS),
      sourceBranch: requireString(pr.sourceBranch, "pullRequest.sourceBranch", MAX_TITLE_CHARS),
      targetBranch: requireString(pr.targetBranch, "pullRequest.targetBranch", MAX_TITLE_CHARS),
      overview: requireString(pr.overview, "pullRequest.overview", MAX_TEXT_FIELD_CHARS),
      purpose: requireString(pr.purpose, "pullRequest.purpose", MAX_TEXT_FIELD_CHARS)
    },
    file: {
      path: requireString(file.path, "file.path", MAX_TITLE_CHARS),
      language: requireString(file.language, "file.language", 100),
      summary: requireString(file.summary, "file.summary", MAX_TEXT_FIELD_CHARS),
      baseContent: requireString(file.baseContent, "file.baseContent", MAX_CONTENT_INPUT_CHARS),
      proposedContent: requireString(
        file.proposedContent,
        "file.proposedContent",
        MAX_CONTENT_INPUT_CHARS
      )
    },
    hunk: {
      header: requireString(hunk.header, "hunk.header", MAX_TITLE_CHARS),
      oldStart: requireNumber(hunk.oldStart, "hunk.oldStart", 0, 1e7),
      oldLines: requireNumber(hunk.oldLines, "hunk.oldLines", 0, MAX_HUNK_LINES),
      newStart: requireNumber(hunk.newStart, "hunk.newStart", 0, 1e7),
      newLines: requireNumber(hunk.newLines, "hunk.newLines", 0, MAX_HUNK_LINES),
      lines
    }
  };
}
function truncate(text, maxChars) {
  if (text.length <= maxChars) return { text, truncated: false };
  const omitted = text.length - maxChars;
  return {
    text: `${text.slice(0, maxChars)}
[... ${omitted.toLocaleString()} characters omitted from context ...]`,
    truncated: true
  };
}
function formatUnifiedHunk(input, truncated) {
  const rendered = input.hunk.lines.map((line) => {
    const marker = line.type === "added" ? "+" : line.type === "deleted" ? "-" : " ";
    const oldNo = line.oldLineNumber === null ? "" : String(line.oldLineNumber);
    const newNo = line.newLineNumber === null ? "" : String(line.newLineNumber);
    return `${oldNo.padStart(4)} ${newNo.padStart(4)} ${marker} ${line.content}`;
  });
  return [
    `Hunk header: ${input.hunk.header}`,
    `Base lines ${input.hunk.oldStart}\u2013${input.hunk.oldStart + Math.max(0, input.hunk.oldLines - 1)}, proposed lines ${input.hunk.newStart}\u2013${input.hunk.newStart + Math.max(0, input.hunk.newLines - 1)}.`,
    truncated ? "Note: long hunk lines were truncated before sending." : "",
    rendered.join("\n")
  ].filter(Boolean).join("\n");
}
function buildModelPrompt(input) {
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
    "You are a senior code reviewer analysing a pull request diff.",
    "Use ONLY the supplied diff hunk and file contents. Do not invent files, behaviour, dependencies, or runtime configuration that are not shown.",
    "If the evidence is insufficient for a claim, say so explicitly instead of guessing.",
    "Cite concrete file paths and line numbers from the supplied context.",
    "Return plain text (no Markdown headings, no JSON) in exactly three short sections:",
    "1. What changed",
    "2. Why it matters",
    "3. Review focus",
    "Keep the entire answer under 220 words."
  ].join("\n");
  const user = [
    `Pull request #${input.pullRequest.number}: ${input.pullRequest.title}`,
    `Repository: ${input.pullRequest.repository}`,
    `Branches: ${input.pullRequest.sourceBranch} \u2192 ${input.pullRequest.targetBranch}`,
    `Author: ${input.pullRequest.author}`,
    `PR overview: ${input.pullRequest.overview}`,
    `PR purpose: ${input.pullRequest.purpose}`,
    "",
    `File: ${input.file.path} (${input.file.language})`,
    `File summary: ${input.file.summary}`,
    "",
    "--- CHANGED HUNK (exact unified diff) ---",
    hunkText,
    "",
    "--- FULL PROPOSED FILE (context) ---",
    proposed.text,
    "",
    "--- FULL BASE FILE (context) ---",
    base.text
  ].join("\n");
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    truncated
  };
}
function extractMessageText(response) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => part && typeof part.text === "string" ? part.text : "").join("").trim();
  }
  return "";
}
async function readProviderError(response) {
  try {
    const text = (await response.text()).slice(0, 2e3);
    try {
      const parsed = JSON.parse(text);
      if (parsed.error && typeof parsed.error.message === "string") {
        return parsed.error.message.slice(0, 500);
      }
    } catch {
    }
    return text.slice(0, 500);
  } catch {
    return "";
  }
}
function mapProviderHttpError(status, providerMessage) {
  if (status === 401 || status === 403) {
    return new ModelError(
      "upstream_auth",
      "The configured model credential was rejected by the provider. Check MODEL_API_KEY.",
      502,
      false
    );
  }
  if (status === 429) {
    return new ModelError(
      "upstream_rate_limited",
      "The model provider is rate limiting requests. Wait a moment and retry.",
      429,
      true
    );
  }
  if (status === 402) {
    return new ModelError(
      "upstream_quota",
      "The model provider account has insufficient credits for this request.",
      502,
      false
    );
  }
  if (status === 400 || status === 404) {
    return new ModelError(
      "upstream_bad_request",
      `The model provider rejected the request${providerMessage ? `: ${providerMessage}` : "."}`,
      502,
      false
    );
  }
  return new ModelError(
    "upstream_error",
    `The model provider returned HTTP ${status}. Retry in a moment.`,
    502,
    true
  );
}
async function callModelChat(messages, config = getModelConfig(), options = {}) {
  if (!config.apiKey) {
    throw new ModelError(
      "not_configured",
      "No server-side model credential is configured. Set MODEL_API_KEY in .env and restart the API server.",
      503,
      false
    );
  }
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...config.baseUrl.includes("openrouter.ai") ? {
          "HTTP-Referer": readEnv("MODEL_APP_URL") || "http://localhost:3000",
          "X-Title": readEnv("MODEL_APP_NAME") || "Gitvox"
        } : {}
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
        max_tokens: options.maxOutputTokens ?? config.maxOutputTokens,
        stream: false
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw mapProviderHttpError(response.status, await readProviderError(response));
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ModelError(
        "invalid_upstream_response",
        "The model provider returned a response that could not be parsed.",
        502,
        true
      );
    }
    const text = extractMessageText(payload);
    if (!text) {
      throw new ModelError(
        "empty_response",
        "The model returned no explanation text. Retry to generate a new response.",
        502,
        true
      );
    }
    return {
      text,
      model: payload.model || config.model,
      provider: config.providerLabel,
      usage: payload.usage ? {
        promptTokens: payload.usage.prompt_tokens,
        completionTokens: payload.usage.completion_tokens,
        totalTokens: payload.usage.total_tokens
      } : void 0,
      latencyMs: Date.now() - startedAt,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    if (error instanceof ModelError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelError(
        "model_timeout",
        `The model did not respond within ${Math.round(config.timeoutMs / 1e3)} seconds. Retry the explanation.`,
        504,
        true
      );
    }
    throw new ModelError(
      "model_unreachable",
      "Gitvox could not reach the configured model endpoint. Check the server logs and MODEL_BASE_URL.",
      502,
      true
    );
  } finally {
    clearTimeout(timeout);
  }
}
async function requestModelExplanation(input, config = getModelConfig(), deps = {}) {
  const { messages, truncated } = buildModelPrompt(input);
  const result = await callModelChat(messages, config, deps);
  return { ...result, truncatedContext: truncated };
}

// server/assistantClient.ts
var MAX_TRANSCRIPT_CHARS = 2e3;
var MAX_TEXT_FIELD_CHARS2 = 4e3;
var MAX_CONTENT_INPUT_CHARS2 = 2e5;
var MAX_PR_FILES = 12;
var MAX_PROJECT_FILES = 200;
var MAX_FUNCTIONS = 100;
var PR_CONTENT_CHARS = 7e3;
var FILE_CONTENT_CHARS = 2e4;
var RANGE_CONTENT_CHARS = 16e3;
var ASSISTANT_MAX_OUTPUT_TOKENS = 1400;
var ACTIONS = [
  "explain-pr",
  "summarize-pr",
  "explain-file",
  "explain-range",
  "explain-function",
  "check-pr-errors",
  "check-security",
  "check-file-errors",
  "ask-repo"
];
function requireRecord2(value, field) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ModelError("invalid_request", `Field "${field}" must be an object.`, 400, false);
  }
  return value;
}
function requireString2(value, field, maxChars, allowEmpty = false) {
  if (typeof value !== "string" || !allowEmpty && value.trim().length === 0) {
    throw new ModelError(
      "invalid_request",
      `Field "${field}" must be a ${allowEmpty ? "" : "non-empty "}string.`,
      400,
      false
    );
  }
  if (value.length > maxChars) {
    throw new ModelError(
      "invalid_request",
      `Field "${field}" exceeds the ${maxChars.toLocaleString()} character limit.`,
      400,
      false
    );
  }
  return value;
}
function requireNumber2(value, field, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new ModelError(
      "invalid_request",
      `Field "${field}" must be a number between ${min} and ${max}.`,
      400,
      false
    );
  }
  return value;
}
function optionalArray(value, field, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ModelError(
      "invalid_request",
      `Field "${field}" must be an array with at most ${maxItems} items.`,
      400,
      false
    );
  }
  return value;
}
function validatePrFile(rawFile, index) {
  const file = requireRecord2(rawFile, `pullRequest.files[${index}]`);
  return {
    path: requireString2(file.path, `pullRequest.files[${index}].path`, 500),
    language: requireString2(file.language, `pullRequest.files[${index}].language`, 100),
    summary: requireString2(file.summary, `pullRequest.files[${index}].summary`, MAX_TEXT_FIELD_CHARS2),
    baseContent: requireString2(
      file.baseContent,
      `pullRequest.files[${index}].baseContent`,
      MAX_CONTENT_INPUT_CHARS2,
      true
    ),
    proposedContent: requireString2(
      file.proposedContent,
      `pullRequest.files[${index}].proposedContent`,
      MAX_CONTENT_INPUT_CHARS2,
      true
    ),
    additions: requireNumber2(file.additions, `pullRequest.files[${index}].additions`, 0, 1e6),
    deletions: requireNumber2(file.deletions, `pullRequest.files[${index}].deletions`, 0, 1e6)
  };
}
function validateProject(rawProject) {
  const project = requireRecord2(rawProject, "project");
  const rawFiles = optionalArray(project.files, "project.files", MAX_PROJECT_FILES);
  return {
    name: requireString2(project.name, "project.name", 500),
    description: requireString2(project.description, "project.description", MAX_TEXT_FIELD_CHARS2, true),
    files: rawFiles.map((rawFile, index) => {
      const file = requireRecord2(rawFile, `project.files[${index}]`);
      return {
        path: requireString2(file.path, `project.files[${index}].path`, 500),
        language: requireString2(file.language, `project.files[${index}].language`, 100)
      };
    })
  };
}
function validateFile(rawFile) {
  const file = requireRecord2(rawFile, "file");
  const rawFunctions = Array.isArray(file.functions) ? optionalArray(file.functions, "file.functions", MAX_FUNCTIONS) : [];
  return {
    path: requireString2(file.path, "file.path", 500),
    language: requireString2(file.language, "file.language", 100),
    summary: requireString2(file.summary, "file.summary", MAX_TEXT_FIELD_CHARS2, true),
    content: requireString2(file.content, "file.content", MAX_CONTENT_INPUT_CHARS2, true),
    functions: rawFunctions.map((rawFunction, index) => {
      const fn = requireRecord2(rawFunction, `file.functions[${index}]`);
      return {
        name: requireString2(fn.name, `file.functions[${index}].name`, 300),
        signature: requireString2(fn.signature, `file.functions[${index}].signature`, 1e3),
        summary: requireString2(fn.summary, `file.functions[${index}].summary`, MAX_TEXT_FIELD_CHARS2, true),
        startLine: requireNumber2(fn.startLine, `file.functions[${index}].startLine`, 1, 1e6),
        endLine: requireNumber2(fn.endLine, `file.functions[${index}].endLine`, 1, 1e6)
      };
    })
  };
}
function validateAssistantRequest(raw) {
  const body = requireRecord2(raw, "body");
  const actionRaw = requireString2(body.action, "action", 100);
  if (!ACTIONS.includes(actionRaw)) {
    throw new ModelError("invalid_request", `Unsupported assistant action "${actionRaw}".`, 400, false);
  }
  const action = actionRaw;
  const transcript = body.transcript === void 0 ? "" : requireString2(body.transcript, "transcript", MAX_TRANSCRIPT_CHARS, true);
  const request = { action, transcript };
  if (body.pullRequest !== void 0) {
    const pr = requireRecord2(body.pullRequest, "pullRequest");
    const rawFiles = optionalArray(pr.files, "pullRequest.files", MAX_PR_FILES);
    if (rawFiles.length === 0) {
      throw new ModelError("invalid_request", "pullRequest.files must contain at least one file.", 400, false);
    }
    request.pullRequest = {
      number: requireNumber2(pr.number, "pullRequest.number", 1, 1e7),
      title: requireString2(pr.title, "pullRequest.title", 500),
      repository: requireString2(pr.repository, "pullRequest.repository", 500),
      author: requireString2(pr.author, "pullRequest.author", 500),
      sourceBranch: requireString2(pr.sourceBranch, "pullRequest.sourceBranch", 500),
      targetBranch: requireString2(pr.targetBranch, "pullRequest.targetBranch", 500),
      overview: requireString2(pr.overview, "pullRequest.overview", MAX_TEXT_FIELD_CHARS2),
      purpose: requireString2(pr.purpose, "pullRequest.purpose", MAX_TEXT_FIELD_CHARS2),
      files: rawFiles.map(validatePrFile)
    };
  }
  if (body.project !== void 0) {
    request.project = validateProject(body.project);
  }
  if (body.file !== void 0) {
    request.file = validateFile(body.file);
  }
  if (body.range !== void 0) {
    const range = requireRecord2(body.range, "range");
    const startLine = requireNumber2(range.startLine, "range.startLine", 1, 1e7);
    const endLine = requireNumber2(range.endLine, "range.endLine", 1, 1e7);
    request.range = startLine <= endLine ? { startLine, endLine } : { startLine: endLine, endLine: startLine };
  }
  if (body.function !== void 0) {
    const fn = requireRecord2(body.function, "function");
    request.function = {
      name: requireString2(fn.name, "function.name", 300),
      startLine: requireNumber2(fn.startLine, "function.startLine", 1, 1e7),
      endLine: requireNumber2(fn.endLine, "function.endLine", 1, 1e7)
    };
  }
  if ((action === "explain-pr" || action === "summarize-pr" || action === "check-pr-errors") && !request.pullRequest) {
    throw new ModelError("invalid_request", "A pull-request context is required for this action.", 400, false);
  }
  if (action === "explain-file" && !request.file) {
    throw new ModelError("invalid_request", "A file context is required for this action.", 400, false);
  }
  if (action === "check-file-errors" && !request.file) {
    throw new ModelError("invalid_request", "A file context is required for this action.", 400, false);
  }
  if (action === "explain-range" && (!request.file || !request.range)) {
    throw new ModelError("invalid_request", "File and range contexts are required for this action.", 400, false);
  }
  if (action === "explain-function" && (!request.file || !request.function)) {
    throw new ModelError(
      "invalid_request",
      "File and function contexts are required for this action.",
      400,
      false
    );
  }
  if (action === "check-security" && !request.pullRequest && !request.file) {
    throw new ModelError("invalid_request", "Pull-request or file context is required for security checks.", 400, false);
  }
  return request;
}
function truncate2(text, maxChars) {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}
[... ${(text.length - maxChars).toLocaleString()} characters omitted ...]`,
    truncated: true
  };
}
function numberedContent(content, startLine, endLine, maxChars) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const clampedStart = Math.min(Math.max(startLine, 1), Math.max(1, lines.length));
  const clampedEnd = Math.min(Math.max(endLine, clampedStart), Math.max(1, lines.length));
  const rendered = lines.slice(clampedStart - 1, clampedEnd).map((line, index) => `${clampedStart + index}: ${line}`).join("\n");
  return truncate2(rendered, maxChars);
}
function formatFunctionMap(file, selectedName) {
  if (file.functions.length === 0) return "No function boundaries were supplied for this file.";
  const lines = file.functions.slice(0, 40).map((fn) => {
    const marker = selectedName && fn.name === selectedName ? " (selected)" : "";
    return `- ${fn.name}${marker} \xB7 L${fn.startLine}\u2013L${fn.endLine} \xB7 ${fn.signature} \u2014 ${fn.summary}`;
  });
  if (file.functions.length > 40) {
    lines.push(`- ... ${file.functions.length - 40} additional functions omitted`);
  }
  return lines.join("\n");
}
function actionInstruction(action) {
  switch (action) {
    case "explain-pr":
      return [
        "Explain this pull request in depth. Cover:",
        "1. The overall purpose and approach.",
        "2. Each important changed file (one bullet per file, with the path) and how the changes connect.",
        "3. The implementation logic and data/control flow.",
        "4. Risks, security concerns, edge cases, and what a reviewer should verify.",
        "Aim for 450\u2013700 words. Use ## headings and bullet lists. Do not repeat the raw diff."
      ].join("\n");
    case "summarize-pr":
      return [
        "Summarize this pull request concisely but substantively (about 200\u2013350 words).",
        "Cover the objective, the main changed files as bullets, and the top risk or verification point.",
        "Use ## headings. Do not pad or repeat the full diff."
      ].join("\n");
    case "explain-file":
      return [
        "Explain the selected file for a developer who is new to it.",
        "Cover its purpose, the important functions and how control flows between them, key dependencies, and risks or edge cases.",
        "Cite concrete line ranges from the supplied functions. Aim for 300\u2013600 words. Use ## headings and bullets."
      ].join("\n");
    case "explain-range":
      return [
        "Explain exactly the selected line range and its role in the file.",
        "Cover what the code does, how it works step by step, important dependencies, and edge cases or failure modes.",
        "Quote 1\u20133 short relevant lines from the range with > blockquotes. Aim for 250\u2013500 words. Use ## headings."
      ].join("\n");
    case "explain-function":
      return [
        "Explain the selected function in detail.",
        "Cover its purpose, inputs and outputs, implementation logic, dependencies, and edge cases or failure modes.",
        "Cite the function line range. Aim for 250\u2013500 words. Use ## headings and bullets."
      ].join("\n");
    case "check-pr-errors":
      return [
        "Audit this pull request for bugs, errors, and breaking changes before merging or accepting.",
        "1. Verdict: state clearly whether this PR is Safe to Merge, Needs Changes, or Critical Issues Found.",
        "2. Potential Bugs & Logic Errors: identify logic flaws, type mismatches, unhandled null/undefined, race conditions, or broken state.",
        "3. API/Breaking Changes: check if exported interfaces, route signatures, or database schemas break backwards compatibility.",
        "4. Edge Cases & Missing Error Handling: list unhandled exceptions, network failures, timeouts, or invalid payloads.",
        "5. Recommended Fixes: provide specific, actionable code recommendations.",
        "Aim for 400\u2013650 words. Use ## headings, severity labels ([CRITICAL], [WARNING], [NOTE]), and quote suspect lines."
      ].join("\n");
    case "check-security":
      return [
        "Perform a comprehensive security audit on the supplied code and diffs.",
        "1. Security Posture Summary: overall risk assessment (Low, Medium, High, Critical).",
        "2. Vulnerability Scan: check for common vulnerabilities including:",
        "   - Hardcoded secrets, API keys, credentials, or tokens.",
        "   - Timing attacks (e.g. non-constant-time comparisons for HMAC/crypto hashes).",
        "   - Injection flaws (SQL, command, XSS, template injection, prototype pollution).",
        "   - Insecure token/session handling, missing signature checks, weak algorithm fallbacks.",
        "   - Insecure defaults, permissive CORS, path traversal, or privilege escalation.",
        "3. Concrete Findings: for each issue, specify the file, approximate line range, vulnerability type, and impact.",
        "4. Remediation Steps: provide the exact secure coding pattern to replace the vulnerable implementation.",
        "Aim for 400\u2013700 words. Use ## headings, severity tags, and short > blockquotes for code citations."
      ].join("\n");
    case "check-file-errors":
      return [
        "Inspect this file for bugs, harmful patterns, and edge-case errors.",
        "1. File Health: overall assessment of code quality and stability.",
        "2. Potential Bugs: identify logic errors, unhandled exceptions, resource leaks, or missing input validation.",
        "3. Harmful or Risky Patterns: highlight code that could cause crashes, infinite loops, memory leaks, or unhandled promise rejections.",
        "4. Concrete Line References: reference specific functions and line numbers for each issue identified.",
        "5. Corrective Action: suggest concrete improvements.",
        "Aim for 350\u2013600 words. Use ## headings and bullet points."
      ].join("\n");
    case "ask-repo":
      return [
        "Answer the user's repository question with precision using the supplied codebase, PR, and file context.",
        "Base your answer directly on the code and metadata provided. Cite specific files, functions, and lines where relevant.",
        "If the code does not provide enough evidence to answer fully, explicitly note what is missing.",
        "Aim for 200\u2013500 words. Use ## headings, bullet lists, and code citations."
      ].join("\n");
  }
}
function formatPrContext(pr) {
  let truncated = false;
  const parts = [
    `PR #${pr.number}: ${pr.title}`,
    `Repository: ${pr.repository}`,
    `Branches: ${pr.sourceBranch} \u2192 ${pr.targetBranch}`,
    `Author: ${pr.author}`,
    `Overview: ${pr.overview}`,
    `Purpose: ${pr.purpose}`,
    `Changed files: ${pr.files.length}`
  ];
  for (const file of pr.files) {
    const base = truncate2(file.baseContent, PR_CONTENT_CHARS);
    const proposed = truncate2(file.proposedContent, PR_CONTENT_CHARS);
    truncated = truncated || base.truncated || proposed.truncated;
    parts.push(
      "",
      `### FILE: ${file.path} (${file.language}) +${file.additions}/-${file.deletions}`,
      `Summary: ${file.summary}`,
      "--- BASE VERSION ---",
      base.text || "(empty file)",
      "--- PROPOSED VERSION ---",
      proposed.text || "(empty file)"
    );
  }
  return { text: parts.join("\n"), truncated };
}
function formatFileContext(file) {
  const numbered = numberedContent(file.content, 1, Number.MAX_SAFE_INTEGER, FILE_CONTENT_CHARS);
  return {
    text: [
      `File: ${file.path} (${file.language})`,
      `Summary: ${file.summary || "(none supplied)"}`,
      "",
      "--- FUNCTIONS ---",
      formatFunctionMap(file),
      "",
      "--- FILE CONTENT (line-numbered) ---",
      numbered.text || "(empty file)"
    ].join("\n"),
    truncated: numbered.truncated
  };
}
function formatRangeContext(file, range) {
  const lines = file.content.replace(/\r\n/g, "\n").split("\n");
  const start = Math.min(Math.max(range.startLine, 1), Math.max(1, lines.length));
  const end = Math.min(Math.max(range.endLine, start), Math.max(1, lines.length));
  const selected = numberedContent(file.content, start, end, 8e3);
  const context = numberedContent(file.content, 1, Number.MAX_SAFE_INTEGER, RANGE_CONTENT_CHARS);
  return {
    text: [
      `File: ${file.path} (${file.language})`,
      `Summary: ${file.summary || "(none supplied)"}`,
      `Selected range: L${start}\u2013L${end}`,
      "",
      "--- FUNCTIONS ---",
      formatFunctionMap(file),
      "",
      `--- SELECTED LINES L${start}\u2013L${end} ---`,
      selected.text,
      "",
      "--- FULL FILE CONTEXT (line-numbered) ---",
      context.text
    ].join("\n"),
    truncated: selected.truncated || context.truncated
  };
}
function formatFunctionContext(file, fn) {
  const matched = file.functions.find((candidate) => candidate.name === fn.name);
  const start = matched?.startLine ?? fn.startLine;
  const end = matched?.endLine ?? fn.endLine;
  const snippet = numberedContent(file.content, start, end, 8e3);
  const context = numberedContent(file.content, 1, Number.MAX_SAFE_INTEGER, RANGE_CONTENT_CHARS);
  return {
    text: [
      `File: ${file.path} (${file.language})`,
      `Summary: ${file.summary || "(none supplied)"}`,
      `Selected function: ${fn.name} \xB7 L${start}\u2013L${end}`,
      matched ? `Signature: ${matched.signature}` : "",
      matched ? `Function summary: ${matched.summary}` : "",
      "",
      "--- FUNCTIONS IN FILE ---",
      formatFunctionMap(file, fn.name),
      "",
      `--- SELECTED FUNCTION BODY L${start}\u2013L${end} ---`,
      snippet.text,
      "",
      "--- FULL FILE CONTEXT (line-numbered) ---",
      context.text
    ].filter(Boolean).join("\n"),
    truncated: snippet.truncated || context.truncated
  };
}
function buildAssistantPrompt(input) {
  const system = [
    "You are Gitvox, a senior software engineer, security researcher, and code reviewer.",
    "Answer ONLY from the supplied context. Never invent files, functions, dependencies, behavior, or risks.",
    "If the supplied context is insufficient, say so explicitly and explain what evidence is missing.",
    "Write a detailed, readable Markdown answer with ## headings, bullet lists, and short > blockquotes for code references.",
    "Do not output JSON. Do not mention prompts, tokens, or internal implementation details.",
    "",
    actionInstruction(input.action)
  ].join("\n");
  let contextText = "";
  let truncated = false;
  if (input.pullRequest) {
    const prContext = formatPrContext(input.pullRequest);
    contextText = prContext.text;
    truncated = prContext.truncated;
  }
  if (input.file) {
    const fileContext = input.action === "explain-range" && input.range ? formatRangeContext(input.file, input.range) : input.action === "explain-function" && input.function ? formatFunctionContext(input.file, input.function) : formatFileContext(input.file);
    contextText = [contextText, fileContext.text].filter(Boolean).join("\n\n");
    truncated = truncated || fileContext.truncated;
  }
  if (input.project) {
    const projectText = [
      `Project: ${input.project.name}`,
      input.project.description ? `Project description: ${input.project.description}` : "",
      "Project files:",
      ...input.project.files.slice(0, 80).map((file) => `- ${file.path} (${file.language})`),
      input.project.files.length > 80 ? `- ... ${input.project.files.length - 80} additional files omitted` : ""
    ].filter(Boolean).join("\n");
    contextText = [projectText, contextText].filter(Boolean).join("\n\n");
  }
  if (truncated) {
    contextText += "\n\n[... some context was truncated for length; base claims only on the supplied text ...]";
  }
  const user = [
    `Action: ${input.action}`,
    `Original user request: ${input.transcript || "(not supplied)"}`,
    "",
    "--- SUPPLIED CODE AND PR CONTEXT ---",
    contextText || "(no context supplied)"
  ].join("\n");
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    truncated
  };
}
async function requestAssistantExplanation(input, config = getModelConfig(), deps = {}) {
  const { messages, truncated } = buildAssistantPrompt(input);
  const result = await callModelChat(messages, config, {
    ...deps,
    maxOutputTokens: Math.max(config.maxOutputTokens, ASSISTANT_MAX_OUTPUT_TOKENS)
  });
  return { ...result, truncatedContext: truncated };
}

// server/api/_utils.ts
async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}
function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

// server/api/index.ts
async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return;
  }
  const url = req.url || "";
  try {
    if (url.includes("/status")) {
      sendJson(res, 200, getPublicModelStatus());
      return;
    }
    if (req.method === "POST") {
      const body = await parseJsonBody(req);
      const config = getModelConfig();
      if (url.includes("/assistant")) {
        const input2 = validateAssistantRequest(body);
        const explanation2 = await requestAssistantExplanation(input2, config);
        sendJson(res, 200, { explanation: explanation2 });
        return;
      }
      const input = validateExplainRequest(body);
      const explanation = await requestModelExplanation(input, config);
      sendJson(res, 200, { explanation });
      return;
    }
    sendJson(res, 200, getPublicModelStatus());
  } catch (error) {
    if (error instanceof ModelError) {
      sendJson(res, error.httpStatus, {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable
        }
      });
      return;
    }
    console.error("[api/index] Error:", error);
    sendJson(res, 500, {
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : "Gitvox serverless error",
        retryable: true
      }
    });
  }
}
export {
  handler as default
};
