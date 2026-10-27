import React, { useMemo, useState } from 'react';
import {
  Code2,
  X,
  FileCode,
  FolderGit2,
  GitPullRequest,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { GitvoxWordmark } from '../components/common/GitvoxBrand';
import { renderHighlightedLine } from '../utils/syntaxHighlight';
import {
  AIExplanation,
  CodeFunction,
  LoadedProject,
  ProjectFile,
  RouteId,
  SystemStatus,
} from '../types/gitvox';

interface ProjectWorkspacePageProps {
  project: LoadedProject;
  selectedFilePath: string;
  onSelectFile: (filePath: string) => void;
  selectedFunctionName: string | null;
  onSelectFunction: (fn: CodeFunction) => void;
  explanations: AIExplanation[];
  onExplainProjectOverview: () => void;
  onExplainCurrentFile: () => void;
  onAskQuestion: (question: string) => void;
  onExecuteCommand: (command: string) => void;
  onResetWorkspace: () => void;
  onNavigate: (route: RouteId) => void;
  systemStatus: SystemStatus;
}

export const ProjectWorkspacePage: React.FC<ProjectWorkspacePageProps> = ({
  project,
  selectedFilePath,
  onSelectFile,
  selectedFunctionName,
  onSelectFunction,
  explanations,
  onExplainProjectOverview,
  onExplainCurrentFile,
  onAskQuestion,
  onExecuteCommand,
  onResetWorkspace,
  onNavigate,
  systemStatus,
}) => {
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [selectedLineRange, setSelectedLineRange] = useState<[number, number] | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [mobileTab, setMobileTab] = useState<'files' | 'code' | 'ask'>('code');
  const [dismissedExplanationIds, setDismissedExplanationIds] = useState<string[]>([]);

  const activeFile: ProjectFile = useMemo(() => {
    return project.files.find((f) => f.path === selectedFilePath) || project.files[0];
  }, [project.files, selectedFilePath]);

  const filteredFiles = useMemo(() => {
    const q = fileSearchQuery.trim().toLowerCase();
    if (!q) return project.files;
    return project.files.filter(
      (f) =>
        f.path.toLowerCase().includes(q) ||
        f.language.toLowerCase().includes(q) ||
        f.functions.some((fn) => fn.name.toLowerCase().includes(q))
    );
  }, [project.files, fileSearchQuery]);

  const codeLines = useMemo(() => {
    return activeFile ? activeFile.content.replace(/\r\n/g, '\n').split('\n') : [];
  }, [activeFile]);

  const visibleExplanations = explanations.filter(
    (exp) => !dismissedExplanationIds.includes(exp.id)
  );

  const handleFunctionClick = (fn: CodeFunction) => {
    setSelectedLineRange([fn.startLine, fn.endLine]);
    onSelectFunction(fn);
    setMobileTab('ask');
  };

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed) return;
    onAskQuestion(trimmed);
    setQuestionInput('');
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
            <FolderGit2 className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
            <span className="truncate text-sm font-medium text-ink">{project.name}</span>
            <span className="chip hidden md:inline-flex">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              {systemStatus}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('pr')}
              className="btn btn-secondary btn-sm"
            >
              <GitPullRequest className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">PR #284 review</span>
              <span className="sm:hidden">PR</span>
            </button>

            <button
              type="button"
              onClick={onResetWorkspace}
              title="Reset or load another project"
              className="btn btn-ghost btn-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Change source</span>
            </button>
          </div>
        </div>
      </header>

      <main className="shell pb-28 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <div className="min-w-0">
            <p className="eyebrow">Project workspace</p>
            <h1 className="h2 mt-1 truncate">{project.name}</h1>
            <p className="mt-1 text-xs text-faint">
              {project.files.length} files · {(project.totalSizeBytes / 1024).toFixed(1)} KB ·
              loaded {project.loadedAt}
            </p>
          </div>
          <button
            type="button"
            onClick={onExplainProjectOverview}
            className="btn btn-secondary btn-sm"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Explain project
          </button>
        </div>

        {/* Mobile pane switcher */}
        <div className="tab-bar mt-4 lg:hidden" role="tablist" aria-label="Workspace panes">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'files'}
            data-active={mobileTab === 'files'}
            onClick={() => setMobileTab('files')}
            className="tab-bar__item"
          >
            Files ({project.files.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'code'}
            data-active={mobileTab === 'code'}
            onClick={() => setMobileTab('code')}
            className="tab-bar__item"
          >
            Code
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'ask'}
            data-active={mobileTab === 'ask'}
            onClick={() => setMobileTab('ask')}
            className="tab-bar__item"
          >
            Context ({visibleExplanations.length})
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap xl:flex-nowrap">
          {/* File explorer */}
          <aside
            aria-label="Project file explorer"
            className={`${
              mobileTab === 'files' ? 'flex' : 'hidden'
            } ${
              leftPanelOpen ? 'lg:flex' : 'lg:hidden'
            } w-full min-w-0 flex-col rounded-lg border border-line bg-page lg:w-60 lg:shrink-0`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
              <h2 className="text-xs font-semibold text-ink">Project explorer</h2>
              <span className="font-mono text-[10px] text-faint">{project.files.length} files</span>
            </div>

            <div className="border-b border-line p-2.5">
              <label htmlFor="project-file-search" className="sr-only">
                Filter project files
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
                  aria-hidden="true"
                />
                <input
                  id="project-file-search"
                  type="text"
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  placeholder="Filter files or functions…"
                  className="field h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {filteredFiles.length === 0 ? (
                <div className="px-3 py-4 text-xs text-faint">
                  No files match "{fileSearchQuery}".
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const isSelected = file.path === activeFile?.path;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => {
                        onSelectFile(file.path);
                        setSelectedLineRange(null);
                        setMobileTab('code');
                      }}
                      className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors cursor-pointer ${
                        isSelected ? 'bg-[var(--accent-soft)]' : 'hover:bg-soft'
                      }`}
                    >
                      <span className="flex min-w-0 items-start gap-2">
                        <FileCode
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                            isSelected ? 'text-accent' : 'text-faint'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span
                            className={`block truncate font-mono text-[11px] ${
                              isSelected ? 'font-medium text-ink' : 'text-body'
                            }`}
                          >
                            {file.name}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-faint">
                            {file.folder || '/'}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-faint">
                        {file.functions.length > 0 ? `${file.functions.length} fn` : file.language}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-auto border-t border-line px-3 py-2.5 text-[10px] leading-4 text-faint">
              <span className="font-medium text-body">Analysis scope:</span> {project.scopeNotice}
            </div>
          </aside>

          {/* Source viewer */}
          <div
            className={`${mobileTab === 'code' ? 'block' : 'hidden'} min-w-0 flex-1 lg:block`}
          >
            <section className="code-panel" aria-label={`Source for ${activeFile?.path}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLeftPanelOpen((prev) => !prev)}
                    aria-label={leftPanelOpen ? 'Collapse file explorer' : 'Expand file explorer'}
                    className="btn btn-ghost btn-icon btn-sm hidden lg:inline-flex"
                  >
                    {leftPanelOpen ? (
                      <PanelLeftClose className="h-4 w-4" />
                    ) : (
                      <PanelLeftOpen className="h-4 w-4" />
                    )}
                  </button>

                  <Code2 className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                  <h2 className="truncate font-mono text-xs font-semibold text-ink">
                    {activeFile?.path}
                  </h2>
                  <span className="hidden shrink-0 font-mono text-[11px] text-faint sm:inline">
                    {codeLines.length} lines · {activeFile?.language}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onExplainCurrentFile();
                      setMobileTab('ask');
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Summarize file
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelOpen((prev) => !prev)}
                    aria-label={rightPanelOpen ? 'Collapse context panel' : 'Expand context panel'}
                    className="btn btn-ghost btn-icon btn-sm hidden xl:inline-flex"
                  >
                    {rightPanelOpen ? (
                      <PanelRightClose className="h-4 w-4" />
                    ) : (
                      <PanelRightOpen className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {activeFile && activeFile.functions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
                  <span className="mr-1 text-[11px] font-medium text-faint">Functions:</span>
                  {activeFile.functions.map((fn) => {
                    const isSelected = selectedFunctionName === fn.name;
                    return (
                      <button
                        key={`${fn.name}-${fn.startLine}`}
                        type="button"
                        onClick={() => handleFunctionClick(fn)}
                        className={`chip cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-accent'
                            : 'hover:border-line-strong hover:text-ink'
                        }`}
                      >
                        {fn.name}() <span className="text-faint">L{fn.startLine}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="code-scroll max-h-[65vh] min-h-[240px] py-2">
                {codeLines.map((lineText, idx) => {
                  const lineNum = idx + 1;
                  const isHighlighted =
                    selectedLineRange !== null &&
                    lineNum >= selectedLineRange[0] &&
                    lineNum <= selectedLineRange[1];

                  const fnAtLine = activeFile?.functions.find((f) => f.startLine === lineNum);

                  return (
                    <div
                      key={`${activeFile?.path}-L${lineNum}`}
                      className={`code-row py-[1px] ${
                        isHighlighted ? 'bg-[var(--diff-focus-bg)]' : 'hover:bg-soft'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedLineRange([lineNum, lineNum])}
                        aria-label={`Select line ${lineNum}`}
                        className="code-gutter code-gutter--button"
                      >
                        {lineNum}
                      </button>
                      <div className="code-source">
                        {renderHighlightedLine(lineText, activeFile?.language)}
                        {fnAtLine && (
                          <button
                            type="button"
                            onClick={() => handleFunctionClick(fnAtLine)}
                            className="ml-4 rounded border border-line bg-page px-1.5 py-0.5 font-sans text-[10px] font-medium text-body transition-colors hover:border-[var(--accent)] hover:text-accent cursor-pointer"
                          >
                            Explain {fnAtLine.name}()
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Context / results */}
          <aside
            aria-label="Code context panel"
            className={`${
              mobileTab === 'ask' ? 'flex' : 'hidden'
            } ${
              rightPanelOpen ? 'lg:flex' : 'lg:hidden'
            } w-full min-w-0 flex-col rounded-lg border border-line bg-page lg:w-full xl:w-[340px] xl:shrink-0`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <MessageSquare className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
                Code context
              </h2>
              <span className="truncate font-mono text-[10px] text-faint">{activeFile?.name}</span>
            </div>

            <div className="space-y-2.5 p-3">
              {visibleExplanations.length === 0 && (
                <p className="rounded-md border border-line bg-soft p-3 text-[11px] leading-5 text-faint">
                  No explanations yet. Select a function, summarize the file, or use the microphone
                  to ask a question.
                </p>
              )}

              {visibleExplanations.map((exp) => (
                <article
                  key={exp.id}
                  className="rounded-md border border-line bg-soft p-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[12px] font-semibold text-ink">{exp.title}</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedExplanationIds((prev) => [...prev, exp.id])
                      }
                      aria-label={`Dismiss ${exp.title}`}
                      title="Dismiss"
                      className="-mr-1 -mt-0.5 rounded p-0.5 text-faint transition-colors hover:bg-muted hover:text-ink cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-faint">
                    <span className="text-accent">{exp.scopeLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{exp.timestamp}</span>
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-body">{exp.summary}</p>

                  {exp.details.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-line pt-2 text-[11px] leading-5 text-body">
                      {exp.details.map((detail, idx) => (
                        <li key={idx} className="flex gap-1.5">
                          <span className="text-faint" aria-hidden="true">
                            •
                          </span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {exp.evidenceSnippet && (
                    <pre className="code-scroll mt-2 rounded border border-line bg-page p-2 font-mono text-[10px] leading-4 text-ink">
                      {exp.evidenceSnippet}
                    </pre>
                  )}

                  <p className="mt-2 border-t border-line pt-1.5 text-[10px] leading-4 text-faint">
                    {exp.confidenceNote}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-auto border-t border-line p-3">
              {!showQuestionInput ? (
                <button
                  type="button"
                  onClick={() => setShowQuestionInput(true)}
                  className="text-[11px] font-medium text-body underline-offset-2 hover:text-ink hover:underline cursor-pointer"
                >
                  Use text instead
                </button>
              ) : (
                <form onSubmit={handleQuestionSubmit}>
                  <label htmlFor="workspace-question-input" className="sr-only">
                    Ask a question or type a command about {activeFile?.name}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="workspace-question-input"
                      type="text"
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      placeholder={`Ask about ${activeFile?.name}…`}
                      className="field min-w-0 flex-1"
                    />
                    <button type="submit" className="btn btn-primary btn-sm shrink-0">
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      Ask
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQuestionInput(false)}
                    className="mt-2 text-[11px] text-faint hover:text-ink cursor-pointer"
                  >
                    Use voice instead
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
