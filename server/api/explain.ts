import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getModelConfig,
  ModelError,
  requestModelExplanation,
  validateExplainRequest,
} from '../modelClient';
import { parseJsonBody, sendJson } from './_utils';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
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

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed' } });
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
          retryable: error.retryable,
        },
      });
      return;
    }

    console.error('[explain] Error:', error);
    sendJson(res, 500, {
      error: {
        code: 'internal_error',
        message: error instanceof Error ? error.message : 'Explain request error',
        retryable: true,
      },
    });
  }
}
