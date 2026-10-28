import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Columns,
  X,
  FileCode,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  Info,
  Loader2,
  Rows,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { GitvoxWordmark } from '../components/common/GitvoxBrand';
import { AssistantMarkdown } from '../components/voice/AssistantMarkdown';
import { computeFileDiff } from '../services/diffService';
import {
  buildExplainRequest,
  explainHunkWithModel,
  fetchModelStatus,
  toModelErrorInfo,
} from '../services/modelService';
import { renderHighlightedLine } from '../utils/syntaxHighlight';
import {
  AIExplanation,
  DiffHunk,
  ModelErrorInfo,
  ModelExplanation,
  ModelStatus,
  PRFileChange,
  PullRequestData,
  ReviewFinding,
  RouteId,
} from '../types/gitvox';

type ModelRun =
  | { status: 'idle' }
  | {
      status: 'loading';
      filePath: string;
      hunkHeader: string;
      model: string;
      contextChars: number;
    }
  | {
      status: 'success';
      filePath: string;
      hunkHeader: string;
      explanation: ModelExplanation;
    }
  | {
      status: 'error';
      filePath: string;
      hunkHeader: string;
      error: ModelErrorInfo;
    };

interface PullRequestPageProps {
  pullRequest: PullRequestData;
  findings: ReviewFinding[];
  selectedFilePath: string;
  onSelectFile: (filePath: string) => void;
  reviewedFiles: Record<string, boolean>;
  onToggleFileReviewed: (filePath: string) => void;
  explanations: AIExplanation[];
  onExplainHunk: (filePath: string, hunk: DiffHunk, fileSummary: string) => void;
  onExecuteCommand: (command: string) => void;
  onNavigate: (route: RouteId) => void;
  onOpenChat?: () => void;
}

const severityClass = (severity: ReviewFinding['severity']) =>
  severity === 'high' ? 'sev-high' : severity === 'medium' ? 'sev-medium' : 'sev-low';

const severityIcon = (severity: ReviewFinding['severity']) =>
  severity === 'high' ? (
    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
  ) : severity === 'medium' ? (
    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
  ) : (
    <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
  );

