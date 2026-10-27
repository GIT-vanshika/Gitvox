import type {
  AssistantFunctionContext,
  AssistantRequest,
  LoadedProject,
  PRFileChange,
  ProjectFile,
  PullRequestData,
  RouteId,
} from '../types/gitvox';
import { resolveActiveFile } from './commandRouter';
import type { VoiceCommandMatch } from './voiceCommands';

export interface AssistantContext {
  route: RouteId;
  pullRequest: PullRequestData;
  selectedPrFile: PRFileChange | null;
  project: LoadedProject;
  selectedFile: ProjectFile | null;
  selectedFunctionName: string | null;
}

export type AssistantRequestResult =
  | { ok: true; request: AssistantRequest; title: string }
  | { ok: false; reason: string };

function toAssistantFunctions(file: ProjectFile): AssistantFunctionContext[] {
  return file.functions.map((fn) => ({
    name: fn.name,
    signature: fn.signature,
    summary: fn.summary,
    startLine: fn.startLine,
    endLine: fn.endLine,
  }));
}

function buildProjectContext(project: LoadedProject) {
  return {
    name: project.name,
    description: project.description,
    files: project.files.slice(0, 80).map((file) => ({
      path: file.path,
      language: file.language,
    })),
  };
}

function buildFileContext(file: ProjectFile) {
  return {
    path: file.path,
    language: file.language,
    summary:
      file.functions.length > 0
        ? `${file.path} contains ${file.functions.length} parsed function${
            file.functions.length === 1 ? '' : 's'
          }: ${file.functions.map((fn) => fn.name).join(', ')}.`
        : `${file.path} is a ${file.language} source file.`,
    content: file.content,
    functions: toAssistantFunctions(file),
  };
}

/**
 * Builds a grounded assistant request from the exact context the user is
 * looking at. PR actions send the real diffs; file/range/function actions send
 * the route-aware selected file and the requested range.
 */
export function buildAssistantRequest(
  match: VoiceCommandMatch,
  context: AssistantContext
): AssistantRequestResult {
  if (match.kind === 'clarify' || match.kind === 'unsupported') {
    return { ok: false, reason: match.message };
  }

  const transcript = match.transcript;

  if (match.kind === 'explain-pr' || match.kind === 'summarize-pr') {
    const pr = context.pullRequest;
    return {
      ok: true,
      title:
        match.kind === 'summarize-pr'
          ? `Summary · PR #${pr.number}`
          : `PR #${pr.number} · ${pr.title}`,
      request: {
        action: match.kind,
        transcript,
        pullRequest: {
          number: pr.number,
          title: pr.title,
          repository: pr.repository,
          author: pr.author,
          sourceBranch: pr.sourceBranch,
          targetBranch: pr.targetBranch,
          overview: pr.overview,
          purpose: pr.purpose,
          files: pr.files.map((file) => ({
            path: file.path,
            language: file.language,
            summary: file.summary,
            baseContent: file.baseContent,
            proposedContent: file.proposedContent,
            additions: file.expectedAdditions,
            deletions: file.expectedDeletions,
          })),
        },
        project: buildProjectContext(context.project),
      },
    };
  }

  const file = resolveActiveFile({
    project: context.project,
    selectedFile: context.selectedFile,
    selectedFunctionName: context.selectedFunctionName,
    pullRequest: context.pullRequest,
    findings: [],
    currentRoute: context.route,
    selectedPrFile: context.selectedPrFile,
  });

  if (match.kind === 'explain-file') {
    return {
      ok: true,
      title: file.path,
      request: {
        action: 'explain-file',
        transcript,
        file: buildFileContext(file),
        project: buildProjectContext(context.project),
      },
    };
  }

  if (match.kind === 'explain-range') {
    const lineCount = Math.max(1, file.content.replace(/\r\n/g, '\n').split('\n').length);
    const startLine = Math.min(Math.max(match.startLine, 1), lineCount);
    const endLine = Math.min(Math.max(match.endLine, startLine), lineCount);

    return {
      ok: true,
      title: `${file.path} · lines ${startLine}–${endLine}`,
      request: {
        action: 'explain-range',
        transcript,
        file: buildFileContext(file),
        range: { startLine, endLine },
        project: buildProjectContext(context.project),
      },
    };
  }

  if (match.kind === 'explain-function') {
    const fn =
      file.functions.find((candidate) => candidate.name === context.selectedFunctionName) ||
      file.functions[0];

    if (!fn) {
      return {
        ok: false,
        reason:
          'No parsed function is available in this file. Select a file with functions or pick a function first.',
      };
    }

    return {
      ok: true,
      title: `${fn.name} · ${file.path}`,
      request: {
        action: 'explain-function',
        transcript,
        file: buildFileContext(file),
        function: {
          name: fn.name,
          startLine: fn.startLine,
          endLine: fn.endLine,
        },
        project: buildProjectContext(context.project),
      },
    };
  }

  return { ok: false, reason: 'This voice request does not map to an assistant action.' };
}