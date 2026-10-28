import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('api/model', { recursive: true });
mkdirSync('api/assistant', { recursive: true });

const commonOptions = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  target: 'node18',
};

await Promise.all([
  build({
    ...commonOptions,
    entryPoints: ['server/api/status.ts'],
    outfile: 'api/model/status.js',
  }),
  build({
    ...commonOptions,
    entryPoints: ['server/api/assistant.ts'],
    outfile: 'api/assistant/explain.js',
  }),
  build({
    ...commonOptions,
    entryPoints: ['server/api/fix.ts'],
    outfile: 'api/assistant/fix.js',
  }),
  build({
    ...commonOptions,
    entryPoints: ['server/api/fix.ts'],
    outfile: 'api/fix.js',
  }),
  build({
    ...commonOptions,
    entryPoints: ['server/api/explain.ts'],
    outfile: 'api/explain.js',
  }),
  build({
    ...commonOptions,
    entryPoints: ['server/api/index.ts'],
    outfile: 'api/index.js',
  }),
]);

console.log('✓ Successfully bundled Vercel serverless API handlers into api/*.js');

