import express from 'express';
import {
  ModelError,
  getModelConfig,
  getPublicModelStatus,
  requestModelExplanation,
  validateExplainRequest,
} from '../server/modelClient';
import {
  requestAssistantExplanation,
  validateAssistantRequest,
} from '../server/assistantClient';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/api/model/status', (_req, res) => {
  res.json(getPublicModelStatus());
});

app.post('/api/explain', async (req, res) => {
  try {
    const input = validateExplainRequest(req.body);
    const config = getModelConfig();
    const explanation = await requestModelExplanation(input, config);
    res.json({ explanation });
  } catch (error) {
    if (error instanceof ModelError) {
      res.status(error.httpStatus).json({
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      });
      return;
    }
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
  try {
    const input = validateAssistantRequest(req.body);
    const config = getModelConfig();
    const explanation = await requestAssistantExplanation(input, config);
    res.json({ explanation });
  } catch (error) {
    if (error instanceof ModelError) {
      res.status(error.httpStatus).json({
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      });
      return;
    }
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Gitvox could not process the assistant request.',
        retryable: true,
      },
    });
  }
});

export default app;
