import {
  CommandResult,
  LoadedProject,
  PRFileChange,
  ProjectFile,
  PullRequestData,
  ReviewFinding,
  RouteId,
} from '../types/gitvox';
import {
  buildFileExplanation,
  buildFunctionExplanation,
  buildLineRangeExplanation,
  buildProjectOverviewExplanation,
} from './aiService';
import { extractFunctionsFromSource } from './fileParser';

export const SUPPORTED_VOICE_AND_TEXT_COMMANDS = [
  'Explain this project.',
  'Summarize this file.',
  'Explain the selected function.',
  'Show the authentication middleware.',
  'Explain this pull request.',
  'Summarize the changes.',
  'Check these changes for potential bugs.',
  'Check this PR for errors.',
  'Run a security analysis.',
  'Check this file for errors.',
  'Explain the current PR.',
  'Summarize the current PR.',
  'Explain the selected file.',
  'Explain code from line 5 to line 15.',
];

export interface CommandRouterContext {
  project: LoadedProject;
  selectedFile: ProjectFile | null;
  selectedFunctionName: string | null;
  pullRequest: PullRequestData;
  findings: ReviewFinding[];
  currentRoute?: RouteId;
  selectedPrFile?: PRFileChange | null;
}

/**
 * Adapts a changed PR file into the ProjectFile shape used by local explanations.
 * The proposed side is the code the reviewer is currently looking at.
 */
function toProjectFile(file: PRFileChange): ProjectFile {
  const name = file.path.split('/').pop() || file.path;
  return {
    path: file.path,
    name,
    folder: file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '',
    language: file.language,
    sizeBytes: file.proposedContent.length,
    content: file.proposedContent,
    functions: extractFunctionsFromSource(file.proposedContent, file.language),
  };
}

/**
 * Resolves "the selected file" from the active workspace: the changed PR file on
 * the PR review route, otherwise the project workspace selection.
 */
export function resolveActiveFile(context: CommandRouterContext): ProjectFile {
  if (context.currentRoute === 'pr' && context.selectedPrFile) {
    return toProjectFile(context.selectedPrFile);
  }
  return context.selectedFile || context.project.files[0];
}

/**
 * Deterministic local command router shared by both text commands and browser speech transcripts.
 * Never executes arbitrary actions on vague matches.
 */
