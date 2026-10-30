import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGitHubPrUrl,
  parseGitPatchToPullRequest,
} from './gitHubPrService';

test('parseGitHubPrUrl parses various URL formats correctly', () => {
  const full = parseGitHubPrUrl('https://github.com/facebook/react/pull/31200');
  assert.deepEqual(full, { owner: 'facebook', repo: 'react', pullNumber: 31200 });

  const shortUrl = parseGitHubPrUrl('github.com/facebook/react/pull/31200');
  assert.deepEqual(shortUrl, { owner: 'facebook', repo: 'react', pullNumber: 31200 });

  const pathOnly = parseGitHubPrUrl('facebook/react/pull/31200');
  assert.deepEqual(pathOnly, { owner: 'facebook', repo: 'react', pullNumber: 31200 });

  const hashFormat = parseGitHubPrUrl('facebook/react#31200');
  assert.deepEqual(hashFormat, { owner: 'facebook', repo: 'react', pullNumber: 31200 });

  assert.equal(parseGitHubPrUrl('not-a-url'), null);
  assert.equal(parseGitHubPrUrl('https://google.com'), null);
  assert.equal(parseGitHubPrUrl(''), null);
});

test('parseGitPatchToPullRequest converts a standard unified patch into PullRequestData', () => {
  const samplePatch = `From 12345 Mon Sep 17 00:00:00 2001
From: Test Author <author@example.com>
Date: Fri, 30 Oct 2026 12:00:00 +0000
Subject: [PATCH] Add feature X

diff --git a/src/index.js b/src/index.js
index 1111..2222 100644
--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 const d = 5;
diff --git a/README.md b/README.md
index 3333..4444 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,2 @@
-# Old Title
+# New Title
 Hello world
`;

  const pr = parseGitPatchToPullRequest(samplePatch, {
    owner: 'test-org',
    repo: 'test-repo',
    pullNumber: 42,
  });

  assert.equal(pr.number, 42);
  assert.equal(pr.repository, 'test-org/test-repo');
  assert.equal(pr.title, 'Add feature X');
  assert.equal(pr.author, 'Test Author');
  assert.equal(pr.isSampleData, false);
  assert.equal(pr.files.length, 2);

  // First file checks
  assert.equal(pr.files[0].path, 'src/index.js');
  assert.equal(pr.files[0].expectedAdditions, 2);
  assert.equal(pr.files[0].expectedDeletions, 1);
  assert.ok(pr.files[0].proposedContent.includes('const b = 3;'));
  assert.ok(pr.files[0].baseContent.includes('const b = 2;'));

  // Second file checks
  assert.equal(pr.files[1].path, 'README.md');
  assert.equal(pr.files[1].expectedAdditions, 1);
  assert.equal(pr.files[1].expectedDeletions, 1);

  // Totals
  assert.equal(pr.additionsCount, 3);
  assert.equal(pr.deletionsCount, 2);
});

