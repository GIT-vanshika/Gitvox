import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Columns,
  Cpu,
  FileCode,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  Info,
  Loader2,
  Mic,
  RotateCcw,
  Rows,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { GitvoxWordmark } from '../components/common/GitvoxBrand';
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
  onOpenVoiceModal: () => void;
}

function formatGeneratedTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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
  onOpenVoiceModal,
}) => {
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified');
  const [fileSearch, setFileSearch] = useState('');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [highlightedLineRange, setHighlightedLineRange] = useState<[number, number] | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [mobileTab, setMobileTab] = useState<'files' | 'diff' | 'review'>('diff');

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
    return (
      pullRequest.files.find((f) => f.path === selectedFilePath) ||
      pullRequest.files[0]
    );
  }, [pullRequest.files, selectedFilePath]);

  const activeDiff = useMemo(() => {
    return computeFileDiff(
      activeFile.baseContent,
      activeFile.proposedContent,
      activeFile.path
    );
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#080A0F] text-[#F1F5FC] flex flex-col">
      {/* Top Bar */}
      <header className="bg-[#0D111A] border-b border-[#263247] px-4 py-2.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <GitvoxWordmark onClick={() => onNavigate('home')} />
            <span className="text-[#77849A] text-xs" aria-hidden="true">
              /
            </span>
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <GitPullRequest className="w-3.5 h-3.5 text-[#397BFF] shrink-0" aria-hidden="true" />
              <span className="font-mono text-[#A0AEC2] truncate">{pullRequest.repository}</span>
              <span className="text-[#77849A] shrink-0" aria-hidden="true">
                ·
              </span>
              <span className="font-mono font-semibold text-[#F1F5FC] whitespace-nowrap shrink-0">
                PR #{pullRequest.number}
              </span>
              <span className="text-[#77849A] hidden md:inline shrink-0" aria-hidden="true">
                ·
              </span>
              <span
                data-testid="pr-review-progress"
                className="font-mono tabular-nums text-[#39D98A] hidden md:inline whitespace-nowrap shrink-0"
              >
                {reviewedCount} / {pullRequest.filesChangedCount} files reviewed
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenVoiceModal}
              className="px-3 py-1.5 text-xs font-medium bg-[#121926] hover:bg-[#192234] text-[#F1F5FC] border border-[#263247] rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-[#FF294F]" aria-hidden="true" />
              <span>Voice & Command Router</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('project')}
              className="px-3 py-1.5 text-xs font-medium bg-[#080A0F] hover:bg-[#121926] text-[#A0AEC2] hover:text-[#F1F5FC] border border-[#263247] rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Project Workspace</span>
            </button>
          </div>
        </div>
      </header>

      {/* Pull-Request Summary Header Strip */}
      <section
        aria-label="Pull Request Summary"
        className="bg-[#0D111A] border-b border-[#263247] px-4 py-3.5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#A0AEC2]">
              <span className="font-semibold text-[#39D98A]">Status: {pullRequest.status}</span>
              <span aria-hidden="true">·</span>
              <span>
                Author: <strong className="text-[#F1F5FC]">{pullRequest.author}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-mono text-[#5EA1FF]">
                <GitBranch className="w-3 h-3" aria-hidden="true" />
                {pullRequest.sourceBranch} → {pullRequest.targetBranch}
              </span>
              <span aria-hidden="true">·</span>
              <span>CI: {pullRequest.ciStatus}</span>
            </div>

            <h1 className="mt-1.5 text-base sm:text-lg font-bold text-[#F1F5FC]">
              {pullRequest.title}{' '}
              <span className="font-mono text-sm font-normal text-[#77849A]">
                #{pullRequest.number}
              </span>
            </h1>
          </div>

          {/* Unboxed Tabular Diff Stats & Review Progress */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums shrink-0">
            <div>
              <span className="text-[#A0AEC2]">Files changed:</span>{' '}
              <strong className="text-[#F1F5FC]">{pullRequest.filesChangedCount}</strong>
            </div>
            <div>
              <span className="text-[#39D98A] font-semibold">+{pullRequest.additionsCount}</span>{' '}
              <span className="text-[#FF526F] font-semibold">-{pullRequest.deletionsCount}</span>
            </div>
            <div className="px-2.5 py-1 bg-[#121926] border border-[#263247] rounded text-[#F1F5FC]">
              Reviewed: {reviewedCount} / {pullRequest.filesChangedCount}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Navigation Tabs */}
      <div className="flex lg:hidden bg-[#0D111A] border-b border-[#263247] px-4 py-2 gap-2">
        <button
          type="button"
          onClick={() => setMobileTab('files')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            mobileTab === 'files'
              ? 'bg-[#397BFF] text-[#F1F5FC]'
              : 'bg-[#121926] text-[#A0AEC2]'
          }`}
        >
          Files ({reviewedCount}/{pullRequest.filesChangedCount})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('diff')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            mobileTab === 'diff'
              ? 'bg-[#397BFF] text-[#F1F5FC]'
              : 'bg-[#121926] text-[#A0AEC2]'
          }`}
        >
          Diff Viewer
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('review')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            mobileTab === 'review'
              ? 'bg-[#397BFF] text-[#F1F5FC]'
              : 'bg-[#121926] text-[#A0AEC2]'
          }`}
        >
          AI Review ({findings.length})
        </button>
      </div>

      {/* Main 3-Pane Code Review Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: Changed-File Explorer */}
        <aside
          aria-label="Changed Files Explorer"
          className={`${
            mobileTab === 'files' ? 'flex' : 'hidden'
          } lg:flex lg:w-72 w-full flex-col bg-[#0D111A] border-r border-[#263247] shrink-0`}
        >
          <div className="p-3.5 border-b border-[#263247] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#F1F5FC]">
              Changed Files ({pullRequest.filesChangedCount})
            </h2>
            <span className="text-[11px] font-mono text-[#77849A] tabular-nums">
              {reviewedCount}/{pullRequest.filesChangedCount} done
            </span>
          </div>

          <div className="p-3 border-b border-[#263247]">
            <label htmlFor="pr-file-search" className="sr-only">
              Search changed files
            </label>
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-[#77849A] absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="pr-file-search"
                type="text"
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                placeholder="Filter changed files..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-[#080A0F] border border-[#263247] rounded text-[#F1F5FC] placeholder-[#77849A] focus:border-[#5EA1FF] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#263247]/50">
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
                  className={`w-full px-3.5 py-3 text-left transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#121926] text-[#F1F5FC]'
                      : 'text-[#A0AEC2] hover:bg-[#121926]/60 hover:text-[#F1F5FC]'
                  }`}
                >
                  <div className="min-w-0 flex items-start gap-2">
                    {isReviewed ? (
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-[#39D98A] mt-0.5 shrink-0"
                        aria-label="Reviewed"
                      />
                    ) : (
                      <FileCode
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          isSelected ? 'text-[#5EA1FF]' : 'text-[#77849A]'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-medium truncate">{file.path}</div>
                      <div className="text-[11px] text-[#77849A] mt-0.5 truncate">
                        {isReviewed ? 'Reviewed' : 'Pending review'}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono tabular-nums shrink-0 flex items-center gap-1.5">
                    <span className="text-[#39D98A]">+{file.expectedAdditions}</span>
                    <span className="text-[#FF526F]">-{file.expectedDeletions}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-[#080A0F] border-t border-[#263247] text-[11px] text-[#77849A]">
            Sample PR Data: Base and proposed versions are compared dynamically via LCS diffing.
          </div>
        </aside>

        {/* CENTER PANE: Diff Viewer (Visual Center of the Review Workspace) */}
        <main
          className={`${
            mobileTab === 'diff' ? 'flex' : 'hidden'
          } lg:flex flex-1 flex-col min-w-0 bg-[#080A0F]`}
        >
          {/* Diff Toolbar */}
          <div className="px-4 py-2.5 bg-[#121926] border-b border-[#263247] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCode className="w-4 h-4 text-[#397BFF] shrink-0" aria-hidden="true" />
              <h2 className="text-xs font-mono font-semibold text-[#F1F5FC] truncate">
                {activeFile.path}
              </h2>
              <span className="text-xs font-mono tabular-nums text-[#39D98A]">
                +{activeDiff.additions}
              </span>
              <span className="text-xs font-mono tabular-nums text-[#FF526F]">
                -{activeDiff.deletions}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Unified vs Split Diff Mode Toggle */}
              <div className="flex items-center gap-1 p-0.5 bg-[#080A0F] border border-[#263247] rounded-md">
                <button
                  type="button"
                  onClick={() => setDiffMode('unified')}
                  className={`px-2.5 py-1 text-xs font-medium rounded inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    diffMode === 'unified'
                      ? 'bg-[#397BFF] text-[#F1F5FC]'
                      : 'text-[#A0AEC2] hover:text-[#F1F5FC]'
                  }`}
                >
                  <Rows className="w-3 h-3" aria-hidden="true" />
                  <span>Unified</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiffMode('split')}
                  className={`px-2.5 py-1 text-xs font-medium rounded inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    diffMode === 'split'
                      ? 'bg-[#397BFF] text-[#F1F5FC]'
                      : 'text-[#A0AEC2] hover:text-[#F1F5FC]'
                  }`}
                >
                  <Columns className="w-3 h-3" aria-hidden="true" />
                  <span>Split</span>
                </button>
              </div>

              {/* Per-File Reviewed Toggle Button */}
              <button
                type="button"
                onClick={() => onToggleFileReviewed(activeFile.path)}
                className={`px-3 py-1 text-xs font-semibold rounded border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isCurrentFileReviewed
                    ? 'bg-[#39D98A]/15 border-[#39D98A] text-[#39D98A]'
                    : 'bg-[#080A0F] border-[#263247] text-[#F1F5FC] hover:border-[#397BFF]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isCurrentFileReviewed ? 'Reviewed' : 'Mark as Reviewed'}</span>
              </button>
            </div>
          </div>

          {/* Hunk Action Strip */}
          <div className="px-4 py-2 bg-[#0D111A] border-b border-[#263247] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#A0AEC2]">{activeFile.summary}</span>
            <div className="flex flex-wrap items-center gap-2">
              {activeDiff.hunks.map((hunk, idx) => (
                <div
                  key={hunk.id}
                  className="inline-flex items-stretch rounded border border-[#263247] overflow-hidden"
                >
                  <button
                    type="button"
                    title={`Send ${hunk.header} and the full file context to the live open-weight model`}
                    onClick={() => handleExplainHunkWithModel(activeFile, hunk)}
                    className="px-2.5 py-1 text-[11px] font-mono bg-[#121926] hover:bg-[#397BFF] text-[#5EA1FF] hover:text-[#F1F5FC] transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    <span>Explain Hunk #{idx + 1}</span>
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
                    className="px-2 py-1 text-[10px] font-mono bg-[#0D111A] hover:bg-[#192234] text-[#77849A] hover:text-[#A0AEC2] border-l border-[#263247] transition-colors cursor-pointer"
                  >
                    Local
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Diff Code Table */}
          <div className="flex-1 overflow-auto font-mono text-xs leading-relaxed">
            {diffMode === 'unified' ? (
              <div className="py-2 min-w-[640px]">
                {activeDiff.unifiedLines.map((line, index) => {
                  const isHighlighted =
                    highlightedLineRange !== null &&
                    line.newLineNumber !== null &&
                    line.newLineNumber >= highlightedLineRange[0] &&
                    line.newLineNumber <= highlightedLineRange[1];

                  const rowBg = isHighlighted
                    ? 'bg-[#FF294F]/20'
                    : line.type === 'added'
                    ? 'bg-[#39D98A]/10 text-[#F1F5FC]'
                    : line.type === 'deleted'
                    ? 'bg-[#FF526F]/10 text-[#A0AEC2]'
                    : 'text-[#A0AEC2] hover:bg-[#121926]/50';

                  const prefix =
                    line.type === 'added' ? '+' : line.type === 'deleted' ? '-' : ' ';

                  return (
                    <div
                      key={`${activeFile.path}-u-${index}`}
                      onClick={() => {
                        if (line.newLineNumber) {
                          setHighlightedLineRange([line.newLineNumber, line.newLineNumber]);
                        }
                      }}
                      className={`px-4 py-0.5 flex items-baseline gap-3 cursor-pointer ${rowBg}`}
                    >
                      <span className="w-7 text-right text-[11px] text-[#77849A] select-none tabular-nums shrink-0">
                        {line.oldLineNumber ?? ''}
                      </span>
                      <span className="w-7 text-right text-[11px] text-[#77849A] select-none tabular-nums shrink-0">
                        {line.newLineNumber ?? ''}
                      </span>
                      <span
                        className={`w-3 select-none shrink-0 font-bold ${
                          line.type === 'added'
                            ? 'text-[#39D98A]'
                            : line.type === 'deleted'
                            ? 'text-[#FF526F]'
                            : 'text-[#77849A]'
                        }`}
                      >
                        {prefix}
                      </span>
                      <span className="whitespace-pre flex-1">
                        {renderHighlightedLine(line.content)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Split Diff View */
              <div className="py-2 min-w-[820px] divide-y divide-[#263247]/30">
                <div className="grid grid-cols-2 bg-[#0D111A] border-b border-[#263247] text-[11px] text-[#77849A] font-sans font-medium">
                  <div className="px-4 py-1.5 border-r border-[#263247]">
                    Base ({pullRequest.targetBranch})
                  </div>
                  <div className="px-4 py-1.5">Proposed ({pullRequest.sourceBranch})</div>
                </div>
                {activeDiff.splitRows.map((row, idx) => {
                  const leftBg =
                    row.leftType === 'deleted'
                      ? 'bg-[#FF526F]/10 text-[#A0AEC2]'
                      : row.leftType === 'empty'
                      ? 'bg-[#0D111A]/60'
                      : 'text-[#A0AEC2]';
                  const rightBg =
                    row.rightType === 'added'
                      ? 'bg-[#39D98A]/10 text-[#F1F5FC]'
                      : row.rightType === 'empty'
                      ? 'bg-[#0D111A]/60'
                      : 'text-[#A0AEC2]';

                  return (
                    <div key={`${activeFile.path}-s-${idx}`} className="grid grid-cols-2">
                      {/* Left (Base) */}
                      <div
                        className={`px-3 py-0.5 border-r border-[#263247] flex items-baseline gap-2.5 overflow-x-auto ${leftBg}`}
                      >
                        <span className="w-6 text-right text-[11px] text-[#77849A] select-none tabular-nums shrink-0">
                          {row.leftLineNumber ?? ''}
                        </span>
                        <span className="w-3 select-none shrink-0 font-bold text-[#FF526F]">
                          {row.leftType === 'deleted' ? '-' : ' '}
                        </span>
                        <span className="whitespace-pre">
                          {row.leftContent !== null ? renderHighlightedLine(row.leftContent) : ''}
                        </span>
                      </div>

                      {/* Right (Proposed) */}
                      <div
                        className={`px-3 py-0.5 flex items-baseline gap-2.5 overflow-x-auto ${rightBg}`}
                      >
                        <span className="w-6 text-right text-[11px] text-[#77849A] select-none tabular-nums shrink-0">
                          {row.rightLineNumber ?? ''}
                        </span>
                        <span className="w-3 select-none shrink-0 font-bold text-[#39D98A]">
                          {row.rightType === 'added' ? '+' : ' '}
                        </span>
                        <span className="whitespace-pre">
                          {row.rightContent !== null ? renderHighlightedLine(row.rightContent) : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT PANE: AI Review Findings & Contextual Explanations */}
        <aside
          aria-label="AI Review Panel"
          className={`${
            mobileTab === 'review' ? 'flex' : 'hidden'
          } lg:flex lg:w-96 w-full flex-col bg-[#0D111A] border-l border-[#263247] shrink-0`}
        >
          <div className="p-3.5 border-b border-[#263247] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#F1F5FC]">
              Contextual Review & Findings
            </h2>
            <span className="text-[11px] font-mono text-[#77849A]">
              Sample Review Content
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {/* Phase 2: Live open-weight model, called through the server-side bridge */}
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F1F5FC] inline-flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#5EA1FF]" aria-hidden="true" />
                  <span>Live Open-Weight Model</span>
                </span>
                <span className="text-[10px] font-mono text-[#77849A]">key server-side</span>
              </div>

              {modelStatusError && (
                <div className="p-2.5 bg-[#FF294F]/10 border border-[#FF294F]/40 rounded-md text-[11px] text-[#FFB3C0]">
                  <div className="font-semibold text-[#FF526F]">Model bridge unreachable</div>
                  <p className="mt-0.5 leading-relaxed">{modelStatusError}</p>
                  <p className="mt-1 text-[10px] text-[#77849A]">
                    Start the client and API together with <code>npm run dev</code>.
                  </p>
                </div>
              )}

              {modelStatus && !modelStatus.configured && (
                <div className="p-2.5 bg-[#F5B84B]/10 border border-[#F5B84B]/40 rounded-md text-[11px] text-[#F5D9A0]">
                  <div className="font-semibold text-[#F5B84B]">Live model not configured</div>
                  <p className="mt-0.5 leading-relaxed">
                    Add <code>MODEL_API_KEY</code> to <code>.env</code> and restart the API
                    server. Local grounded summaries remain available and are never presented as
                    model output.
                  </p>
                </div>
              )}

              {modelStatus?.configured && (
                <div className="text-[10px] font-mono text-[#77849A] break-all">
                  {modelStatus.model} · {modelStatus.providerLabel}
                  {modelStatus.endpointHost ? ` · ${modelStatus.endpointHost}` : ''}
                </div>
              )}

              {modelRun.status === 'idle' && modelStatus?.configured && (
                <p className="text-[11px] text-[#77849A] leading-relaxed">
                  Select <span className="text-[#A0AEC2]">Explain Hunk</span> in the diff toolbar
                  to send that exact hunk plus the full base and proposed file to the model.
                </p>
              )}

              {modelRun.status === 'loading' && (
                <div className="p-3.5 bg-[#080A0F] border border-[#397BFF] rounded-md text-xs">
                  <div className="flex items-center gap-2 font-semibold text-[#5EA1FF]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Analyzing real diff with {modelRun.model}</span>
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-[#77849A] break-all">
                    {modelRun.filePath} · {modelRun.hunkHeader}
                  </div>
                  <p className="mt-2 text-[11px] text-[#A0AEC2] leading-relaxed">
                    Sent {modelRun.contextChars.toLocaleString()} characters of hunk and file
                    context. Waiting for the model response…
                  </p>
                </div>
              )}

              {modelRun.status === 'success' && (
                <div className="p-3.5 bg-[#080A0F] border border-[#397BFF] rounded-md text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#5EA1FF] inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Live Model Explanation</span>
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold bg-[#397BFF]/15 text-[#5EA1FF] border border-[#397BFF]/40 rounded">
                      LIVE
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-[#77849A] break-all">
                    {modelRun.filePath} · {modelRun.hunkHeader}
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px] text-[#77849A]">
                    <span>{modelRun.explanation.model}</span>
                    <span aria-hidden="true">·</span>
                    <span>{modelRun.explanation.provider}</span>
                    <span aria-hidden="true">·</span>
                    <span>{modelRun.explanation.latencyMs} ms</span>
                    {modelRun.explanation.usage?.totalTokens !== undefined && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{modelRun.explanation.usage.totalTokens} tokens</span>
                      </>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words text-[#D7E0EE] leading-relaxed">
                    {modelRun.explanation.text}
                  </div>
                  {modelRun.explanation.truncatedContext && (
                    <p className="text-[10px] text-[#F5B84B] leading-relaxed">
                      Some file context was truncated before sending. The answer is grounded only
                      in the context shown to the model.
                    </p>
                  )}
                  <div className="pt-2 border-t border-[#263247]/60 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#77849A]">
                      {formatGeneratedTime(modelRun.explanation.generatedAt)} · genuine provider
                      response
                    </span>
                    <button
                      type="button"
                      onClick={retryModelExplanation}
                      className="px-2 py-1 text-[10px] font-semibold bg-[#121926] hover:bg-[#192234] text-[#A0AEC2] hover:text-[#F1F5FC] border border-[#263247] rounded inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>
              )}

              {modelRun.status === 'error' && (
                <div className="p-3.5 bg-[#080A0F] border border-[#FF294F]/50 rounded-md text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-[#FF526F]">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Model explanation failed</span>
                  </div>
                  <div className="font-mono text-[10px] text-[#77849A] break-all">
                    {modelRun.filePath} · {modelRun.hunkHeader} · {modelRun.error.code}
                  </div>
                  <p className="text-[#FFB3C0] leading-relaxed">{modelRun.error.message}</p>
                  {!modelRun.error.retryable && (
                    <p className="text-[10px] text-[#77849A] leading-relaxed">
                      Retry after correcting the server configuration; repeating the same request
                      unchanged will fail again.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={retryModelExplanation}
                      className="px-2.5 py-1 text-[10px] font-semibold bg-[#FF294F]/15 hover:bg-[#FF294F]/25 text-[#FF8FA3] border border-[#FF294F]/40 rounded inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                      <span>Retry explanation</span>
                    </button>
                    <span className="text-[10px] text-[#77849A]">No explanation generated.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Concise PR Purpose & Summary */}
            <div className="p-3.5 bg-[#080A0F] border border-[#263247] rounded-md text-xs space-y-2">
              <div className="font-semibold text-[#F1F5FC]">Pull Request Overview</div>
              <p className="text-[#A0AEC2] leading-relaxed">{pullRequest.overview}</p>
              <p className="text-[#77849A] leading-relaxed pt-1.5 border-t border-[#263247]">
                <strong className="text-[#A0AEC2]">Purpose:</strong> {pullRequest.purpose}
              </p>
            </div>

            {/* Review Findings List */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#F1F5FC]">
                  Illustrative Review Findings ({findings.length})
                </span>
                <span className="text-[11px] text-[#77849A]">Click to jump to code</span>
              </div>

              <div className="space-y-2.5">
                {findings.map((finding) => {
                  const isSelected = selectedFindingId === finding.id;
                  const severityIcon =
                    finding.severity === 'high' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FF294F] shrink-0" />
                    ) : finding.severity === 'medium' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-[#F5B84B] shrink-0" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-[#5EA1FF] shrink-0" />
                    );

                  const severityLabel =
                    finding.severity === 'high'
                      ? 'High Severity'
                      : finding.severity === 'medium'
                      ? 'Medium Severity'
                      : 'Low Severity';

                  const severityColor =
                    finding.severity === 'high'
                      ? 'text-[#FF526F]'
                      : finding.severity === 'medium'
                      ? 'text-[#F5B84B]'
                      : 'text-[#5EA1FF]';

                  const shortFile = finding.filePath.split('/').pop() || finding.filePath;

                  return (
                    <div
                      key={finding.id}
                      className={`p-3.5 bg-[#080A0F] border rounded-md transition-colors text-xs ${
                        isSelected
                          ? 'border-[#FF294F]'
                          : 'border-[#263247] hover:border-[#397BFF]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold whitespace-nowrap shrink-0">
                          {severityIcon}
                          <span className={severityColor}>{severityLabel}</span>
                        </div>
                        <button
                          type="button"
                          title={`Jump to ${finding.filePath} line ${finding.startLine}`}
                          onClick={() => handleSelectFinding(finding)}
                          className="font-mono text-[11px] text-[#5EA1FF] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {shortFile}:L{finding.startLine} →
                        </button>
                      </div>

                      <h3 className="font-semibold text-[#F1F5FC] mt-1.5">{finding.title}</h3>
                      <p className="text-[#A0AEC2] mt-1 leading-relaxed">{finding.explanation}</p>

                      <pre className="mt-2 p-2 bg-[#0D111A] border border-[#263247] rounded font-mono text-[11px] text-[#F1F5FC] overflow-x-auto">
                        {finding.evidence}
                      </pre>

                      <p className="mt-2 pt-1.5 border-t border-[#263247]/60 text-[10px] text-[#77849A] leading-relaxed">
                        {finding.uncertainty}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Latest Hunk / Command Explanations (deterministic local output) */}
            {explanations.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-[#F1F5FC]">
                    Contextual Diff & Command Output
                  </span>
                  <span className="text-[10px] font-mono text-[#77849A]">
                    local · no model call
                  </span>
                </div>
                <div className="space-y-2.5">
                  {explanations.slice(0, 3).map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3 bg-[#080A0F] border border-[#263247] rounded-md text-xs space-y-1.5"
                    >
                      <div className="font-semibold text-[#5EA1FF]">{exp.title}</div>
                      <div className="text-[11px] font-mono text-[#77849A]">{exp.scopeLabel}</div>
                      <p className="text-[#A0AEC2] leading-relaxed">{exp.summary}</p>
                      <div className="text-[10px] text-[#77849A] pt-1 border-t border-[#263247]/60">
                        {exp.confidenceNote}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Command Input */}
          <form
            onSubmit={handleCommandFormSubmit}
            className="p-3 bg-[#121926] border-t border-[#263247]"
          >
            <label htmlFor="pr-command-input" className="sr-only">
              Run a review command
            </label>
            <div className="flex items-center gap-2">
              <input
                id="pr-command-input"
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder='e.g., "Summarize the changes" or "Check for bugs"'
                className="flex-1 px-3 py-2 text-xs bg-[#080A0F] border border-[#263247] rounded text-[#F1F5FC] placeholder-[#77849A] focus:border-[#5EA1FF] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Run Review Command"
                className="px-3 py-2 text-xs font-semibold bg-[#397BFF] hover:bg-[#5EA1FF] text-[#F1F5FC] rounded transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Run</span>
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
};
