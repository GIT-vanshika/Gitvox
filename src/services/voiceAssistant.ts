import type { ModelErrorInfo, ModelExplanation } from '../types/gitvox';

export type VoiceRequestResult =
  | { kind: 'answer'; title: string; explanation: ModelExplanation }
  | { kind: 'clarification'; message: string }
  | { kind: 'error'; message: string; retryable: boolean };

/** User-facing wording for model failures; never includes internal details. */
export function friendlyAssistantError(info: ModelErrorInfo): string {
  switch (info.code) {
    case 'not_configured':
      return 'The AI model is not configured on the server yet. Add MODEL_API_KEY and try again.';
    case 'rate_limited':
    case 'upstream_rate_limited':
      return 'The AI model is busy right now. Wait a moment and try again.';
    case 'model_timeout':
    case 'client_timeout':
      return 'The explanation took too long. Please try again.';
    case 'network_error':
    case 'model_unreachable':
      return 'I could not reach the explanation service. Check the connection and retry.';
    case 'empty_response':
    case 'invalid_model_response':
      return 'The model returned an empty answer. Please try again.';
    case 'upstream_auth':
      return 'The AI model credentials were rejected. Check the server configuration.';
    default:
      return 'I could not generate an explanation. Please try again.';
  }
}