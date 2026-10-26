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
    | 'navigate-finding'
    | 'unknown';
  targetFilePath?: string;
  targetFindingId?: string;
  targetRoute?: RouteId;
  responseTitle: string;
  responseMessage: string;
  explanation?: AIExplanation;
}
