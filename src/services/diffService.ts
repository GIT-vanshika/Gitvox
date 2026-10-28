import { DiffHunk, DiffLine, FileDiffResult, SplitDiffRow } from '../types/gitvox';

/**
 * Computes a genuine line-by-line diff between baseContent and proposedContent
 * using Longest Common Subsequence (LCS) dynamic programming.
 */
export function computeFileDiff(
  baseContent: string,
  proposedContent: string,
  filePath = 'file'
): FileDiffResult {
  const oldLines = baseContent.length === 0 ? [] : baseContent.replace(/\r\n/g, '\n').split('\n');
  const newLines = proposedContent.length === 0 ? [] : proposedContent.replace(/\r\n/g, '\n').split('\n');

  const m = oldLines.length;
  const n = newLines.length;

  // LCS matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const unifiedLines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldLineNum = 1;
  let newLineNum = 1;
  let additions = 0;
  let deletions = 0;

  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      unifiedLines.push({
        type: 'unchanged',
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
        content: oldLines[i],
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      unifiedLines.push({
        type: 'deleted',
        oldLineNumber: oldLineNum++,
        newLineNumber: null,
        content: oldLines[i],
      });
      deletions++;
      i++;
    } else {
      unifiedLines.push({
        type: 'added',
        oldLineNumber: null,
        newLineNumber: newLineNum++,
        content: newLines[j],
      });
      additions++;
      j++;
    }
  }

  while (i < m) {
    unifiedLines.push({
      type: 'deleted',
      oldLineNumber: oldLineNum++,
      newLineNumber: null,
      content: oldLines[i],
    });
    deletions++;
    i++;
  }

  while (j < n) {
    unifiedLines.push({
      type: 'added',
      oldLineNumber: null,
      newLineNumber: newLineNum++,
      content: newLines[j],
    });
    additions++;
    j++;
  }

  const splitRows = buildSplitDiffRows(unifiedLines);
  const hunks = buildDiffHunks(unifiedLines, filePath);

  return {
    additions,
    deletions,
    unifiedLines,
    splitRows,
    hunks,
  };
}

/**
 * Pairs deleted and added blocks side-by-side for Split Diff inspection.
 */
function buildSplitDiffRows(unifiedLines: DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  let idx = 0;

  while (idx < unifiedLines.length) {
    const current = unifiedLines[idx];
    if (current.type === 'unchanged') {
      rows.push({
        leftLineNumber: current.oldLineNumber,
        leftContent: current.content,
        leftType: 'unchanged',
        rightLineNumber: current.newLineNumber,
        rightContent: current.content,
        rightType: 'unchanged',
      });
      idx++;
      continue;
    }

    const deletedChunk: DiffLine[] = [];
    const addedChunk: DiffLine[] = [];

    while (idx < unifiedLines.length && unifiedLines[idx].type !== 'unchanged') {
      if (unifiedLines[idx].type === 'deleted') {
        deletedChunk.push(unifiedLines[idx]);
      } else if (unifiedLines[idx].type === 'added') {
        addedChunk.push(unifiedLines[idx]);
      }
      idx++;
    }

    const maxLen = Math.max(deletedChunk.length, addedChunk.length);
    for (let k = 0; k < maxLen; k++) {
      const del = deletedChunk[k];
      const add = addedChunk[k];
      rows.push({
        leftLineNumber: del ? del.oldLineNumber : null,
        leftContent: del ? del.content : null,
        leftType: del ? 'deleted' : 'empty',
        rightLineNumber: add ? add.newLineNumber : null,
        rightContent: add ? add.content : null,
        rightType: add ? 'added' : 'empty',
      });
    }
  }

  return rows;
}

/**
 * Groups changed regions (with up to 3 lines of surrounding context) into logical hunks.
 */
function buildDiffHunks(unifiedLines: DiffLine[], filePath: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const changedIndices: number[] = [];

  unifiedLines.forEach((line, index) => {
    if (line.type !== 'unchanged') {
      changedIndices.push(index);
    }
  });

  if (changedIndices.length === 0) {
    return [];
  }

  const contextRadius = 2;
  const ranges: [number, number][] = [];

  for (const idx of changedIndices) {
    const start = Math.max(0, idx - contextRadius);
    const end = Math.min(unifiedLines.length - 1, idx + contextRadius);
    if (ranges.length === 0 || start > ranges[ranges.length - 1][1] + 1) {
      ranges.push([start, end]);
    } else {
      ranges[ranges.length - 1][1] = Math.max(ranges[ranges.length - 1][1], end);
    }
  }

  ranges.forEach(([start, end], hunkIndex) => {
    const slice = unifiedLines.slice(start, end + 1);
    const oldLinesInHunk = slice.filter((l) => l.oldLineNumber !== null);
    const newLinesInHunk = slice.filter((l) => l.newLineNumber !== null);

    const oldStart = oldLinesInHunk.length > 0 ? (oldLinesInHunk[0].oldLineNumber ?? 1) : 1;
    const newStart = newLinesInHunk.length > 0 ? (newLinesInHunk[0].newLineNumber ?? 1) : 1;
    const addedCount = slice.filter((l) => l.type === 'added').length;
    const deletedCount = slice.filter((l) => l.type === 'deleted').length;

    const header = `@@ -${oldStart},${oldLinesInHunk.length} +${newStart},${newLinesInHunk.length} @@`;
    hunks.push({
      id: `${filePath}-hunk-${hunkIndex + 1}`,
      header,
      oldStart,
      oldLines: oldLinesInHunk.length,
      newStart,
      newLines: newLinesInHunk.length,
      lines: slice,
      explanation: `Hunk #${hunkIndex + 1} in ${filePath} modifies lines ${newStart}–${
        newStart + Math.max(0, newLinesInHunk.length - 1)
      } (+${addedCount} added, -${deletedCount} removed).`,
    });
  });

  return hunks;
}


/**
 * Generates standard unified diff patch content for git-compatible patch export.
 */
export function generateUnifiedPatch(
  files: { path: string; baseContent: string; proposedContent: string }[]
): string {
  return files
    .map((file) => {
      const diff = computeFileDiff(file.baseContent, file.proposedContent, file.path);
      let patch = `--- a/${file.path}\n+++ b/${file.path}\n`;
      for (const hunk of diff.hunks) {
        patch += `${hunk.header}\n`;
        for (const line of hunk.lines) {
          const prefix = line.type === 'added' ? '+' : line.type === 'deleted' ? '-' : ' ';
          patch += `${prefix}${line.content}\n`;
        }
      }
      return patch;
    })
    .join('\n');
}
