import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AssistantMarkdown } from '../components/voice/AssistantMarkdown';
import { computeFileDiff, generateUnifiedPatch } from '../services/diffService';
import { fetchGitHubPullRequest } from '../services/gitHubPrService';
import {
  buildExplainRequest,
  explainHunkWithModel,
  fetchModelStatus,
  toModelErrorInfo,
} from '../services/modelService';
import { renderHighlightedLine } from '../utils/syntaxHighlight';
import { getFileIcon } from './ProjectWorkspacePage';
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
  onLoadPullRequest?: (pr: PullRequestData) => void;
  onResetPullRequest?: () => void;
}

export const PullRequestPage: React.FC<PullRequestPageProps> = ({
  pullRequest,
  findings,
  selectedFilePath,
  onSelectFile,
  reviewedFiles,
  onToggleFileReviewed,
  onExplainHunk,
  onExecuteCommand: _onExecuteCommand,
  onNavigate,
  onOpenChat,
  onLoadPullRequest,
  onResetPullRequest,
}) => {
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified');
  const [fileSearch, setFileSearch] = useState('');
  const [highlightedLineRange, setHighlightedLineRange] = useState<[number, number] | null>(null);
  const [mobileTab, setMobileTab] = useState<'files' | 'diff' | 'review'>('diff');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);

  const [prUrlInput, setPrUrlInput] = useState('');
  const [isLoadingPr, setIsLoadingPr] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);

  const handleFetchGitHubPr = async (overrideUrl?: string) => {
    const urlToFetch = (overrideUrl || prUrlInput).trim();
    if (!urlToFetch) return;
    setIsLoadingPr(true);
    setPrError(null);

    try {
      const fetchedPr = await fetchGitHubPullRequest(urlToFetch);
      onLoadPullRequest?.(fetchedPr);
      setPrUrlInput('');
      setSpeechNotice(`Successfully loaded ${fetchedPr.repository} PR #${fetchedPr.number}!`);
      setTimeout(() => setSpeechNotice(null), 4000);
    } catch (err) {
      setPrError(err instanceof Error ? err.message : 'Could not load GitHub PR.');
    } finally {
      setIsLoadingPr(false);
    }
  };

  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [modelRun, setModelRun] = useState<ModelRun>({ status: 'idle' });
  const modelRequestId = useRef(0);
  const lastModelTarget = useRef<{ file: PRFileChange; hunk: DiffHunk } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchModelStatus()
      .then((status) => {
        if (!cancelled) {
          setModelStatus(status);
        }
      })
      .catch(() => {
        // Fallback gracefully if status endpoint is offline
      });
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
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

  const reviewedPercent = Math.round((reviewedCount / pullRequest.files.length) * 100);

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
      model: modelStatus?.model || 'cohere/north-mini-code:free',
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

      // Speak key summary sentence if supported
      if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
        speakText(explanation.text.slice(0, 160));
      }
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

  const handleExplainHunkWithModel = (file: PRFileChange, hunk: DiffHunk) => {
    setHighlightedLineRange([hunk.newStart, hunk.newStart + Math.max(0, hunk.newLines - 1)]);
    setMobileTab('review');
    void runModelExplanation(file, hunk);
  };

  const handleVoiceExplainDiff = () => {
    const targetHunk = activeDiff.hunks[0];
    if (targetHunk) {
      handleExplainHunkWithModel(activeFile, targetHunk);
    } else {
      onExplainHunk(activeFile.path, {
        id: `${activeFile.path}-summary`,
        header: `Diff Summary for ${activeFile.path}`,
        oldStart: 1,
        oldLines: 0,
        newStart: 1,
        newLines: 0,
        lines: activeDiff.unifiedLines,
        explanation: activeFile.summary,
      }, activeFile.summary);
    }
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setSpeechNotice('Speech synthesis not supported in this browser');
      setTimeout(() => setSpeechNotice(null), 3000);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`[\]]/g, '').slice(0, 300);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeechNotice('Speaking AI explanation...');
    setTimeout(() => setSpeechNotice(null), 3000);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleDownloadPatch = () => {
    const patchContent = generateUnifiedPatch(pullRequest.files);
    const blob = new Blob([patchContent], { type: 'text/x-diff;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PR-${pullRequest.number}-${pullRequest.sourceBranch.replace(/\//g, '-')}.patch`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col select-none">
      {/* Top Application Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.35)] border-b border-surface-container-high/60">
        <div className="h-16 w-full px-space-lg flex items-center justify-between gap-space-md">
          {/* Brand & Main Navigation */}
          <div className="flex items-center gap-space-xl">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-space-sm cursor-pointer group text-left"
              type="button"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center border border-surface-container-highest group-hover:border-primary/50 transition-colors">
                <span className="material-symbols-outlined text-amber-400 text-[18px]">terminal</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">Gitvox</span>
                <span className="font-telemetry-tag text-telemetry-tag px-space-xs py-0.5 rounded bg-surface-container-highest text-tertiary uppercase">
                  v2.4
                </span>
              </div>
            </button>

            <nav className="hidden lg:flex items-center gap-space-xs">
              <button
                onClick={() => onNavigate('home')}
                className="px-space-md py-1.5 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body-sm text-body-sm cursor-pointer"
                type="button"
              >
                Overview
              </button>
              <button
                onClick={() => onNavigate('project')}
                className="px-space-md py-1.5 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body-sm text-body-sm cursor-pointer"
                type="button"
              >
                Live Workspace
              </button>
              <button
                onClick={() => onNavigate('pr')}
                aria-current="page"
                className="px-space-md py-1.5 transition-colors bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold rounded cursor-pointer"
                type="button"
              >
                PR Review
              </button>
              <button
                onClick={() => onNavigate('explore')}
                className="px-space-md py-1.5 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body-sm text-body-sm cursor-pointer"
                type="button"
              >
                Upload Source
              </button>
            </nav>
          </div>

          {/* Header Action Items */}
          <div className="flex items-center gap-space-md">
            <div className="hidden sm:flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container-lowest border border-surface-container-high">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="font-telemetry-tag text-telemetry-tag text-primary uppercase">
                IDLE / READY
              </span>
            </div>

            <div className="flex items-center gap-space-sm">
              <button
                onClick={() => onNavigate('project')}
                className="hidden md:inline-flex items-center px-space-md py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-body-sm transition-colors cursor-pointer border border-surface-container-high/60"
                type="button"
              >
                Open Sample Project
              </button>
              <button
                onClick={() => onNavigate('explore')}
                className="inline-flex items-center px-space-md py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-body-sm text-body-sm font-semibold shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
                type="button"
              >
                Upload Code
              </button>
            </div>

            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold shadow-sm">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full pt-16 flex-1 bg-surface flex flex-col">
        {/* GitHub PR URL Ingestion Bar */}
        <section className="w-full bg-surface-container-low border-b border-surface-container-high/60 px-space-lg py-2.5">
          <div className="max-w-[1720px] mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm flex-1 max-w-3xl">
              <div className="flex items-center gap-1.5 text-primary shrink-0 font-telemetry-tag text-telemetry-tag font-semibold">
                <span className="material-symbols-outlined text-[18px]">hub</span>
                <span>GitHub PR Link:</span>
              </div>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={prUrlInput}
                  onChange={(e) => {
                    setPrUrlInput(e.target.value);
                    if (prError) setPrError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleFetchGitHubPr();
                  }}
                  placeholder="Paste any GitHub PR link (e.g. https://github.com/facebook/react/pull/31200)"
                  className="w-full px-3 py-1.5 pl-8 rounded-lg bg-surface-container-lowest border border-surface-container-high focus:border-primary/60 focus:outline-none text-body-sm font-code-block text-on-surface placeholder:text-outline"
                />
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-outline">
                  link
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleFetchGitHubPr()}
                disabled={isLoadingPr || !prUrlInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-on-primary font-body-sm font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isLoadingPr ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">cloud_download</span>
                    <span>Review PR</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Demo PR Switches & Mode Badge */}
            <div className="flex items-center gap-space-md font-telemetry-tag text-telemetry-tag text-on-surface-variant shrink-0 justify-between sm:justify-end">
              {!pullRequest.isSampleData ? (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Live {pullRequest.repository} #{pullRequest.number}
                  </span>
                  {onResetPullRequest && (
                    <button
                      type="button"
                      onClick={onResetPullRequest}
                      className="text-on-surface-variant hover:text-primary transition-colors underline cursor-pointer text-xs"
                    >
                      Reset to Sample PR #284
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-outline">
                  <span>Demo Mode: Sample PR #284</span>
                  <span className="text-outline-variant">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      void handleFetchGitHubPr('https://github.com/facebook/react/pull/31200');
                    }}
                    className="text-tertiary hover:underline cursor-pointer"
                    title="Click to test loading React PR #31200"
                  >
                    Try React #31200
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PR Ingestion Error Toast */}
        {prError && (
          <div className="max-w-[1720px] mx-auto w-full px-space-lg pt-2.5">
            <div className="px-3 py-2 rounded-lg bg-error/15 border border-error/30 text-error text-body-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{prError}</span>
              </div>
              <button
                type="button"
                onClick={() => setPrError(null)}
                className="hover:opacity-75 transition-opacity"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* PR Sub-Header / Breadcrumb & High-Level Actions */}
        <section className="w-full bg-surface-container-lowest px-space-lg py-space-md shadow-sm border-b border-surface-container-high/60">
          <div className="max-w-[1720px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
            {/* Left Metadata Info */}
            <div className="flex flex-col gap-space-xs">
              <div className="flex flex-wrap items-center gap-space-sm font-telemetry-tag text-telemetry-tag">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  OPEN
                </span>
                <span className="text-on-surface-variant">PR #{pullRequest.number}</span>
                <span className="text-outline-variant">•</span>
                <span className="flex items-center gap-1 text-on-surface-variant font-code-block text-[11px] bg-surface-container px-2 py-0.5 rounded">
                  <span className="text-violet-400">{pullRequest.sourceBranch}</span>
                  <span className="material-symbols-outlined text-[13px]">arrow_right_alt</span>
                  <span className="text-on-surface">{pullRequest.targetBranch}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-space-sm">
                <h1 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">
                  {pullRequest.title}
                </h1>
                <span className="font-telemetry-tag text-telemetry-tag text-on-surface-variant">
                  #{pullRequest.number}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-space-md font-body-sm text-body-sm text-on-surface-variant">
                <span>
                  Files changed: <strong className="text-on-surface">{pullRequest.filesChangedCount}</strong>
                </span>
                <span className="flex items-center gap-1 font-telemetry-tag text-telemetry-tag">
                  <span className="text-primary font-bold">+{pullRequest.additionsCount}</span>
                  <span className="text-error font-bold">−{pullRequest.deletionsCount}</span>
                </span>
                <span className="text-outline-variant">•</span>
                <span className="text-tertiary" data-testid="pr-review-progress">
                  Reviewed: {reviewedCount} / {pullRequest.filesChangedCount} files
                </span>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex flex-wrap items-center gap-space-sm">
              {/* Unified / Split View Switcher */}
              <div className="flex items-center bg-surface-container p-0.5 rounded border border-surface-container-high/60">
                <button
                  type="button"
                  onClick={() => setDiffMode('unified')}
                  className={`px-space-sm py-1 rounded text-body-sm font-body-sm flex items-center gap-1 transition-all cursor-pointer ${
                    diffMode === 'unified'
                      ? 'bg-surface-container-high text-primary font-medium shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">surfing</span>
                  Unified
                </button>
                <button
                  type="button"
                  onClick={() => setDiffMode('split')}
                  className={`px-space-sm py-1 rounded text-body-sm font-body-sm flex items-center gap-1 transition-all cursor-pointer ${
                    diffMode === 'split'
                      ? 'bg-surface-container-high text-primary font-medium shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">vertical_split</span>
                  Split
                </button>
              </div>

              {/* Explain Diff with Voice Button */}
              <button
                type="button"
                onClick={handleVoiceExplainDiff}
                className="px-space-md py-1.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 font-body-sm text-body-sm flex items-center gap-space-xs transition-colors cursor-pointer shadow-sm"
                title="Explain current diff with AI and voice speech"
              >
                <span className="material-symbols-outlined text-[16px] text-tertiary">graphic_eq</span>
                <span>Explain Diff with Voice</span>
              </button>

              {/* Download Patch Button */}
              <button
                type="button"
                onClick={handleDownloadPatch}
                className="px-space-md py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-high/60 font-body-sm text-body-sm flex items-center gap-space-xs transition-colors cursor-pointer shadow-sm"
                title="Download genuine Git unified diff patch file (.patch)"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Download Patch</span>
              </button>

              {onOpenChat && (
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="px-space-md py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-primary border border-primary/20 font-body-sm text-body-sm flex items-center gap-space-xs transition-colors cursor-pointer shadow-sm"
                  title="Open Gitvox Voice AI Assistant"
                >
                  <span className="material-symbols-outlined text-[16px]">chat</span>
                  <span className="hidden sm:inline">AI Copilot</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Speech Notice Toast */}
        {speechNotice && (
          <div className="max-w-[1720px] mx-auto w-full px-space-lg pt-2">
            <div className="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-200 text-body-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-tertiary animate-pulse">volume_up</span>
                <span>{speechNotice}</span>
              </div>
              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="text-[11px] underline hover:text-white"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Review Canvas Grid (Left Files, Right Inspector) */}
        <div className="max-w-[1720px] w-full mx-auto p-space-md lg:p-space-lg flex flex-col lg:flex-row gap-space-md items-start flex-1 min-h-0">
          {/* LEFT PANEL: Changed Files Explorer */}
          <aside className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-space-sm">
            <div className="bg-surface-container-low rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm border border-surface-container-high/60">
              {/* Files Title & Stats Bar */}
              <div className="flex items-center justify-between font-telemetry-tag text-telemetry-tag">
                <span className="text-on-surface font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">rule_folder</span>
                  CHANGED FILES ({pullRequest.filesChangedCount})
                </span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
                  {reviewedCount}/{pullRequest.filesChangedCount} done
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-amber-500 transition-all duration-300"
                  style={{ width: `${reviewedPercent}%` }}
                ></div>
              </div>

              {/* Filter Input */}
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Filter changed files..."
                  className="w-full pl-8 pr-space-sm py-1.5 text-body-sm font-body-sm bg-surface-container-lowest text-on-surface rounded placeholder:text-outline focus:outline-none focus:bg-surface-container focus:ring-1 focus:ring-primary border border-surface-container-high/60"
                />
              </div>

              {/* Files List */}
              <div className="flex flex-col gap-1 mt-1">
                {filteredFiles.map((file) => {
                  const isSelected = file.path === activeFile.path;
                  const isReviewed = Boolean(reviewedFiles[file.path]);
                  return (
                    <div
                      key={file.path}
                      onClick={() => {
                        onSelectFile(file.path);
                        setHighlightedLineRange(null);
                        setMobileTab('diff');
                      }}
                      className={`group cursor-pointer px-3 py-2 rounded flex items-center justify-between transition-all select-none ${
                        isSelected
                          ? 'bg-surface-container border border-primary/30 shadow-sm text-on-surface'
                          : 'hover:bg-surface-container/60 text-on-surface-variant'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isReviewed ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Reviewed"></span>
                        ) : isSelected ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"></span>
                        ) : (
                          <span className="w-1.5 h-1.5 shrink-0"></span>
                        )}
                        <span className="shrink-0 flex items-center justify-center">
                          {getFileIcon(file.path)}
                        </span>
                        <span
                          className={`font-code-block text-[12px] truncate ${
                            isSelected ? 'text-on-surface font-semibold' : 'text-on-surface-variant group-hover:text-on-surface'
                          }`}
                        >
                          {file.path}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 font-telemetry-tag text-[10px] shrink-0 pl-2">
                        <span className="text-primary font-semibold">+{file.expectedAdditions}</span>
                        <span className="text-error font-semibold">−{file.expectedDeletions}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* RIGHT PANEL: Unified / Split Diff Studio (Excel-similar grid) */}
          <main className="flex-1 w-full min-w-0 flex flex-col gap-space-sm">
            {/* Diff File Header Ribbon */}
            <div className="w-full bg-surface-container-low rounded-t-xl px-space-md py-space-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm shadow-sm border border-b-0 border-surface-container-high/60">
              <div className="flex items-center gap-space-sm min-w-0">
                <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-amber-400 text-[18px]">code</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-code-block text-code-block text-on-surface font-semibold truncate">
                    {activeFile.path}
                  </span>
                  <span className="font-telemetry-tag text-telemetry-tag px-2 py-0.5 rounded bg-surface-container-highest flex items-center gap-1">
                    <span className="text-primary font-bold">+{activeDiff.additions}</span>
                    <span className="text-error font-bold">−{activeDiff.deletions}</span>
                  </span>
                </div>
              </div>

              {/* Diff Right Actions Toolbar */}
              <div className="flex items-center gap-space-sm">
                <button
                  type="button"
                  onClick={() => onToggleFileReviewed(activeFile.path)}
                  className="px-space-sm py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-body-sm flex items-center gap-1.5 transition-colors cursor-pointer border border-surface-container-high/60"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    {isCurrentFileReviewed ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  <span>{isCurrentFileReviewed ? 'Reviewed' : 'Mark reviewed'}</span>
                </button>
              </div>
            </div>

            {/* Diff File Commit / Context Summary */}
            <div className="w-full px-space-md py-2 bg-surface-container-lowest font-body-sm text-body-sm text-on-surface-variant flex items-center gap-2 border-x border-surface-container-high/60">
              <span className="material-symbols-outlined text-secondary text-[16px] flex-shrink-0">info</span>
              <span className="truncate">{activeFile.summary}</span>
            </div>

            {/* AI Model Explanation Card (if active) */}
            {modelRun.status !== 'idle' && (
              <div className="w-full bg-surface-container-low border border-primary/30 rounded-lg p-space-md shadow-md animate-fade-in flex flex-col gap-space-sm">
                <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[18px]">auto_awesome</span>
                    <span className="font-headline-md text-[14px] font-semibold text-on-surface">
                      AI Code Explanation
                    </span>
                    <span className="font-telemetry-tag text-[10px] px-2 py-0.5 rounded bg-surface-container-highest text-tertiary">
                      {modelRun.status === 'loading' ? modelRun.model : 'MODEL REASONING'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {modelRun.status === 'success' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isSpeaking) {
                            stopSpeaking();
                          } else {
                            speakText(modelRun.explanation.text);
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-[11px] font-telemetry-tag flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {isSpeaking ? 'volume_off' : 'volume_up'}
                        </span>
                        <span>{isSpeaking ? 'Stop' : 'Read Aloud'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModelRun({ status: 'idle' })}
                      className="p-1 text-on-surface-variant hover:text-on-surface rounded cursor-pointer"
                      title="Close"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                </div>

                {modelRun.status === 'loading' && (
                  <div className="flex items-center gap-3 py-4 text-on-surface-variant font-body-sm">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Analyzing code AST and formulating explanation...</span>
                  </div>
                )}

                {modelRun.status === 'error' && (
                  <div className="py-2 text-error font-body-sm flex items-center justify-between">
                    <span>{modelRun.error.message}</span>
                    {modelRun.error.retryable && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = lastModelTarget.current;
                          if (target) void runModelExplanation(target.file, target.hunk);
                        }}
                        className="px-2 py-1 rounded bg-surface-container text-on-surface hover:text-primary text-xs"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}

                {modelRun.status === 'success' && (
                  <div className="space-y-2 text-on-surface font-body-sm leading-relaxed max-h-72 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between text-[11px] font-telemetry-tag text-outline px-1">
                      <span>Model: {modelRun.explanation.model}</span>
                      <span>Latency: {modelRun.explanation.latencyMs}ms</span>
                    </div>
                    <div className="p-3 rounded bg-surface-container-lowest border border-surface-container-high/40 text-[13px] text-on-surface">
                      <AssistantMarkdown text={modelRun.explanation.text} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Diff Viewer Table Container (Excel-like Grid) */}
            <div className="w-full bg-surface-container-lowest rounded-b-xl overflow-x-auto shadow-sm select-text border border-surface-container-high/60">
              {diffMode === 'unified' ? (
                <table className="w-full font-code-block text-code-block border-collapse">
                  <thead>
                    <tr className="text-outline text-[11px] font-telemetry-tag uppercase bg-surface-container-high/40 border-b border-surface-container-high/50 select-none">
                      <th className="w-12 py-1.5 px-2 text-right">Old</th>
                      <th className="w-12 py-1.5 px-2 text-right">New</th>
                      <th className="w-6 py-1.5 text-center"></th>
                      <th className="py-1.5 px-3 text-left">Source Code Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDiff.unifiedLines.map((line, index) => {
                      const isHighlighted =
                        highlightedLineRange !== null &&
                        line.newLineNumber !== null &&
                        line.newLineNumber >= highlightedLineRange[0] &&
                        line.newLineNumber <= highlightedLineRange[1];

                      const isAdded = line.type === 'added';
                      const isDeleted = line.type === 'deleted';

                      return (
                        <tr
                          key={`${activeFile.path}-u-${index}`}
                          onClick={() => {
                            if (line.newLineNumber) {
                              setHighlightedLineRange([line.newLineNumber, line.newLineNumber]);
                            }
                          }}
                          className={`transition-colors ${
                            isHighlighted
                              ? 'bg-amber-500/15 border-l-2 border-amber-400'
                              : isAdded
                              ? 'bg-primary/10 hover:bg-primary/15 border-l-2 border-primary'
                              : isDeleted
                              ? 'bg-error/15 hover:bg-error/20 border-l-2 border-error'
                              : 'hover:bg-surface-container/50 border-l-2 border-transparent'
                          } ${line.newLineNumber ? 'cursor-pointer' : ''}`}
                        >
                          <td className="py-0.5 px-2 text-right text-outline select-none font-telemetry-tag text-[12px] w-12 align-top">
                            {line.oldLineNumber ?? ''}
                          </td>
                          <td
                            className={`py-0.5 px-2 text-right select-none font-telemetry-tag text-[12px] w-12 align-top ${
                              isAdded ? 'text-primary font-semibold' : 'text-outline'
                            }`}
                          >
                            {line.newLineNumber ?? ''}
                          </td>
                          <td
                            className={`py-0.5 text-center font-bold select-none text-[12px] w-6 align-top ${
                              isAdded ? 'text-primary' : isDeleted ? 'text-error' : 'text-outline'
                            }`}
                          >
                            {isAdded ? '+' : isDeleted ? '−' : ' '}
                          </td>
                          <td
                            className={`py-0.5 px-3 whitespace-pre text-[13px] leading-relaxed ${
                              isAdded
                                ? 'text-primary-fixed font-medium'
                                : isDeleted
                                ? 'text-error line-through opacity-80'
                                : 'text-on-surface'
                            }`}
                          >
                            {renderHighlightedLine(line.content, activeFile.language)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                /* Split Diff View - Fixed Table preventing overlap */
                <div className="w-full overflow-x-auto select-text">
                  <table className="w-full table-fixed border-collapse font-code-block text-[12px] min-w-[900px]">
                    <colgroup>
                      <col className="w-[50%]" />
                      <col className="w-[50%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-surface-container-high/60 bg-surface-container-high/40 text-[11px] font-telemetry-tag uppercase text-outline select-none">
                        <th className="w-1/2 text-left border-r border-surface-container-high/60 px-3 py-1.5 font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px]">history</span>
                            <span>Base ({pullRequest.targetBranch})</span>
                          </div>
                        </th>
                        <th className="w-1/2 text-left px-3 py-1.5 font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-amber-400">commit</span>
                            <span>Proposed ({pullRequest.sourceBranch})</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDiff.splitRows.map((row, idx) => {
                        const isLeftDel = row.leftType === 'deleted';
                        const isRightAdd = row.rightType === 'added';

                        return (
                          <tr
                            key={`${activeFile.path}-s-${idx}`}
                            className="border-b border-surface-container-high/30 last:border-b-0 hover:bg-surface-container/20 transition-colors"
                          >
                            {/* Left: Base */}
                            <td
                              className={`w-1/2 align-top border-r border-surface-container-high/60 p-0 overflow-hidden ${
                                isLeftDel ? 'bg-error/15 text-error' : ''
                              }`}
                            >
                              <div className="flex items-start gap-2 px-2 py-0.5 overflow-x-auto scrollbar-none">
                                <span className="w-8 shrink-0 select-none text-right font-telemetry-tag text-[11px] text-outline">
                                  {row.leftLineNumber ?? ''}
                                </span>
                                <span className="w-4 shrink-0 select-none text-center font-bold text-error">
                                  {isLeftDel ? '−' : ' '}
                                </span>
                                <span
                                  className={`whitespace-pre flex-1 leading-relaxed ${
                                    isLeftDel ? 'line-through opacity-85' : 'text-on-surface'
                                  }`}
                                >
                                  {row.leftContent !== null
                                    ? renderHighlightedLine(row.leftContent, activeFile.language)
                                    : ''}
                                </span>
                              </div>
                            </td>

                            {/* Right: Proposed */}
                            <td
                              className={`w-1/2 align-top p-0 overflow-hidden ${
                                isRightAdd ? 'bg-primary/10 text-primary-fixed' : ''
                              }`}
                            >
                              <div className="flex items-start gap-2 px-2 py-0.5 overflow-x-auto scrollbar-none">
                                <span className="w-8 shrink-0 select-none text-right font-telemetry-tag text-[11px] text-outline">
                                  {row.rightLineNumber ?? ''}
                                </span>
                                <span className="w-4 shrink-0 select-none text-center font-bold text-primary">
                                  {isRightAdd ? '+' : ' '}
                                </span>
                                <span className="whitespace-pre flex-1 leading-relaxed text-on-surface">
                                  {row.rightContent !== null
                                    ? renderHighlightedLine(row.rightContent, activeFile.language)
                                    : ''}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>
      </main>
    </div>
  );
};
