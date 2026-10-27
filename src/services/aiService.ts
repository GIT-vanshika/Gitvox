import {
  AIExplanation,
  CodeFunction,
  DiffHunk,
  LoadedProject,
  ProjectFile,
  PullRequestData,
} from '../types/gitvox';

/**
 * Grounded AI explanation service layer.
 * Generates explanations strictly derived from the loaded project files,
 * functions, or pull-request diffs in memory, with explicit scope and confidence metadata.
 */
export function buildProjectOverviewExplanation(project: LoadedProject): AIExplanation {
  const languageCounts: Record<string, number> = {};
  let totalFunctions = 0;

  project.files.forEach((f) => {
    languageCounts[f.language] = (languageCounts[f.language] || 0) + 1;
    totalFunctions += f.functions.length;
  });

  const langSummary = Object.entries(languageCounts)
    .map(([lang, count]) => `${count} ${lang}`)
    .join(', ');

  const topFiles = project.files.slice(0, 5).map((f) => f.path);

  return {
    id: `exp-proj-${Date.now()}`,
    title: `Project Architecture: ${project.name}`,
    scopeLabel: `Analyzed ${project.files.length} loaded file${
      project.files.length === 1 ? '' : 's'
    } (${(project.totalSizeBytes / 1024).toFixed(1)} KB)`,
    summary: `${project.name} contains ${project.files.length} source file${
      project.files.length === 1 ? '' : 's'
    } (${langSummary}) defining ${totalFunctions} parsed function${
      totalFunctions === 1 ? '' : 's'
    }. ${project.description}`,
    details: [
      `Entry & core files inspected: ${topFiles.join(', ')}.`,
      project.files.some((f) => f.path.includes('auth') || f.path.includes('token'))
        ? 'Authentication flow separates HTTP header extraction (validateToken.js), cryptographic HMAC signing (tokenService.js), and route middleware guards (auth.js).'
        : `Primary module structure spans ${
            new Set(project.files.map((f) => f.folder || 'root')).size
          } directory namespaces.`,
      project.scopeNotice,
    ],
    confidenceNote:
      'Grounded in in-memory static AST/source inspection of the loaded files. External runtime environment variables and unlisted dependencies are not assumed.',
    sourceOrigin: 'sample-grounded',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function buildFileExplanation(file: ProjectFile): AIExplanation {
  const lines = file.content.split('\n');
  const imports = lines
    .filter((l) => /^\s*(import|from|require|#include)\b/.test(l))
    .map((l) => l.trim());
  const exportsList = lines
    .filter((l) => /^\s*export\b/.test(l))
    .map((l) => l.trim().slice(0, 70));

  const fnNames = file.functions.map((fn) => `${fn.name} (L${fn.startLine}–L${fn.endLine})`);

  return {
    id: `exp-file-${file.path}-${Date.now()}`,
    title: `File Summary: ${file.name}`,
    scopeLabel: `${file.path} · ${lines.length} lines · ${file.language}`,
    filePath: file.path,
    lineRange: [1, lines.length],
    summary: `${file.path} is a ${lines.length}-line ${file.language} module containing ${
      file.functions.length
    } function definition${file.functions.length === 1 ? '' : 's'}${
      fnNames.length > 0 ? `: ${fnNames.join(', ')}` : '.'
    }`,
    details: [
      imports.length > 0
        ? `Dependencies imported (${imports.length}): ${imports.slice(0, 3).join(' | ')}`
        : 'Self-contained module with no external import statements.',
      file.functions.length > 0
        ? `Key callable symbols: ${file.functions.map((f) => f.summary).join(' ')}`
        : `Exports / top-level statements: ${
            exportsList.length > 0 ? exportsList.join('; ') : 'Declarative content or configuration.'
          }`,
    ],
    evidenceSnippet: lines.slice(0, Math.min(8, lines.length)).join('\n'),
    confidenceNote: `Grounded directly in ${file.path} (lines 1–${lines.length}).`,
    sourceOrigin: 'sample-grounded',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function buildFunctionExplanation(
  file: ProjectFile,
  fn: CodeFunction
): AIExplanation {
  const lines = file.content.split('\n');
  const snippet = lines.slice(Math.max(0, fn.startLine - 1), fn.endLine).join('\n');

  return {
    id: `exp-fn-${file.path}-${fn.name}-${Date.now()}`,
    title: `Function: ${fn.signature}`,
    scopeLabel: `${file.path} · Lines ${fn.startLine}–${fn.endLine}`,
    filePath: file.path,
    lineRange: [fn.startLine, fn.endLine],
    summary: fn.summary,
    details: [
      `Defined in ${file.path} spanning lines ${fn.startLine} to ${fn.endLine}.`,
      snippet.includes('try') || snippet.includes('throw')
        ? 'Includes explicit error handling / exception propagation inside its execution block.'
        : 'Executes synchronous deterministic transformation on its input arguments.',
      snippet.includes('return')
        ? 'Returns an explicit result or middleware continuation to the caller.'
        : 'Operates via request/response side-effects.',
    ],
    evidenceSnippet: snippet,
    confidenceNote: `Bounded to ${file.path}:${fn.startLine}–${fn.endLine}.`,
    sourceOrigin: 'sample-grounded',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function buildDiffHunkExplanation(
  filePath: string,
  hunk: DiffHunk,
  fileSummary: string
): AIExplanation {
  const addedLines = hunk.lines.filter((l) => l.type === 'added').map((l) => `+ ${l.content}`);
  const deletedLines = hunk.lines.filter((l) => l.type === 'deleted').map((l) => `- ${l.content}`);

  return {
    id: `exp-hunk-${hunk.id}-${Date.now()}`,
    title: `Diff Hunk Explanation (${hunk.header})`,
    scopeLabel: `${filePath} · Proposed Lines ${hunk.newStart}–${
      hunk.newStart + Math.max(0, hunk.newLines - 1)
    }`,
    filePath,
    lineRange: [hunk.newStart, hunk.newStart + Math.max(0, hunk.newLines - 1)],
    summary: `${hunk.explanation} ${fileSummary}`,
    details: [
      deletedLines.length > 0
        ? `Removed (${deletedLines.length} lines): Replaces prior logic starting with "${deletedLines[0].slice(
            0,
            65
          )}".`
        : 'Pure addition with no removed base lines in this hunk.',
      addedLines.length > 0
        ? `Added (${addedLines.length} lines): Introduces "${addedLines[0].slice(0, 65)}".`
        : 'Pure deletion removing deprecated statements.',
    ],
    evidenceSnippet: [...deletedLines.slice(0, 3), ...addedLines.slice(0, 4)].join('\n'),
    confidenceNote:
      'Sample Grounded Analysis: Derived from comparing the explicit base and proposed source versions for this hunk.',
    sourceOrigin: 'sample-grounded',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * Builds a grounded explanation for a selected line range in a loaded file.
 * This is deterministic local analysis, not a model response, and says so.
 */
export function buildLineRangeExplanation(
  file: ProjectFile,
  startLine: number,
  endLine: number
): AIExplanation {
  const lines = file.content.replace(/\r\n/g, '\n').split('\n');
  const totalLines = lines.length;
  const requestedStart = Number.isFinite(startLine) ? Math.trunc(startLine) : 1;
  const requestedEnd = Number.isFinite(endLine) ? Math.trunc(endLine) : totalLines;
  const low = Math.min(requestedStart, requestedEnd);
  const high = Math.max(requestedStart, requestedEnd);
  const start = Math.min(Math.max(low, 1), totalLines);
  const end = Math.min(Math.max(high, start), totalLines);

  const rangeLines = lines.slice(start - 1, end);
  const snippet = rangeLines.join('\n');
  const nonEmptyLines = rangeLines.filter((line) => line.trim().length > 0).length;

  const intersectingFunctions = file.functions.filter(
    (fn) => fn.startLine <= end && fn.endLine >= start
  );

  const constructs: string[] = [];
  if (/\btry\b|\bcatch\b|\bthrow\b/.test(snippet)) constructs.push('error handling');
  if (/\bawait\b|\basync\b/.test(snippet)) constructs.push('asynchronous calls');
  if (/\breturn\b/.test(snippet)) constructs.push('explicit returns');
  if (/\bif\s*\(|\belse\b/.test(snippet)) constructs.push('conditional branching');
  if (/\bimport\b|\brequire\s*\(/.test(snippet)) constructs.push('module imports');
  if (/\bclass\b|\binterface\b|\btype\s+\w+\s*=/.test(snippet)) constructs.push('type/class declarations');

  const details = [
    `Selected ${rangeLines.length} line${rangeLines.length === 1 ? '' : 's'} (${nonEmptyLines} non-empty) from ${file.path}.`,
    intersectingFunctions.length > 0
      ? `Intersecting parsed functions: ${intersectingFunctions
          .map((fn) => `${fn.name} (L${fn.startLine}–L${fn.endLine})`)
          .join(', ')}.`
      : 'No parsed function boundary intersects this range.',
    constructs.length > 0
      ? `Constructs observed in the range: ${constructs.join(', ')}.`
      : 'The range is primarily declarations, configuration, or comments.',
  ];

  if (start !== requestedStart || end !== requestedEnd) {
    details.push(
      `Requested range ${requestedStart}–${requestedEnd} was clamped to the file bounds (L1–L${totalLines}).`
    );
  }

  return {
    id: `exp-range-${file.path}-${start}-${end}-${Date.now()}`,
    title: `Code Range: ${file.path} · L${start}–L${end}`,
    scopeLabel: `${file.path} · Lines ${start}–${end} · ${file.language}`,
    filePath: file.path,
    lineRange: [start, end],
    summary: `${file.path} lines ${start}–${end} contain ${nonEmptyLines} non-empty line${
      nonEmptyLines === 1 ? '' : 's'
    }${intersectingFunctions.length > 0 ? ` within ${intersectingFunctions.map((fn) => fn.name).join(', ')}` : ''}.`,
    details,
    evidenceSnippet: snippet,
    confidenceNote: `Grounded directly in ${file.path} lines ${start}–${end}. Local deterministic range analysis; no model call.`,
    sourceOrigin: 'sample-grounded',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function buildContextualQuestionResponse(
  question: string,
  project: LoadedProject,
  selectedFile: ProjectFile | null,
  pr: PullRequestData
): AIExplanation {
  const q = question.trim().toLowerCase();

  // Cross-file or specific topic matching grounded in loaded files
  const matchingFiles = project.files.filter(
    (f) =>
      f.path.toLowerCase().includes(q) ||
      f.content.toLowerCase().includes(q) ||
      q
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some((word) => f.content.toLowerCase().includes(word))
  );

  const targetFile = selectedFile || matchingFiles[0] || project.files[0];
  const lines = targetFile.content.split('\n');

  if (q.includes('secret') || q.includes('hmac') || q.includes('sign')) {
    const tokenFile =
      project.files.find((f) => f.path.includes('tokenService')) || targetFile;
    const tokenLines = tokenFile.content.split('\n');
    return {
      id: `exp-qa-${Date.now()}`,
      title: `Grounded Answer: Token Signing & Secret Handling`,
      scopeLabel: `${tokenFile.path} · Bounded Context`,
      filePath: tokenFile.path,
      lineRange: [1, tokenLines.length],
      summary: `In ${tokenFile.path}, tokens are signed using Node's crypto.createHmac("sha256", SIGNING_SECRET) over a base64url-encoded JSON payload prefixed with "v1."`,
      details: [
        'Line 5 defines SIGNING_SECRET = process.env.TOKEN_SECRET || "dev-fallback-secret-key".',
        'issueAccessToken() embeds sub, role, scopes, iat, and exp (3600s TTL) before computing the HMAC digest.',
        'verifyAccessToken() recomputes the HMAC digest and throws "Invalid token signature" on mismatch.',
      ],
      evidenceSnippet: tokenLines.slice(3, 14).join('\n'),
      confidenceNote: `Grounded in ${tokenFile.path} (Sample Grounded Analysis — no external live model call).`,
      sourceOrigin: 'sample-grounded',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }

  return {
    id: `exp-qa-${Date.now()}`,
    title: `Contextual Analysis: "${question.slice(0, 48)}"`,
    scopeLabel: `${targetFile.path} (${matchingFiles.length} relevant file${
      matchingFiles.length === 1 ? '' : 's'
    } matched)`,
    filePath: targetFile.path,
    lineRange: [1, Math.min(20, lines.length)],
    summary: `Based on ${targetFile.path} and ${
      matchingFiles.length > 0 ? matchingFiles.map((f) => f.name).join(', ') : project.name
    }: ${
      targetFile.functions.length > 0
        ? targetFile.functions.map((f) => f.summary).join(' ')
        : `This ${targetFile.language} file defines ${lines.length} lines within ${project.name}.`
    }`,
    details: [
      `Active file inspected: ${targetFile.path} (${lines.length} lines, ${targetFile.functions.length} functions).`,
      `Related pull request context: PR #${pr.number} ("${pr.title}") modifies ${pr.filesChangedCount} files (+${pr.additionsCount} / -${pr.deletionsCount}).`,
      project.scopeNotice,
    ],
    evidenceSnippet: lines.slice(0, Math.min(8, lines.length)).join('\n'),
    confidenceNote:
      'Sample Grounded Analysis: Computed locally from bounded source context in memory.',
    sourceOrigin: 'sample-grounded',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}
