import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAssistantMarkdown } from './assistantMarkdown';

test('parses headings, paragraphs, lists, quotes, code, and dividers', () => {
  const blocks = parseAssistantMarkdown(
    [
      '## Purpose',
      'This PR adds **token auth**.',
      '',
      '- auth.js verifies tokens',
      '- tokenService signs tokens',
      '',
      '1. Read the header',
      '2. Verify the signature',
      '',
      '> verifyAccessToken(token)',
      '',
      '```js',
      'const user = verifyAccessToken(token);',
      '```',
      '---',
      'Closing paragraph.',
    ].join('\n')
  );

  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[0].type === 'heading' ? blocks[0].level : 0, 2);
  assert.equal(blocks[1].type, 'paragraph');
  assert.equal(blocks[2].type, 'bullet-list');
  assert.deepEqual(blocks[2].type === 'bullet-list' ? blocks[2].items : [], [
    'auth.js verifies tokens',
    'tokenService signs tokens',
  ]);
  assert.equal(blocks[3].type, 'ordered-list');
  assert.equal(blocks[4].type, 'quote');
  assert.equal(blocks[5].type, 'code');
  assert.equal(blocks[5].type === 'code' ? blocks[5].language : '', 'js');
  assert.equal(blocks[6].type, 'divider');
  assert.equal(blocks[7].type, 'paragraph');
});

test('joins wrapped paragraph lines and keeps empty input safe', () => {
  const blocks = parseAssistantMarkdown('First line\ncontinues here.\n\nSecond paragraph.');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].type === 'paragraph' ? blocks[0].text : '', 'First line continues here.');

  assert.deepEqual(parseAssistantMarkdown('   '), []);
});

test('does not interpret inline emphasis as block structure', () => {
  const blocks = parseAssistantMarkdown('Use **bold** and `code` inline.');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(
    blocks[0].type === 'paragraph' ? blocks[0].text : '',
    'Use **bold** and `code` inline.'
  );
});

test('parses Markdown tables used for file-by-file comparisons', () => {
  const blocks = parseAssistantMarkdown(
    [
      '| File | What changed |',
      '|------|--------------|',
      '| src/middleware/auth.js | Switched to bearer tokens |',
      '| src/services/tokenService.js | Signs tokens |',
    ].join('\n')
  );

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'table');
  if (blocks[0].type === 'table') {
    assert.deepEqual(blocks[0].headers, ['File', 'What changed']);
    assert.equal(blocks[0].rows.length, 2);
    assert.deepEqual(blocks[0].rows[0], ['src/middleware/auth.js', 'Switched to bearer tokens']);
  }
});