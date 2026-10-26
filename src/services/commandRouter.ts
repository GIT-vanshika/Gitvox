import {
  CommandResult,
  LoadedProject,
  ProjectFile,
  PullRequestData,
  ReviewFinding,
} from '../types/gitvox';
import {
  buildFileExplanation,
  buildFunctionExplanation,
  buildProjectOverviewExplanation,
} from './aiService';

export const SUPPORTED_VOICE_AND_TEXT_COMMANDS = [
  'Explain this project.',
  'Summarize this file.',
  'Explain the selected function.',
  'Show the authentication middleware.',
  'Explain this pull request.',
  'Summarize the changes.',
  'Check these changes for potential bugs.',
];

/**
 * Deterministic local command router shared by both text commands and Alan AI voice intents.
 * Never executes arbitrary actions on vague matches.
 */
export function routeApplicationCommand(
  rawInput: string,
  context: {
    project: LoadedProject;
    selectedFile: ProjectFile | null;
    selectedFunctionName: string | null;
    pullRequest: PullRequestData;
    findings: ReviewFinding[];
  }
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

  // 2. "Summarize this file" / "Explain this file"
  if (
    normalized === 'summarize this file' ||
    normalized === 'explain this file' ||
    normalized === 'summarize file' ||
    normalized === 'explain selected file'
  ) {
    const targetFile = context.selectedFile || context.project.files[0];
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

  // Check explicit file match for other files (e.g. "show tokenService.js", "show validateToken.js", "show userRoutes.js", "show auth.test.js")
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

  // 5. "Explain this pull request"
  if (
    normalized === 'explain this pull request' ||
    normalized === 'explain pull request' ||
    normalized === 'explain pr'
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

  // 7. "Check these changes for potential bugs"
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

  return {
    recognized: false,
    intent: 'unknown',
    responseTitle: 'Unrecognized Command',
    responseMessage: `Command "${rawInput}" is not in the deterministic command router set. Try: ${SUPPORTED_VOICE_AND_TEXT_COMMANDS.map(
      (c) => `"${c}"`
    ).join(', ')}.`,
  };
}
