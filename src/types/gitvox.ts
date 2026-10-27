export type SystemStatus =
  | 'Idle'
  | 'Uploading'
  | 'Parsing'
  | 'Ready'
  | 'Analyzing'
  | 'Completed'
  | 'Failed'
  | 'Unsupported'
  | 'Unavailable integration';

export type RouteId = 'home' | 'explore' | 'project' | 'pr';

export interface CodeFunction {
  name: string;
  startLine: number;
  endLine: number;
  signature: string;
  summary: string;
}

export interface ProjectFile {
  path: string;
  name: string;
  folder: string;
  language: string;
  sizeBytes: number;
  content: string;
  functions: CodeFunction[];
}

export interface LoadedProject {
  id: string;
  name: string;
  sourceType: 'sample' | 'single-file' | 'zip-archive';
  description: string;
  files: ProjectFile[];
  totalSizeBytes: number;
  excludedPaths: string[];
  loadedAt: string;
  isCompleteScope: boolean;
  scopeNotice: string;
}

export interface DiffLine {
  type: 'unchanged' | 'added' | 'deleted';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export interface SplitDiffRow {
  leftLineNumber: number | null;
  leftContent: string | null;
  leftType: 'unchanged' | 'deleted' | 'empty';
  rightLineNumber: number | null;
  rightContent: string | null;
  rightType: 'unchanged' | 'added' | 'empty';
}

export interface DiffHunk {
  id: string;
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  explanation: string;
}

export interface FileDiffResult {
  additions: number;
  deletions: number;
  unifiedLines: DiffLine[];
  splitRows: SplitDiffRow[];
  hunks: DiffHunk[];
}

export interface PRFileChange {
  path: string;
  language: string;
  summary: string;
  baseContent: string;
  proposedContent: string;
  expectedAdditions: number;
  expectedDeletions: number;
}

export interface PullRequestData {
  id: string;
  number: number;
  title: string;
  repository: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  status: 'Open' | 'Merged' | 'Closed';
  ciStatus: string;
  isSampleData: boolean;
  filesChangedCount: number;
  additionsCount: number;
  deletionsCount: number;
  overview: string;
  purpose: string;
  files: PRFileChange[];
}

export type FindingSeverity = 'high' | 'medium' | 'low';

export interface ReviewFinding {
  id: string;
  title: string;
  severity: FindingSeverity;
  filePath: string;
  startLine: number;
  endLine: number;
  summary: string;
  explanation: string;
  evidence: string;
  uncertainty: string;
  isSampleContent: boolean;
}

export interface AIExplanation {
  id: string;
  title: string;
  scopeLabel: string;
  summary: string;
  details: string[];
  filePath?: string;
  lineRange?: [number, number];
  evidenceSnippet?: string;
  confidenceNote: string;
  sourceOrigin: 'sample-grounded' | 'command-router' | 'live-model';
  timestamp: string;
}

/**
 * Phase 2 live-model types.
 * `ModelExplanation` always originates from an actual provider response; any
 * locally generated explanation stays an `AIExplanation` and is labelled as
 * deterministic sample-grounded output.
 */
export interface ModelStatus {
  configured: boolean;
  model: string;
  providerLabel: string;
  endpointHost: string | null;
}

export interface ModelHunkLine {
  type: 'unchanged' | 'added' | 'deleted';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export interface ModelExplainRequest {
  pullRequest: {
    number: number;
    title: string;
    repository: string;
    author: string;
    sourceBranch: string;
    targetBranch: string;
    overview: string;
    purpose: string;
  };
  file: {
    path: string;
    language: string;
    summary: string;
    baseContent: string;
    proposedContent: string;
  };
  hunk: {
    header: string;
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: ModelHunkLine[];
  };
}

export interface ModelUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ModelExplanation {
  text: string;
  model: string;
  provider: string;
  usage?: ModelUsage;
  latencyMs: number;
  generatedAt: string;
  truncatedContext?: boolean;
}

export interface ModelErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
}

export type AssistantAction =
  | 'explain-pr'
  | 'summarize-pr'
  | 'explain-file'
  | 'explain-range'
  | 'explain-function';

export interface AssistantPrFileContext {
  path: string;
  language: string;
  summary: string;
  baseContent: string;
  proposedContent: string;
  additions: number;
  deletions: number;
}

export interface AssistantProjectContext {
  name: string;
  description: string;
  files: Array<{ path: string; language: string }>;
}

export interface AssistantFunctionContext {
  name: string;
  signature: string;
  summary: string;
  startLine: number;
  endLine: number;
}

export interface AssistantFileContext {
  path: string;
  language: string;
  summary: string;
  content: string;
  functions: AssistantFunctionContext[];
}

export interface AssistantRequest {
  action: AssistantAction;
  transcript: string;
  pullRequest?: {
    number: number;
    title: string;
    repository: string;
    author: string;
    sourceBranch: string;
    targetBranch: string;
    overview: string;
    purpose: string;
    files: AssistantPrFileContext[];
  };
  project?: AssistantProjectContext;
  file?: AssistantFileContext;
  range?: { startLine: number; endLine: number };
  function?: { name: string; startLine: number; endLine: number };
}

export interface CommandResult {
  recognized: boolean;
  intent:
    | 'explain-project'
    | 'summarize-file'
    | 'explain-function'
    | 'select-file'
    | 'explain-pr'
    | 'summarize-changes'
    | 'check-bugs'
    | 'explain-line-range'
    | 'navigate-finding'
    | 'unknown';
  targetFilePath?: string;
  targetFindingId?: string;
  targetRoute?: RouteId;
  responseTitle: string;
  responseMessage: string;
  explanation?: AIExplanation;
}
