// server/modelClient.ts
var DEFAULT_MODEL_BASE_URL = "https://openrouter.ai/api/v1";
var DEFAULT_MODEL_NAME = "meta-llama/llama-3.3-70b-instruct:free";
var OPENROUTER_MODEL_CASCADE = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "cohere/north-mini-code:free"
];
var GEMINI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
var GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-lite";
var GEMINI_MODEL_CASCADE = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash"
];
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
function normalizeKey(k) {
  return k.toLowerCase().replace(/[\s_\-.]+/g, "");
}
function readEnv(name) {
  const direct = process.env[name];
  if (direct && direct.trim().length > 0) return direct.trim();
  const targetNormalized = normalizeKey(name);
  for (const [key, value] of Object.entries(process.env)) {
    if (normalizeKey(key) === targetNormalized && value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return void 0;
}
function getModelConfig() {
  const openRouterKey = readEnv("OPENROUTER_API_KEY") || readEnv("MODEL_API_KEY") || (process.env.MODEL_API_KEY?.startsWith("sk-or-") ? process.env.MODEL_API_KEY : void 0);
  let geminiKey = readEnv("GEMINI_API_KEY");
  if (!geminiKey) {
    for (const [key, val] of Object.entries(process.env)) {
      const norm = normalizeKey(key);
      if (norm.includes("gemini") && (norm.includes("key") || norm.includes("token") || norm.includes("secret"))) {
        if (val && val.trim().length > 0) {
          geminiKey = val.trim();
          break;
        }
      }
    }
  }
  const hasOpenRouterKey = Boolean(openRouterKey && openRouterKey.startsWith("sk-or-"));
  const explicitOpenRouterUrl = (readEnv("MODEL_BASE_URL") || "").includes("openrouter.ai");
  const isGemini = !hasOpenRouterKey && !explicitOpenRouterUrl && (Boolean(geminiKey) || (readEnv("MODEL_BASE_URL") || "").includes("generativelanguage.googleapis.com") || (readEnv("MODEL_NAME") || "").toLowerCase().startsWith("gemini"));
  const apiKey = hasOpenRouterKey ? openRouterKey : geminiKey || openRouterKey || null;
  let defaultBaseUrl = DEFAULT_MODEL_BASE_URL;
  let defaultModelName = DEFAULT_MODEL_NAME;
  if (isGemini) {
    defaultBaseUrl = GEMINI_DEFAULT_BASE_URL;
    defaultModelName = GEMINI_DEFAULT_MODEL;
  }
  const baseUrl = (readEnv("MODEL_BASE_URL") || defaultBaseUrl).replace(/\/+$/, "");
  const timeoutMs = Number(readEnv("MODEL_TIMEOUT_MS") || 45e3);
  const maxOutputTokens = Number(readEnv("MODEL_MAX_OUTPUT_TOKENS") || 3e3);
  return {
    apiKey,
    baseUrl,
    model: readEnv("MODEL_NAME") || defaultModelName,
    providerLabel: readEnv("MODEL_PROVIDER_LABEL") || (baseUrl.includes("googleapis.com") ? "Google Gemini" : baseUrl.includes("openrouter.ai") ? "OpenRouter" : "OpenAI-compatible"),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 1e3 ? timeoutMs : 45e3,
    maxOutputTokens: Number.isFinite(maxOutputTokens) && maxOutputTokens >= 64 ? Math.min(maxOutputTokens, 8e3) : 3e3
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
  const choice = response.choices?.[0];
  const message = choice?.message;
  const content = message?.content;
  if (typeof content === "string" && content.trim().length > 0) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part) => part && typeof part.text === "string" ? part.text : "").join("").trim();
    if (text.length > 0) return text;
  }
  const reasoning = message?.reasoning;
  if (typeof reasoning === "string" && reasoning.trim().length > 0) {
    return reasoning.trim();
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
    const isQuota = providerMessage.toLowerCase().includes("quota") || providerMessage.toLowerCase().includes("exceeded");
    return new ModelError(
      "upstream_rate_limited",
      isQuota ? "Gemini API free tier quota limit reached (20 requests/day). Please try again tomorrow, switch models, or use a new Gemini key." : "The model provider is rate limiting requests. Wait a moment and retry.",
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
    const requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...config.baseUrl.includes("openrouter.ai") ? {
        "HTTP-Referer": readEnv("MODEL_APP_URL") || "http://localhost:3000",
        "X-Title": readEnv("MODEL_APP_NAME") || "Gitvox"
      } : {}
    };
    let activeModel = config.model;
    let response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        model: activeModel,
        messages,
        temperature: 0.3,
        max_tokens: options.maxOutputTokens ?? config.maxOutputTokens,
        stream: false
      }),
      signal: controller.signal
    });
    if (!response.ok && (response.status === 429 || response.status === 503 || response.status === 500 || response.status === 502 || response.status === 504 || response.status === 404)) {
      const isGeminiProvider = config.baseUrl.includes("googleapis.com");
      const cascadeList = isGeminiProvider ? GEMINI_MODEL_CASCADE : OPENROUTER_MODEL_CASCADE;
      const remainingModels = cascadeList.filter((m) => m !== activeModel);
      for (const fallbackModel of remainingModels) {
        console.warn(`[model] ${activeModel} returned HTTP ${response.status}. Retrying with fallback model ${fallbackModel}...`);
        try {
          const fallbackResponse = await fetchImpl(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify({
              model: fallbackModel,
              messages,
              temperature: 0.3,
              max_tokens: options.maxOutputTokens ?? config.maxOutputTokens,
              stream: false
            }),
            signal: controller.signal
          });
          if (fallbackResponse.ok) {
            response = fallbackResponse;
            activeModel = fallbackModel;
            break;
          }
        } catch {
        }
      }
    }
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
      model: payload.model || activeModel || config.model,
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

// server/api/explain.ts
async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: { code: "method_not_allowed", message: "Method not allowed" } });
    return;
  }
  try {
    const body = await parseJsonBody(req);
    const input = validateExplainRequest(body);
    const config = getModelConfig();
    const explanation = await requestModelExplanation(input, config);
    sendJson(res, 200, { explanation });
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
    console.error("[explain] Error:", error);
    sendJson(res, 500, {
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : "Explain request error",
        retryable: true
      }
    });
  }
}
export {
  handler as default
};
