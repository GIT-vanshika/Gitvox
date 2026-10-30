import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSpokenSummary } from './speechSynthesisService';

test('extractSpokenSummary extracts concise opening sentences and excludes code and tables', () => {
  const markdown = `
# Understanding the “Fear” Behind the Token‑Auth Migration
The PR titled “Add token‑based authentication middleware” is driven by a set of security‑related concerns that developers often describe as “fear.” In plain terms, the fear is the anxiety that the existing static \`x‑api‑key\` approach leaves the API vulnerable and that a shift to modern, signed tokens could break existing clients. The changes in the repository are a concrete response to those fears, providing stronger guarantees while keeping the error surface familiar.

Below is a breakdown of the primary fears addressed by each file change, with direct references to the code.

\`\`\`javascript
const token = extractBearerToken(req.headers.authorization);
\`\`\`

| Feature | Old | New |
| --- | --- | --- |
| Auth | Static | Bearer |
  `.trim();

  const summary = extractSpokenSummary(markdown);
  assert.ok(summary.length > 20, 'Should extract non-empty summary');
  assert.ok(summary.length < 350, 'Should keep spoken summary concise');
  assert.ok(!summary.includes('```'), 'Must not include code blocks');
  assert.ok(!summary.includes('|'), 'Must not include markdown table pipes');
  assert.ok(summary.includes('Add token'), 'Should contain main subject');
});

test('extractSpokenSummary handles simple text cleanly', () => {
  const simple = 'PR #284 adds token-based authentication middleware across five changed files.';
  const summary = extractSpokenSummary(simple);
  assert.equal(summary, simple);
});
