import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { computeFileDiff } from './diffService';
import { SAMPLE_PULL_REQUEST } from '../data/samplePullRequest';
import { SAMPLE_PROJECT } from '../data/sampleProject';
import { SAMPLE_FINDINGS } from '../data/sampleFindings';
import {
  normalizeAndValidatePath,
  parseSingleSourceContent,
  parseZipArchiveBytes,
} from './fileParser';
import { routeApplicationCommand } from './commandRouter';

test('Sample PR #284 genuine LCS diffs match exact +86 additions and -24 deletions across 5 files', () => {
  assert.equal(SAMPLE_PULL_REQUEST.number, 284);
  assert.equal(SAMPLE_PULL_REQUEST.files.length, 5);

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const file of SAMPLE_PULL_REQUEST.files) {
    const diff = computeFileDiff(file.baseContent, file.proposedContent, file.path);
    assert.equal(
      diff.additions,
      file.expectedAdditions,
      `Additions mismatch in ${file.path}: got ${diff.additions}, expected ${file.expectedAdditions}`
    );
    assert.equal(
      diff.deletions,
      file.expectedDeletions,
      `Deletions mismatch in ${file.path}: got ${diff.deletions}, expected ${file.expectedDeletions}`
    );
    assert.ok(diff.hunks.length >= 1, `Expected at least 1 diff hunk in ${file.path}`);
    assert.ok(diff.splitRows.length >= 1, `Expected split diff rows in ${file.path}`);

    totalAdditions += diff.additions;
    totalDeletions += diff.deletions;
  }

  assert.equal(totalAdditions, 86);
  assert.equal(totalDeletions, 24);
});

test('normalizeAndValidatePath rejects path traversal and absolute paths', () => {
  assert.equal(normalizeAndValidatePath('src\\middleware\\auth.js'), 'src/middleware/auth.js');
  assert.throws(() => normalizeAndValidatePath('../etc/passwd'), /path traversal/i);
  assert.throws(() => normalizeAndValidatePath('/etc/passwd'), /absolute path/i);
  assert.throws(() => normalizeAndValidatePath('C:\\Users\\secret.js'), /absolute path/i);
});

test('parseSingleSourceContent parses valid code and rejects binary or unsupported files', () => {
  const sampleJs = strToU8(
    'export function calculateChecksum(input) {\n  return input.length;\n}\n'
  );
  const parsed = parseSingleSourceContent('checksum.js', sampleJs);
  assert.equal(parsed.files.length, 1);
  assert.equal(parsed.files[0].language, 'javascript');
  assert.equal(parsed.files[0].functions.length, 1);
  assert.equal(parsed.files[0].functions[0].name, 'calculateChecksum');

  assert.throws(
    () => parseSingleSourceContent('malware.exe', sampleJs),
    /Unsupported file format/i
  );

  const binaryBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x1a]);
  assert.throws(
    () => parseSingleSourceContent('spoofed.js', binaryBytes),
    /Rejected binary content/i
  );
});

test('parseZipArchiveBytes extracts valid source files and excludes node_modules and .git', () => {
  const zipped = zipSync({
    'my-repo/src/index.ts': strToU8('export function main() {\n  return 42;\n}\n'),
    'my-repo/README.md': strToU8('# My Repo\nDocumentation here.'),
    'my-repo/node_modules/pkg/index.js': strToU8('module.exports = {};'),
    'my-repo/.git/HEAD': strToU8('ref: refs/heads/main'),
  });

  const project = parseZipArchiveBytes('my-repo.zip', zipped);
  assert.equal(project.files.length, 2);
  assert.deepEqual(
    project.files.map((f) => f.path),
    ['README.md', 'src/index.ts']
  );
  assert.equal(project.excludedPaths.length, 2);
});

test('routeApplicationCommand handles all 7 core voice/text commands deterministically', () => {
  const context = {
    project: SAMPLE_PROJECT,
    selectedFile: SAMPLE_PROJECT.files[0],
    selectedFunctionName: 'authenticateRequest',
    pullRequest: SAMPLE_PULL_REQUEST,
    findings: SAMPLE_FINDINGS,
  };

  const r1 = routeApplicationCommand('Explain this project.', context);
  assert.equal(r1.recognized, true);
  assert.equal(r1.intent, 'explain-project');

  const r2 = routeApplicationCommand('Summarize this file.', context);
  assert.equal(r2.recognized, true);
  assert.equal(r2.intent, 'summarize-file');

  const r3 = routeApplicationCommand('Explain the selected function.', context);
  assert.equal(r3.recognized, true);
  assert.equal(r3.intent, 'explain-function');

  const r4 = routeApplicationCommand('Show the authentication middleware.', context);
  assert.equal(r4.recognized, true);
  assert.equal(r4.intent, 'select-file');
  assert.equal(r4.targetFilePath, 'src/middleware/auth.js');

  const r5 = routeApplicationCommand('Explain this pull request.', context);
  assert.equal(r5.recognized, true);
  assert.equal(r5.intent, 'explain-pr');

  const r6 = routeApplicationCommand('Summarize the changes.', context);
  assert.equal(r6.recognized, true);
  assert.equal(r6.intent, 'summarize-changes');

  const r7 = routeApplicationCommand('Check these changes for potential bugs.', context);
  assert.equal(r7.recognized, true);
  assert.equal(r7.intent, 'check-bugs');
  assert.equal(r7.targetFindingId, 'finding-1');

  const unknown = routeApplicationCommand('Deploy to kubernetes cluster now', context);
  assert.equal(unknown.recognized, false);
  assert.equal(unknown.intent, 'unknown');
});

test('Phase 3 voice/text commands route to PR, file, and line-range actions', () => {
  const context = {
    project: SAMPLE_PROJECT,
    selectedFile: SAMPLE_PROJECT.files[0],
    selectedFunctionName: 'authenticateRequest',
    pullRequest: SAMPLE_PULL_REQUEST,
    findings: SAMPLE_FINDINGS,
  };

  const explainPr = routeApplicationCommand('Explain the current PR.', context);
  assert.equal(explainPr.recognized, true);
  assert.equal(explainPr.intent, 'explain-pr');
  assert.equal(explainPr.targetRoute, 'pr');

  const summarizePr = routeApplicationCommand('Summarize the current PR.', context);
  assert.equal(summarizePr.recognized, true);
  assert.equal(summarizePr.intent, 'summarize-changes');

  const explainFile = routeApplicationCommand('Explain the selected file.', context);
  assert.equal(explainFile.recognized, true);
  assert.equal(explainFile.intent, 'summarize-file');
  assert.equal(explainFile.targetFilePath, 'src/middleware/auth.js');

  const range = routeApplicationCommand('Explain code from line 5 to line 27', context);
  assert.equal(range.recognized, true);
  assert.equal(range.intent, 'explain-line-range');
  assert.equal(range.explanation?.filePath, 'src/middleware/auth.js');
  assert.deepEqual(range.explanation?.lineRange, [5, 27]);
  assert.match(range.explanation?.evidenceSnippet ?? '', /authenticateRequest/);

  const prRouteFile = routeApplicationCommand('Explain the selected file.', {
    ...context,
    currentRoute: 'pr' as const,
    selectedPrFile: SAMPLE_PULL_REQUEST.files[1],
  });
  assert.equal(prRouteFile.recognized, true);
  assert.equal(prRouteFile.explanation?.filePath, 'src/services/tokenService.js');

  const invalidRange = routeApplicationCommand('Explain code from line 0 to line 5', context);
  assert.equal(invalidRange.recognized, false);
});
