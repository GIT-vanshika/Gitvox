// server/modelClient.ts
var DEFAULT_MODEL_BASE_URL = "https://openrouter.ai/api/v1";
var DEFAULT_MODEL_NAME = "qwen/qwen-2.5-coder-32b-instruct";
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

// server/api/_utils.ts
function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

// server/api/status.ts
async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return;
  }
  sendJson(res, 200, getPublicModelStatus());
}
export {
  handler as default
};