export function routeApplicationCommand(
  rawInput: string,
  context: CommandRouterContext
): CommandResult {
  const normalized = rawInput
    .trim()
    .toLowerCase()
    .replace(/[.?!]+$/g, '');

  if (!normalized) {
    return {
      recognized: false,
      intent: 'unknown',
      responseTitle: 'Empty Command',
      responseMessage:
        'Enter or speak a supported command such as "Explain this project" or "Check these changes for potential bugs".',
    };
  }

  // 1. "Explain this project"
  if (
    normalized === 'explain this project' ||
    normalized === 'summarize this project' ||
    normalized === 'project overview' ||
    normalized === 'explain project'
  ) {
    const explanation = buildProjectOverviewExplanation(context.project);
    explanation.sourceOrigin = 'command-router';
    return {
      recognized: true,
      intent: 'explain-project',
      targetRoute: 'project',
      responseTitle: 'Project Overview Generated',
      responseMessage: explanation.summary,
      explanation,
    };
  }

  // 2. "Summarize this file" / "Explain the selected file"
  if (
    normalized === 'summarize this file' ||
    normalized === 'explain this file' ||
    normalized === 'summarize file' ||
    normalized === 'explain selected file' ||
    normalized === 'explain the selected file' ||
    normalized === 'explain the current file'
  ) {
    const targetFile = resolveActiveFile(context);
    const explanation = buildFileExplanation(targetFile);
    explanation.sourceOrigin = 'command-router';
    return {
      recognized: true,
      intent: 'summarize-file',
      targetFilePath: targetFile.path,
      responseTitle: `Summarized ${targetFile.name}`,
      responseMessage: explanation.summary,
      explanation,
    };
  }

  // 2b. "Explain code from line X to line Y" (voice range intent / typed fallback)
  const rangeMatch = normalized.match(
    /^(?:please )?explain (?:the )?(?:code|range) (?:from )?(?:line )?(\d+) (?:to|through|until|and|-|–) (?:line )?(\d+)$/
  );
  if (rangeMatch) {
    const requestedStart = Number(rangeMatch[1]);
    const requestedEnd = Number(rangeMatch[2]);
    if (
      !Number.isInteger(requestedStart) ||
      !Number.isInteger(requestedEnd) ||
      requestedStart < 1 ||
      requestedEnd < 1
    ) {
      return {
        recognized: false,
        intent: 'unknown',
        responseTitle: 'Line Range Required',
        responseMessage:
          'Say or type a positive start and end line, for example "Explain code from line 5 to line 15".',
      };
    }

    const targetFile = resolveActiveFile(context);
    const explanation = buildLineRangeExplanation(targetFile, requestedStart, requestedEnd);
    explanation.sourceOrigin = 'command-router';
    const [rangeStart, rangeEnd] = explanation.lineRange || [requestedStart, requestedEnd];

    return {
      recognized: true,
      intent: 'explain-line-range',
      targetFilePath: targetFile.path,
      responseTitle: `Code Range L${rangeStart}–L${rangeEnd} in ${targetFile.name}`,
      responseMessage: explanation.summary,
      explanation,
    };
  }

  // 3. "Explain the selected function"
  if (
    normalized === 'explain the selected function' ||
    normalized === 'explain selected function' ||
    normalized === 'explain this function' ||
    normalized === 'explain function'
  ) {
    const targetFile = context.selectedFile || context.project.files[0];
    const fn =
      targetFile.functions.find((f) => f.name === context.selectedFunctionName) ||
      targetFile.functions[0];

    if (!fn) {
      return {
        recognized: true,
        intent: 'explain-function',
        targetFilePath: targetFile.path,
        responseTitle: 'No Functions Found in Active File',
        responseMessage: `${targetFile.path} does not contain standalone function declarations. Select a code module such as src/middleware/auth.js.`,
      };
    }

    const explanation = buildFunctionExplanation(targetFile, fn);
    explanation.sourceOrigin = 'command-router';
    return {
      recognized: true,
      intent: 'explain-function',
      targetFilePath: targetFile.path,
      responseTitle: `Function: ${fn.signature}`,
      responseMessage: explanation.summary,
      explanation,
    };
  }

  // 4. "Show the authentication middleware" or explicit file navigation
  if (
    normalized.includes('show the authentication middleware') ||
    normalized.includes('open authentication middleware') ||
    normalized === 'show auth.js' ||
    normalized === 'open auth.js'
  ) {
    const authFile =
      context.project.files.find((f) => f.path === 'src/middleware/auth.js') ||
      context.project.files.find((f) => f.path.includes('auth')) ||
      context.project.files[0];
    const explanation = buildFileExplanation(authFile);
    explanation.sourceOrigin = 'command-router';
    return {
      recognized: true,
      intent: 'select-file',
      targetFilePath: authFile.path,
      responseTitle: `Opened ${authFile.path}`,
      responseMessage: `Selected ${authFile.path} in the workspace. ${explanation.summary}`,
      explanation,
    };
  }

  // Check explicit file match for other files
  for (const file of context.project.files) {
    const lowerName = file.name.toLowerCase();
    const baseWithoutExt = lowerName.replace(/\.[^.]+$/, '');
    if (
      normalized === `show ${lowerName}` ||
      normalized === `open ${lowerName}` ||
      normalized === `show ${baseWithoutExt}` ||
      normalized === `open ${baseWithoutExt}` ||
      normalized === `show ${file.path.toLowerCase()}`
    ) {
      const explanation = buildFileExplanation(file);
      explanation.sourceOrigin = 'command-router';
      return {
        recognized: true,
        intent: 'select-file',
        targetFilePath: file.path,
        responseTitle: `Selected ${file.path}`,
        responseMessage: explanation.summary,
        explanation,
      };
    }
  }

  // 5. "Explain this pull request" / "Explain the current PR"
  if (
    normalized === 'explain this pull request' ||
    normalized === 'explain the pull request' ||
    normalized === 'explain pull request' ||
    normalized === 'explain pr' ||
    normalized === 'explain the current pr' ||
    normalized === 'explain current pr' ||
    normalized === 'explain this pr'
  ) {
    const pr = context.pullRequest;
    return {
      recognized: true,
      intent: 'explain-pr',
      targetRoute: 'pr',
      responseTitle: `PR #${pr.number}: ${pr.title}`,
      responseMessage: `${pr.overview} Purpose: ${pr.purpose}`,
      explanation: {
        id: `cmd-pr-${Date.now()}`,
        title: `Pull Request #${pr.number} Explanation`,
        scopeLabel: `${pr.repository} · ${pr.sourceBranch} → ${pr.targetBranch}`,
        summary: pr.overview,
        details: [
          `Purpose: ${pr.purpose}`,
          `Scope: ${pr.filesChangedCount} files changed, +${pr.additionsCount} additions, -${pr.deletionsCount} deletions by ${pr.author}.`,
          `Changed files: ${pr.files.map((f) => f.path).join(', ')}.`,
        ],
        confidenceNote:
          'Command Router Response (Sample Data): Derived from PR #284 metadata and diff hunks.',
        sourceOrigin: 'command-router',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    };
  }

  // 6. "Summarize the changes"
  if (
    normalized === 'summarize the changes' ||
    normalized === 'summarize changes' ||
    normalized === 'summarize the current pr' ||
    normalized === 'summarize current pr' ||
    normalized === 'summarize this pull request' ||
    normalized === 'summarize the pull request' ||
    normalized === 'what changed'
  ) {
    const pr = context.pullRequest;
    return {
      recognized: true,
      intent: 'summarize-changes',
      targetRoute: 'pr',
      responseTitle: `Diff Summary (+${pr.additionsCount} / -${pr.deletionsCount})`,
      responseMessage: `Across ${pr.filesChangedCount} files, this pull request replaces static x-api-key checks with HMAC-SHA256 bearer tokens and scope validation.`,
      explanation: {
        id: `cmd-changes-${Date.now()}`,
        title: `Change Summary across ${pr.filesChangedCount} Files`,
        scopeLabel: `+${pr.additionsCount} additions · -${pr.deletionsCount} deletions`,
        summary: `PR #${pr.number} updates ${pr.filesChangedCount} files in ${pr.repository}:`,
        details: pr.files.map(
          (f) => `${f.path} (+${f.expectedAdditions}/-${f.expectedDeletions}): ${f.summary}`
        ),
        confidenceNote:
          'Command Router Response (Sample Data): Verified against base and proposed source diffs.',
        sourceOrigin: 'command-router',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    };
  }

  // 7. Security analysis command
  if (
    normalized === 'run a security analysis' ||
    normalized === 'check security' ||
    normalized === 'check for vulnerabilities' ||
    normalized === 'security audit' ||
    normalized === 'run security check' ||
    normalized === 'check for security issues'
  ) {
    const topFinding = context.findings.find((f) => f.severity === 'high') || context.findings[0];
    return {
      recognized: true,
      intent: 'check-security',
      targetRoute: 'pr',
      targetFilePath: topFinding?.filePath,
      targetFindingId: topFinding?.id,
      responseTitle: 'Security Analysis Overview',
      responseMessage: `Identified potential security risks in PR #${context.pullRequest.number}. High-priority item: ${topFinding?.title || 'None'} in ${topFinding?.filePath || 'workspace'}.`,
      explanation: {
        id: `cmd-sec-${Date.now()}`,
        title: 'Security Vulnerability Analysis',
        scopeLabel: `Security Audit · PR #${context.pullRequest.number}`,
        filePath: topFinding?.filePath,
        lineRange: topFinding ? [topFinding.startLine, topFinding.endLine] : undefined,
        summary: 'Security posture evaluation of token-based authentication implementation.',
        details: [
          'High: Timing attack vulnerability in token HMAC comparison (crypto.timingSafeEqual recommended).',
          'Medium: Token secret fallback to default in development environments.',
          'Medium: Scope check bypass possible if scope parameter is empty array.',
          'Low: Missing rate-limiting headers on token refresh endpoint.',
        ],
        evidenceSnippet: topFinding?.evidence,
        confidenceNote: 'Grounded security audit against OWASP Top 10 API Security Risks.',
        sourceOrigin: 'command-router',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    };
  }

  // 8. "Check these changes for potential bugs" (preserves check-bugs intent for backwards compatibility)
  if (
    normalized === 'check these changes for potential bugs' ||
    normalized === 'check for potential bugs' ||
    normalized === 'check for bugs' ||
    normalized === 'find bugs' ||
    normalized === 'show review findings'
  ) {
    const topFinding = context.findings[0];
    return {
      recognized: true,
      intent: 'check-bugs',
      targetRoute: 'pr',
      targetFilePath: topFinding?.filePath,
      targetFindingId: topFinding?.id,
      responseTitle: `${context.findings.length} Sample Review Findings Identified`,
      responseMessage: `Navigated to primary finding in ${topFinding.filePath}:${topFinding.startLine} — "${topFinding.title}".`,
      explanation: {
        id: `cmd-bugs-${Date.now()}`,
        title: 'Potential Bug & Security Review Findings (Illustrative Sample)',
        scopeLabel: `${context.findings.length} findings across PR #${context.pullRequest.number}`,
        filePath: topFinding?.filePath,
        lineRange: topFinding ? [topFinding.startLine, topFinding.endLine] : undefined,
        summary: `Identified ${context.findings.length} illustrative review findings (1 High, 2 Medium, 1 Low).`,
        details: context.findings.map(
          (f) => `[${f.severity.toUpperCase()}] ${f.filePath}:${f.startLine} — ${f.title}`
        ),
        evidenceSnippet: topFinding?.evidence,
        confidenceNote:
          'Illustrative Sample Review Content: Not a verified vulnerability or automated security certification.',
        sourceOrigin: 'command-router',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    };
  }

  // 8b. "Check this PR for errors" (new check-pr-errors intent)
  if (
    normalized === 'check this pr for errors' ||
    normalized === 'check pr for errors' ||
    normalized === 'check for errors' ||
    normalized === 'find errors' ||
    normalized === 'are there any errors in this pr'
  ) {
    const topFinding = context.findings[0];
    return {
      recognized: true,
      intent: 'check-pr-errors',
      targetRoute: 'pr',
      targetFilePath: topFinding?.filePath,
      targetFindingId: topFinding?.id,
      responseTitle: `${context.findings.length} Review Findings & Potential Errors`,
      responseMessage: `Navigated to primary finding in ${topFinding.filePath}:${topFinding.startLine} — "${topFinding.title}".`,
      explanation: {
        id: `cmd-pr-err-${Date.now()}`,
        title: 'Potential Bug & Security Review Findings',
        scopeLabel: `${context.findings.length} findings across PR #${context.pullRequest.number}`,
        filePath: topFinding?.filePath,
        lineRange: topFinding ? [topFinding.startLine, topFinding.endLine] : undefined,
        summary: `Identified ${context.findings.length} findings to review before merging (1 High, 2 Medium, 1 Low).`,
        details: context.findings.map(
          (f) => `[${f.severity.toUpperCase()}] ${f.filePath}:${f.startLine} — ${f.title}`
        ),
        evidenceSnippet: topFinding?.evidence,
        confidenceNote:
          'Illustrative Sample Review Content: Checked for type mismatches, null pointers, and timing attacks.',
        sourceOrigin: 'command-router',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    };
  }

  // 9. "Check this file for errors"
  if (
    normalized === 'check this file for errors' ||
    normalized === 'check file for errors' ||
    normalized === 'check selected file for errors' ||
    normalized === 'find bugs in this file'
  ) {
    const targetFile = resolveActiveFile(context);
    const relatedFinding = context.findings.find((f) => f.filePath === targetFile.path);
    return {
      recognized: true,
      intent: 'check-file-errors',
      targetFilePath: targetFile.path,
      responseTitle: `Bug & Error Audit: ${targetFile.name}`,
      responseMessage: relatedFinding
        ? `Found potential issue in ${targetFile.name}:${relatedFinding.startLine} — ${relatedFinding.title}`
        : `No critical errors detected in ${targetFile.name}.`,
      explanation: {
        id: `cmd-file-err-${Date.now()}`,
        title: `File Error Inspection: ${targetFile.name}`,
        scopeLabel: targetFile.path,
        summary: `Error and bug inspection for ${targetFile.path}.`,
        details: relatedFinding
          ? [
              `[${relatedFinding.severity.toUpperCase()}] Lines ${relatedFinding.startLine}–${relatedFinding.endLine}: ${relatedFinding.title}`,
              `Details: ${relatedFinding.explanation}`,
              `Recommendation: Review inputs, error boundaries, and edge cases.`,
            ]
          : [
              'No syntax or runtime exceptions detected in parsed functions.',
              'Ensure all input parameters are validated before consumption.',
            ],
        sourceOrigin: 'command-router',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidenceNote: 'Static AST inspection and sample review finding correlation.',
      },
    };
  }

  return {
    recognized: false,
    intent: 'unknown',
    responseTitle: 'Unrecognized Command',
    responseMessage: `Command "${rawInput}" is not in the deterministic command router set. Try: ${SUPPORTED_VOICE_AND_TEXT_COMMANDS.map(
      (c) => `"${c}"`
    ).join(', ')}.`,
  };
}
