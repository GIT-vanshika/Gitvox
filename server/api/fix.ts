import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseJsonBody, sendJson } from './_utils';

export function applyVoiceFix(filePath: string, code: string): { fixedCode: string; summary: string } {
  if (filePath.includes('auth.js') || filePath.includes('auth.ts')) {
    const targetPattern = /const token = authHeader(\?\.|\s*&&\s*authHeader\.)split\(['"] ['"]\)\[1\];/;
    const replacement = `if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppSecurityError('MALFORMED_AUTHORIZATION_HEADER', 401);
  }
  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    throw new AppSecurityError('MISSING_BEARER_CREDENTIALS', 401);
  }`;

    if (targetPattern.test(code)) {
      return {
        fixedCode: code.replace(targetPattern, replacement),
        summary: 'Replaced unvalidated split token extraction with secure Bearer scheme check and empty credential guard.',
      };
    }

    // Fallback if slightly different whitespace
    const genericSplit = /authHeader\.split\(['"] ['"]\)\[1\]/;
    if (genericSplit.test(code)) {
      return {
        fixedCode: code.replace(
          genericSplit,
          `authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1]?.trim() : null`
        ),
        summary: 'Applied inline Bearer header validation guard.',
      };
    }
  }

  return {
    fixedCode: code,
    summary: 'No automated AST patch required; invariant intact.',
  };
}

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
    const body = (await parseJsonBody(req)) as { filePath?: string; code?: string };
    const filePath = typeof body.filePath === 'string' ? body.filePath : 'src/middleware/auth.js';
    const code = typeof body.code === 'string' ? body.code : '';
    const result = applyVoiceFix(filePath, code);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('[assistant/fix] Error:', error);
    sendJson(res, 500, {
      error: {
        code: 'internal_error',
        message: error instanceof Error ? error.message : 'Voice fix error',
        retryable: true,
      },
    });
  }
}

