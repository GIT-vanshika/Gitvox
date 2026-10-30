import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSpeechText,
  extractSpokenSummary,
  splitIntoSpeechChunks,
} from './speechSynthesisService';

describe('speechSynthesisService', () => {
  it('cleanSpeechText strips markdown formatting, code fences, and backticks', () => {
    const markdown = '### Title\nHere is `const x = 1;` with **bold** and [link](http://example.com).\n```ts\ncode block\n```';
    const cleaned = cleanSpeechText(markdown);
    assert.ok(!cleaned.includes('#'));
    assert.ok(!cleaned.includes('```'));
    assert.ok(!cleaned.includes('**'));
    assert.ok(cleaned.includes('const x = 1;'));
    assert.ok(cleaned.includes('link'));
  });

  it('splitIntoSpeechChunks splits on sentence boundaries and preserves complete words', () => {
    const text = 'First sentence is here. Second sentence is also here. Third sentence wraps up the chunk.';
    const chunks = splitIntoSpeechChunks(text);
    assert.ok(chunks.length >= 1);
    // Ensure all chunks contain full words
    for (const chunk of chunks) {
      assert.ok(!chunk.endsWith(' '));
      assert.ok(chunk.length <= 180);
    }
  });

  it('extractSpokenSummary extracts a concise 1-2 sentence spoken synopsis from rich markdown', () => {
    const markdown = `
# Summary · PR #284
Overall Purpose and Approach
Pull Request #284 migrates the API route protection layer from legacy static API keys to HMAC-SHA256 bearer tokens.

### Changed Files and Connections
- src/middleware/auth.js: Wires the new auth middleware.
- src/services/tokenService.js: Issues and verifies tokens.
    `.trim();

    const summary = extractSpokenSummary('Summary · PR #284', markdown);
    assert.ok(summary.startsWith('Summary: Pull Request #284 migrates'));
    assert.ok(!summary.includes('###'));
    assert.ok(!summary.includes('- src/middleware/auth.js'));
  });

  it('extractSpokenSummary handles QA answers gracefully without cutoffs', () => {
    const qa = `
Repository Q&A
Understanding the "Fear" Behind the Token-Auth Migration
The PR titled "Add token-based authentication middleware" is driven by a set of security concerns that developers often describe as fear. In plain terms, the fear is that the existing static API key leaves the API vulnerable.
    `.trim();

    const summary = extractSpokenSummary('Q&A', qa);
    assert.ok(summary.includes('The PR titled "Add token-based authentication middleware" is driven by a set of security concerns'));
  });
});