export const PullRequestPage: React.FC<PullRequestPageProps> = ({
  pullRequest,
  findings,
  selectedFilePath,
  onSelectFile,
  reviewedFiles,
  onToggleFileReviewed,
  explanations,
  onExplainHunk,
  onExecuteCommand,
  onNavigate,
  onOpenChat,
}) => {
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified');
  const [fileSearch, setFileSearch] = useState('');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [highlightedLineRange, setHighlightedLineRange] = useState<[number, number] | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [showCommandInput, setShowCommandInput] = useState(false);
  const [mobileTab, setMobileTab] = useState<'files' | 'diff' | 'review'>('diff');
  const [dismissedExplanationIds, setDismissedExplanationIds] = useState<string[]>([]);

  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [modelStatusError, setModelStatusError] = useState<string | null>(null);
  const [modelRun, setModelRun] = useState<ModelRun>({ status: 'idle' });
  const modelRequestId = useRef(0);
  const lastModelTarget = useRef<{ file: PRFileChange; hunk: DiffHunk } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchModelStatus()
      .then((status) => {
        if (!cancelled) {
          setModelStatus(status);
          setModelStatusError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setModelStatusError(toModelErrorInfo(error).message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFile = useMemo(() => {
    return pullRequest.files.find((f) => f.path === selectedFilePath) || pullRequest.files[0];
  }, [pullRequest.files, selectedFilePath]);

  const activeDiff = useMemo(() => {
    return computeFileDiff(activeFile.baseContent, activeFile.proposedContent, activeFile.path);
  }, [activeFile]);

  const filteredFiles = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    if (!q) return pullRequest.files;
    return pullRequest.files.filter(
      (f) => f.path.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q)
    );
  }, [pullRequest.files, fileSearch]);

  const reviewedCount = useMemo(() => {
    return pullRequest.files.filter((f) => Boolean(reviewedFiles[f.path])).length;
  }, [pullRequest.files, reviewedFiles]);

  const isCurrentFileReviewed = Boolean(reviewedFiles[activeFile.path]);

  const visibleExplanations = explanations.filter(
    (exp) => !dismissedExplanationIds.includes(exp.id)
  );

  const handleSelectFinding = (finding: ReviewFinding) => {
    setSelectedFindingId(finding.id);
    onSelectFile(finding.filePath);
    setHighlightedLineRange([finding.startLine, finding.endLine]);
    setMobileTab('diff');
  };

  const handleCommandFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commandInput.trim();
    if (!trimmed) return;
    onExecuteCommand(trimmed);
    setCommandInput('');
  };

  const runModelExplanation = async (file: PRFileChange, hunk: DiffHunk) => {
    const requestId = ++modelRequestId.current;
    lastModelTarget.current = { file, hunk };

    const request = buildExplainRequest(pullRequest, file, hunk);
    const contextChars =
      request.file.baseContent.length +
      request.file.proposedContent.length +
      request.hunk.lines.reduce((total, line) => total + line.content.length, 0);

    setModelRun({
      status: 'loading',
      filePath: file.path,
      hunkHeader: hunk.header,
      model: modelStatus?.model || 'the configured open-weight model',
      contextChars,
    });

    try {
      const explanation = await explainHunkWithModel(request);
      if (requestId !== modelRequestId.current) return;
      setModelRun({
        status: 'success',
        filePath: file.path,
        hunkHeader: hunk.header,
        explanation,
      });
    } catch (error) {
      if (requestId !== modelRequestId.current) return;
      setModelRun({
        status: 'error',
        filePath: file.path,
        hunkHeader: hunk.header,
        error: toModelErrorInfo(error),
      });
    }
  };

  const retryModelExplanation = () => {
    const target = lastModelTarget.current;
    if (target) {
      void runModelExplanation(target.file, target.hunk);
    }
  };

  const handleExplainHunkWithModel = (file: PRFileChange, hunk: DiffHunk) => {
    setHighlightedLineRange([hunk.newStart, hunk.newStart + Math.max(0, hunk.newLines - 1)]);
    setMobileTab('review');
    void runModelExplanation(file, hunk);
  };

  return (
    <div className="min-h-screen bg-page">
      <header className="app-header">
        <div className="shell app-header__inner justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <GitvoxWordmark onClick={() => onNavigate('home')} />
            <span className="text-faint" aria-hidden="true">
              /
            </span>
            <GitPullRequest className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
            <span className="hidden truncate font-mono text-xs text-body sm:inline">
              {pullRequest.repository}
            </span>
            <span className="font-mono text-xs font-semibold text-ink">
              PR #{pullRequest.number}
            </span>
            <span
              data-testid="pr-review-progress"
              className="chip hidden md:inline-flex"
            >
              {reviewedCount} / {pullRequest.filesChangedCount} reviewed
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('project')}
              className="btn btn-secondary btn-sm"
            >
              <FolderGit2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Project workspace</span>
              <span className="sm:hidden">Project</span>
            </button>
          </div>
        </div>
      </header>

      <main className="shell pb-28 pt-6">
        {/* Pull request summary */}
        <section aria-label="Pull request summary" className="border-b border-line pb-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-body">
                <span className="font-semibold text-[var(--success)]">
                  Status: {pullRequest.status}
                </span>
                <span className="text-faint" aria-hidden="true">
                  ·
                </span>
                <span>
                  Author: <strong className="font-medium text-ink">{pullRequest.author}</strong>
                </span>
                <span className="text-faint" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-faint">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  {pullRequest.sourceBranch} → {pullRequest.targetBranch}
                </span>
                <span className="text-faint" aria-hidden="true">
                  ·
                </span>
                <span>CI: {pullRequest.ciStatus}</span>
              </div>

              <h1 className="mt-1.5 text-lg font-bold tracking-tight text-ink">
                {pullRequest.title}{' '}
                <span className="font-mono text-sm font-normal text-faint">
                  #{pullRequest.number}
                </span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="text-body">
                Files changed:{' '}
                <strong className="font-mono tabular-nums text-ink">
                  {pullRequest.filesChangedCount}
                </strong>
              </span>
              <span className="font-mono tabular-nums">
                <span className="font-semibold text-[var(--success)]">
                  +{pullRequest.additionsCount}
                </span>{' '}
                <span className="font-semibold text-[var(--danger)]">
                  −{pullRequest.deletionsCount}
                </span>
              </span>
              <span className="chip">Reviewed: {reviewedCount} / {pullRequest.filesChangedCount}</span>
            </div>
          </div>
        </section>

        {/* Mobile pane switcher */}
        <div className="tab-bar mt-4 lg:hidden" role="tablist" aria-label="Review panes">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'files'}
            data-active={mobileTab === 'files'}
            onClick={() => setMobileTab('files')}
            className="tab-bar__item"
          >
            Files ({reviewedCount}/{pullRequest.filesChangedCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'diff'}
            data-active={mobileTab === 'diff'}
            onClick={() => setMobileTab('diff')}
            className="tab-bar__item"
          >
            Diff
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'review'}
            data-active={mobileTab === 'review'}
            onClick={() => setMobileTab('review')}
            className="tab-bar__item"
          >
            Review ({findings.length})
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row items-stretch">
          {/* Changed files */}
          <aside
            aria-label="Changed files explorer"
            className={`${
              mobileTab === 'files' ? 'flex' : 'hidden'
            } w-full min-w-0 flex-col rounded-lg border border-line bg-page lg:flex lg:w-56 xl:w-64 lg:shrink-0 h-[calc(100vh-210px)] min-h-[520px] max-h-[820px]`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
              <h2 className="text-xs font-semibold text-ink">
                Changed files ({pullRequest.filesChangedCount})
              </h2>
              <span className="font-mono text-[10px] tabular-nums text-faint">
                {reviewedCount}/{pullRequest.filesChangedCount} done
              </span>
            </div>

            <div className="border-b border-line p-2.5">
              <label htmlFor="pr-file-search" className="sr-only">
                Search changed files
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
                  aria-hidden="true"
                />
                <input
                  id="pr-file-search"
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Filter changed files…"
                  className="field h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
              {filteredFiles.map((file) => {
                const isSelected = file.path === activeFile.path;
                const isReviewed = Boolean(reviewedFiles[file.path]);
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => {
                      onSelectFile(file.path);
                      setHighlightedLineRange(null);
                      setMobileTab('diff');
                    }}
                    className={`flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-[var(--accent-soft)]' : 'hover:bg-soft'
                    }`}
                  >
                    <span className="flex min-w-0 items-start gap-2">
                      {isReviewed ? (
                        <CheckCircle2
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]"
                          aria-label="Reviewed"
                        />
                      ) : (
                        <FileCode
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                            isSelected ? 'text-accent' : 'text-faint'
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[11px] text-body">
                          {file.path}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-faint">
                          {isReviewed ? 'Reviewed' : 'Pending review'}
                        </span>
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] tabular-nums">
                      <span className="text-[var(--success)]">+{file.expectedAdditions}</span>
                      <span className="text-[var(--danger)]">−{file.expectedDeletions}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto border-t border-line px-3 py-2.5 text-[10px] leading-4 text-faint">
              Sample PR data: base and proposed versions are compared via LCS diffing.
            </div>
          </aside>

          {/* Diff viewer */}
          <div
            className={`${mobileTab === 'diff' ? 'flex' : 'hidden'} min-w-0 flex-1 lg:flex lg:flex-col h-[calc(100vh-210px)] min-h-[520px] max-h-[820px]`}
          >
            <section className="code-panel flex flex-1 flex-col overflow-hidden" aria-label={`Diff for ${activeFile.path}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileCode className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                  <h2 className="truncate font-mono text-xs font-semibold text-ink">
                    {activeFile.path}
                  </h2>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--success)]">
                    +{activeDiff.additions}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--danger)]">
                    −{activeDiff.deletions}
                  </span>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="seg" role="group" aria-label="Diff display mode">
                    <button
                      type="button"
                      onClick={() => setDiffMode('unified')}
                      aria-pressed={diffMode === 'unified'}
                      data-active={diffMode === 'unified'}
                      className="seg-item"
                    >
                      <Rows className="h-3 w-3" aria-hidden="true" />
                      Unified
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiffMode('split')}
                      aria-pressed={diffMode === 'split'}
                      data-active={diffMode === 'split'}
                      className="seg-item"
                    >
                      <Columns className="h-3 w-3" aria-hidden="true" />
                      Split
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleFileReviewed(activeFile.path)}
                    className={`btn btn-sm ${
                      isCurrentFileReviewed
                        ? 'border-[var(--accent)] text-accent bg-[var(--accent-soft)]'
                        : 'btn-secondary'
                    }`}
                    aria-pressed={isCurrentFileReviewed}
                  >
                    <CheckCircle2
                      className={`h-3.5 w-3.5 ${
                        isCurrentFileReviewed ? 'text-accent' : 'text-faint'
                      }`}
                      aria-hidden="true"
                    />
                    {isCurrentFileReviewed ? 'Reviewed' : 'Mark reviewed'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-soft px-3 py-2">
                <span className="text-[11px] text-body">{activeFile.summary}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeDiff.hunks.map((hunk, idx) => (
                    <div
                      key={hunk.id}
                      className="inline-flex overflow-hidden rounded border border-line bg-page"
                    >
                      <button
                        type="button"
                        title={`Send ${hunk.header} and the full file context to the live model`}
                        onClick={() => handleExplainHunkWithModel(activeFile, hunk)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-body transition-colors hover:bg-[var(--accent-soft)] hover:text-accent cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        Explain hunk #{idx + 1}
                      </button>
                      <button
                        type="button"
                        title="Deterministic local summary. No model call."
                        onClick={() => {
                          setHighlightedLineRange([
                            hunk.newStart,
                            hunk.newStart + Math.max(0, hunk.newLines - 1),
                          ]);
                          onExplainHunk(activeFile.path, hunk, activeFile.summary);
                          setMobileTab('review');
                        }}
                        className="border-l border-line px-1.5 py-1 text-[10px] text-faint transition-colors hover:bg-soft hover:text-ink cursor-pointer"
                      >
                        Local
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="code-scroll flex-1 py-1">
                {diffMode === 'unified' ? (
                  activeDiff.unifiedLines.map((line, index) => {
                    const isHighlighted =
                      highlightedLineRange !== null &&
                      line.newLineNumber !== null &&
                      line.newLineNumber >= highlightedLineRange[0] &&
                      line.newLineNumber <= highlightedLineRange[1];

                    const rowClass = isHighlighted
                      ? 'diff-row diff-row--focus'
                      : line.type === 'added'
                      ? 'diff-row diff-row--add'
                      : line.type === 'deleted'
                      ? 'diff-row diff-row--del'
                      : 'diff-row hover:bg-soft';

                    const prefix =
                      line.type === 'added' ? '+' : line.type === 'deleted' ? '−' : ' ';
                    const markerTone =
                      line.type === 'added' || line.type === 'deleted'
                        ? ''
                        : 'diff-marker--neutral';

                    return (
                      <div
                        key={`${activeFile.path}-u-${index}`}
                        onClick={() => {
                          if (line.newLineNumber) {
                            setHighlightedLineRange([line.newLineNumber, line.newLineNumber]);
                          }
                        }}
                        className={`${rowClass} py-[1px] ${
                          line.newLineNumber ? 'cursor-pointer' : ''
                        }`}
                      >
                        <span className="code-gutter w-8">{line.oldLineNumber ?? ''}</span>
                        <span className="code-gutter w-8">{line.newLineNumber ?? ''}</span>
                        <span className={`diff-marker ${markerTone}`}>{prefix}</span>
                        <span className="code-source">
                          {renderHighlightedLine(line.content, activeFile.language)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="min-w-[720px]">
                    <div className="grid grid-cols-2 border-b border-line bg-soft text-[10px] font-medium text-faint">
                      <div className="border-r border-line px-3 py-1.5">
                        Base ({pullRequest.targetBranch})
                      </div>
                      <div className="px-3 py-1.5">Proposed ({pullRequest.sourceBranch})</div>
                    </div>

                    {activeDiff.splitRows.map((row, idx) => {
                      const leftBg =
                        row.leftType === 'deleted'
                          ? 'bg-[var(--diff-del-bg)]'
                          : row.leftType === 'empty'
                          ? 'bg-soft'
                          : '';
                      const rightBg =
                        row.rightType === 'added'
                          ? 'bg-[var(--diff-add-bg)]'
                          : row.rightType === 'empty'
                          ? 'bg-soft'
                          : '';

                      return (
                        <div
                          key={`${activeFile.path}-s-${idx}`}
                          className="grid grid-cols-2 border-b border-line last:border-b-0"
                        >
                          <div
                            className={`flex min-w-0 items-start gap-2 border-r border-line px-3 py-[1px] ${leftBg}`}
                          >
                            <span className="w-7 shrink-0 select-none text-right text-[10px] leading-5 tabular-nums text-faint">
                              {row.leftLineNumber ?? ''}
                            </span>
                            <span
                              className={`shrink-0 select-none text-[11px] leading-5 font-semibold ${
                                row.leftType === 'deleted'
                                  ? 'text-[var(--diff-del-line)]'
                                  : 'text-faint'
                              }`}
                            >
                              {row.leftType === 'deleted' ? '−' : ' '}
                            </span>
                            <span className="whitespace-pre text-[12px] leading-5">
                              {row.leftContent !== null
                                ? renderHighlightedLine(row.leftContent, activeFile.language)
                                : ''}
                            </span>
                          </div>

                          <div className={`flex min-w-0 items-start gap-2 px-3 py-[1px] ${rightBg}`}>
                            <span className="w-7 shrink-0 select-none text-right text-[10px] leading-5 tabular-nums text-faint">
                              {row.rightLineNumber ?? ''}
                            </span>
                            <span
                              className={`shrink-0 select-none text-[11px] leading-5 font-semibold ${
                                row.rightType === 'added'
                                  ? 'text-[var(--diff-add-line)]'
                                  : 'text-faint'
                              }`}
                            >
                              {row.rightType === 'added' ? '+' : ' '}
                            </span>
                            <span className="whitespace-pre text-[12px] leading-5">
                              {row.rightContent !== null
                                ? renderHighlightedLine(row.rightContent, activeFile.language)
                                : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};
