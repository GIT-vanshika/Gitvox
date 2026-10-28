import React, { useMemo, useState } from 'react';
import {
  Code2,
  FileCode,
  FolderGit2,
  GitPullRequest,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
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
  explanations?: AIExplanation[];
  onExplainProjectOverview?: () => void;
  onExplainCurrentFile: () => void;
  onAskQuestion?: (question: string) => void;
  onExecuteCommand?: (command: string) => void;
  onResetWorkspace: () => void;
  onNavigate: (route: RouteId) => void;
  systemStatus: SystemStatus;
  onOpenChat?: () => void;
}

export const ProjectWorkspacePage: React.FC<ProjectWorkspacePageProps> = ({
  project,
  selectedFilePath,
  onSelectFile,
  selectedFunctionName,
  onSelectFunction,
  onExplainCurrentFile,
  onResetWorkspace,
  onNavigate,
  systemStatus,
  onOpenChat,
}) => {
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [selectedLineRange, setSelectedLineRange] = useState<[number, number] | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<'files' | 'code'>('code');

  const activeFile: ProjectFile = useMemo(() => {
    return project.files.find((f) => f.path === selectedFilePath) || project.files[0];
  }, [project.files, selectedFilePath]);

  const codeLines = useMemo(() => {
    if (!activeFile) return [];
    return activeFile.content.split('\n');
  }, [activeFile]);

  const filteredFiles = useMemo(() => {
    const q = fileSearchQuery.trim().toLowerCase();
    if (!q) return project.files;
    return project.files.filter((f) => {
      const matchName = f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
      const matchFn = f.functions.some((fn) => fn.name.toLowerCase().includes(q));
      return matchName || matchFn;
    });
  }, [project.files, fileSearchQuery]);

  const handleLineClick = (lineNum: number) => {
    if (!selectedLineRange) {
      setSelectedLineRange([lineNum, lineNum]);
    } else if (selectedLineRange[0] === selectedLineRange[1]) {
      const start = Math.min(selectedLineRange[0], lineNum);
      const end = Math.max(selectedLineRange[0], lineNum);
      setSelectedLineRange([start, end]);
    } else {
      setSelectedLineRange([lineNum, lineNum]);
    }
  };

  const handleFunctionClick = (fn: CodeFunction) => {
    setSelectedLineRange([fn.startLine, fn.endLine]);
    onSelectFunction(fn);
    if (onOpenChat) {
      onOpenChat();
    }
  };

  const handleSummarizeFileClick = () => {
    onExplainCurrentFile();
    if (onOpenChat) {
      onOpenChat();
    }
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
            {onOpenChat && (
              <button
                type="button"
                onClick={onOpenChat}
                className="btn btn-secondary btn-sm"
                title="Start a chat with Gitvox AI"
              >
                <MessageSquare className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                <span>Start Chat</span>
              </button>
            )}

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
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row items-stretch">
          {/* File explorer */}
          <aside
            aria-label="Project file explorer"
            className={`${
              mobileTab === 'files' ? 'flex' : 'hidden'
            } ${
              leftPanelOpen ? 'lg:flex' : 'lg:hidden'
            } w-full min-w-0 flex-col rounded-lg border border-line bg-page lg:w-56 xl:w-64 lg:shrink-0 h-[calc(100vh-190px)] min-h-[500px] max-h-[820px]`}
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

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
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
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-l-2 border-l-[var(--accent)] bg-[var(--accent-soft)]'
                          : 'hover:bg-soft'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileCode
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isSelected ? 'text-accent' : 'text-faint'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span
                            className={`block truncate font-mono text-xs ${
                              isSelected ? 'font-semibold text-ink' : 'text-body'
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

          {/* Source viewer: Expands to FULL width on the right (Code context panel removed) */}
          <div
            className={`${mobileTab === 'code' ? 'flex' : 'hidden'} min-w-0 flex-1 lg:flex lg:flex-col h-[calc(100vh-190px)] min-h-[500px] max-h-[820px]`}
          >
            <section className="code-panel flex flex-1 flex-col overflow-hidden" aria-label={`Source for ${activeFile?.path}`}>
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
                    onClick={handleSummarizeFileClick}
                    className="btn btn-primary btn-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Summarize file
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
                        key={fn.name}
                        type="button"
                        onClick={() => handleFunctionClick(fn)}
                        className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-accent font-semibold'
                            : 'border-line bg-page text-body hover:border-[var(--border-strong)] hover:text-ink'
                        }`}
                      >
                        {fn.name}()
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Code line viewer */}
              <div
                className="code-scroll flex-1 py-1 font-mono text-xs"
                tabIndex={0}
                aria-label={`Code content for ${activeFile?.path}`}
              >
                {codeLines.map((lineContent, idx) => {
                  const lineNum = idx + 1;
                  const isHighlighted =
                    selectedLineRange &&
                    lineNum >= selectedLineRange[0] &&
                    lineNum <= selectedLineRange[1];

                  return (
                    <div
                      key={lineNum}
                      onClick={() => handleLineClick(lineNum)}
                      className={`group flex items-start px-2 py-[1px] cursor-pointer hover:bg-muted ${
                        isHighlighted ? 'bg-[var(--accent-soft)]' : ''
                      }`}
                    >
                      <span className="w-10 shrink-0 select-none text-right font-mono text-[10px] leading-5 tabular-nums text-faint">
                        {lineNum}
                      </span>
                      <span className="w-4 shrink-0 select-none text-center font-mono text-[11px] leading-5 text-faint">
                        {isHighlighted ? '▸' : ' '}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center justify-between">
                        <span className="whitespace-pre text-[12px] leading-5 text-ink">
                          {renderHighlightedLine(lineContent, activeFile?.language || 'javascript')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProjectWorkspacePage;
