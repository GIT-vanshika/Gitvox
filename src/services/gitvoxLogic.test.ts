import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { computeFileDiff, generateUnifiedPatch } from './diffService';
import { SAMPLE_PULL_REQUEST } from '../data/samplePullRequest';
import { SAMPLE_PROJECT } from '../data/sampleProject';
import { SAMPLE_FINDINGS } from '../data/sampleFindings';
import {
  normalizeAndValidatePath,
  parseSingleSourceContent,
  parseZipArchiveBytes,
} from './fileParser';
import { routeApplicationCommand } from './commandRouter';
import { checkCodeSyntax } from '../pages/ProjectWorkspacePage';

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

test('generateUnifiedPatch generates valid git unified diff patch format', () => {
  const patch = generateUnifiedPatch(SAMPLE_PULL_REQUEST.files);
  assert.ok(patch.includes('--- a/src/middleware/auth.js'));
  assert.ok(patch.includes('+++ b/src/middleware/auth.js'));
  assert.ok(patch.includes('@@ -'));
  assert.ok(patch.includes('extractBearerToken'));
  assert.ok(patch.includes('legacyKey'));
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

test('checkCodeSyntax accurately detects syntax errors and clears them when corrected', () => {
  // 1. Valid JavaScript code produces 0 errors
  const validJs = `
    import jwt from 'jsonwebtoken';
    export const authenticateUser = async (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      return next();
    };
  `;
  const cleanResults = checkCodeSyntax(validJs, 'javascript');
  assert.equal(cleanResults.length, 0);

  // 2. Unclosed brace '{' triggers an error
  const brokenJs = `
    export const testFn = () => {
      const a = 1;
  `;
  const errorResults = checkCodeSyntax(brokenJs, 'javascript');
  assert.equal(errorResults.length, 1);
  assert.match(errorResults[0].message, /unclosed/i);

  // 3. Fixing the code clears the error
  const fixedJs = brokenJs + '\n};\n';
  const resolvedResults = checkCodeSyntax(fixedJs, 'javascript');
  assert.equal(resolvedResults.length, 0);

  // 4. Unterminated string literal triggers an error
  const unterminatedString = `const token = 'bearer 123;`;
  const stringErrors = checkCodeSyntax(unterminatedString, 'javascript');
  assert.equal(stringErrors.length, 1);
  assert.match(stringErrors[0].message, /unterminated string/i);

  // 5. JSON validation
  const validJson = '{\n  "name": "gitvox",\n  "version": "2.4.0"\n}';
  assert.equal(checkCodeSyntax(validJson, 'json').length, 0);

  const brokenJson = '{\n  "name": "gitvox",\n}'; // trailing comma
  assert.equal(checkCodeSyntax(brokenJson, 'json').length, 1);

  // 6. Python validation: valid code vs missing colon vs bad indent
  const validPython = `
def calculate_metrics(items):
    """Calculates summary metrics."""
    total = 0
    for item in items:
        if item > 0:
            total += item
    return total
  `;
  assert.equal(checkCodeSyntax(validPython, 'main.py').length, 0);

  const missingColonPy = `
def process_data(val)
    return val * 2
  `;
  const pyErrors = checkCodeSyntax(missingColonPy, 'process.py');
  assert.equal(pyErrors.length, 1);
  assert.match(pyErrors[0].message, /expected ':'/i);

  // 7. C++ validation: valid code vs unclosed delimiter
  const validCpp = `
#include <iostream>
#include <vector>

int main() {
    std::vector<int> numbers = {1, 2, 3};
    for (int n : numbers) {
        std::cout << n << std::endl;
    }
    return 0;
}
  `;
  assert.equal(checkCodeSyntax(validCpp, 'server.cpp').length, 0);

  const brokenCpp = `
int main() {
    int x = (10 + 20;
    return x;
}
  `;
  const cppErrors = checkCodeSyntax(brokenCpp, 'server.cpp');
  assert.equal(cppErrors.length, 1);
  assert.match(cppErrors[0].message, /mismatched|unclosed|syntax/i);

  // 8. Rust validation: valid lifetimes and braces
  const validRust = `
fn get_str<'a>(s: &'a str) -> &'a str {
    println!("Hello, {}!", s);
    s
}
  `;
  assert.equal(checkCodeSyntax(validRust, 'lib.rs').length, 0);
});
