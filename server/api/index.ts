import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getModelConfig,
  getPublicModelStatus,
  ModelError,
  requestModelExplanation,
  validateExplainRequest,
} from '../modelClient';
import {
  requestAssistantExplanation,
  validateAssistantRequest,
} from '../assistantClient';
import { parseJsonBody, sendJson } from './_utils';

export default async function handler(
  req: IncomingMessage & { body?: unknown; query?: Record<string, string> },
  res: ServerResponse
) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  const url = req.url || '';

  try {
    if (url.includes('/status')) {
      sendJson(res, 200, getPublicModelStatus());
      return;
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      const config = getModelConfig();

      if (url.includes('/assistant')) {
        const input = validateAssistantRequest(body);
        const explanation = await requestAssistantExplanation(input, config);
        sendJson(res, 200, { explanation });
        return;
      }

      // Default hunk explain
      const input = validateExplainRequest(body);
      const explanation = await requestModelExplanation(input, config);
      sendJson(res, 200, { explanation });
      return;
    }

    // Default status if GET
    sendJson(res, 200, getPublicModelStatus());
  } catch (error) {
    if (error instanceof ModelError) {
      sendJson(res, error.httpStatus, {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      });
      return;
    }

    console.error('[api/index] Error:', error);
    sendJson(res, 500, {
      error: {
        code: 'internal_error',
        message: error instanceof Error ? error.message : 'Gitvox serverless error',
        retryable: true,
      },
    });
  }
}
