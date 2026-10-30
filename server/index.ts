import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ModelError,
  getModelConfig,
  getPublicModelStatus,
  requestModelExplanation,
  validateExplainRequest,
} from './modelClient';
import {
  requestAssistantExplanation,
  validateAssistantRequest,
} from './assistantClient';

const here = path.dirname(fileURLToPath(import.meta.url));
// In dev this file runs from server/, while the esbuild bundle runs from the
// repository root. Resolve the project root from whichever directory owns dist/.
const projectRoot = existsSync(path.join(here, 'dist', 'index.html'))
  ? here
  : path.resolve(here, '..');
const distDir = path.join(projectRoot, 'dist');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(key, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(key, recent);
  return false;
}

import {
  parseGitHubPrUrl,
  parseGitPatchToPullRequest,
} from '../src/services/gitHubPrService';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.get('/api/model/status', (_req, res) => {
  res.json(getPublicModelStatus());
});

app.post('/api/github/pr', async (req, res) => {
  const url = req.body?.url;
  const coords = parseGitHubPrUrl(url);
  if (!coords) {
    res.status(400).json({ error: { message: 'Invalid GitHub PR URL. Provide a link like https://github.com/owner/repo/pull/123' } });
    return;
  }

  try {
    const rawPatchUrl = `https://patch-diff.githubusercontent.com/raw/${coords.owner}/${coords.repo}/pull/${coords.pullNumber}.patch`;
    const patchRes = await fetch(rawPatchUrl, {
      headers: { 'User-Agent': 'Gitvox' },
    });

    if (!patchRes.ok) {
      res.status(patchRes.status).json({
        error: { message: `GitHub returned HTTP ${patchRes.status} for PR #${coords.pullNumber}` },
      });
      return;
    }

    const patchText = await patchRes.text();
    const pullRequest = parseGitPatchToPullRequest(patchText, coords);
    res.json({ pullRequest });
  } catch (error) {
    console.error('[server/github] Error fetching PR:', error);
    res.status(500).json({
      error: { message: error instanceof Error ? error.message : 'Could not fetch GitHub PR' },
    });
  }
});

app.post('/api/explain', async (req, res) => {
  const requestKey = req.ip || 'unknown';
  if (isRateLimited(requestKey)) {
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many explanation requests. Wait a minute and try again.',
        retryable: true,
      },
    });
    return;
  }

  const startedAt = Date.now();
  try {
    const input = validateExplainRequest(req.body);
    const config = getModelConfig();
    const explanation = await requestModelExplanation(input, config);
    const { truncatedContext, ...publicExplanation } = explanation;

    console.log(
      `[model] ${input.file.path} ${input.hunk.header} -> ${publicExplanation.model} ` +
        `${Date.now() - startedAt}ms tokens=${publicExplanation.usage?.totalTokens ?? 'n/a'}` +
        `${truncatedContext ? ' (context truncated)' : ''}`
    );

    res.json({ explanation: { ...publicExplanation, truncatedContext } });
  } catch (error) {
    if (error instanceof ModelError) {
      console.warn(
        `[model] ${error.code} status=${error.httpStatus} ${error.message}`
      );
      res.status(error.httpStatus).json({
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      });
      return;
    }

    console.error('[model] unexpected error', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Gitvox could not process the explanation request.',
        retryable: true,
      },
    });
  }
});

app.post('/api/assistant/explain', async (req, res) => {
  const requestKey = req.ip || 'unknown';
  if (isRateLimited(requestKey)) {
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many explanation requests. Wait a minute and try again.',
        retryable: true,
      },
    });
    return;
  }

  const startedAt = Date.now();
  try {
    const input = validateAssistantRequest(req.body);
    const config = getModelConfig();
    const explanation = await requestAssistantExplanation(input, config);
    const { truncatedContext, ...publicExplanation } = explanation;

    console.log(
      `[assistant] ${input.action} ${input.file?.path ?? input.pullRequest?.repository ?? 'context'} ` +
        `-> ${publicExplanation.model} ${Date.now() - startedAt}ms ` +
        `tokens=${publicExplanation.usage?.totalTokens ?? 'n/a'}` +
        `${truncatedContext ? ' (context truncated)' : ''}`
    );

    res.json({ explanation: { ...publicExplanation, truncatedContext } });
  } catch (error) {
    if (error instanceof ModelError) {
      console.warn(`[assistant] ${error.code} status=${error.httpStatus} ${error.message}`);
      res.status(error.httpStatus).json({
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      });
      return;
    }

    console.error('[assistant] unexpected error', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Gitvox could not process the assistant request.',
        retryable: true,
      },
    });
  }
});

app.post(['/api/fix', '/api/assistant/fix'], async (req, res) => {
  try {
    const { applyVoiceFix } = await import('./api/fix');
    const filePath = typeof req.body?.filePath === 'string' ? req.body.filePath : 'src/middleware/auth.js';
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const result = applyVoiceFix(filePath, code);
    res.json(result);
  } catch (error) {
    console.error('[assistant/fix] error', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Could not apply voice fix',
        retryable: true,
      },
    });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: 'Unknown Gitvox API route.',
      retryable: false,
    },
  });
});
if (existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
      res.status(413).json({
        error: {
          code: 'payload_too_large',
          message: 'The explanation payload exceeds the 1 MB limit.',
          retryable: false,
        },
      });
      return;
    }
    console.error('[server] unhandled error', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Gitvox server error.',
        retryable: true,
      },
    });
  }
);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    const status = getPublicModelStatus();
    console.log(
      `[gitvox] server listening on http://localhost:${PORT} · model=${status.model} ` +
        `(${status.providerLabel}) · ${status.configured ? 'credential configured' : 'MODEL_API_KEY missing'}`
    );
  });
}