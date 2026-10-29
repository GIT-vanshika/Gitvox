// server/modelClient.ts
var DEFAULT_MODEL_BASE_URL = "https://openrouter.ai/api/v1";
var DEFAULT_MODEL_NAME = "meta-llama/llama-3.3-70b-instruct:free";
var GEMINI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
var GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-lite";
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
