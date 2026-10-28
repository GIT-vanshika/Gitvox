import type { IncomingMessage, ServerResponse } from 'node:http';
import { getPublicModelStatus } from '../modelClient';
import { sendJson } from './_utils';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  sendJson(res, 200, getPublicModelStatus());
}
