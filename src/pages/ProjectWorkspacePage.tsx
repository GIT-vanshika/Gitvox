import React, { useMemo, useState } from 'react';
import {
  Code2,
  FileCode,
  FolderGit2,
  GitPullRequest,
  MessageSquare,
  Mic,
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
  onOpenVoiceModal: () => void;
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
  onOpenVoiceModal,
  systemStatus,
}) => {
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [selectedLineRange, setSelectedLineRange] = useState<[number, number] | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<'files' | 'code' | 'ask'>('code');

  const activeFile: ProjectFile = useMemo(() => {
    return (
      project.files.find((f) => f.path === selectedFilePath) ||
      project.files[0]
    );
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#080A0F] text-[#F1F5FC] flex flex-col">
      {/* Compact Top Bar */}
      <header className="bg-[#0D111A] border-b border-[#263247] px-4 py-2.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Brand + Breadcrumb + Source Indicator */}
          <div className="flex items-center gap-2.5 min-w-0">
            <GitvoxWordmark onClick={() => onNavigate('home')} />
            <span className="text-[#77849A] text-xs" aria-hidden="true">
              /
            </span>
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <FolderGit2 className="w-3.5 h-3.5 text-[#397BFF] shrink-0" aria-hidden="true" />
              <span className="font-semibold text-[#F1F5FC] truncate">{project.name}</span>
              <span className="text-[#77849A] hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="text-[#A0AEC2] hidden sm:inline truncate">{project.loadedAt}</span>
              <span className="text-[#77849A] hidden md:inline" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-[#39D98A] hidden md:inline">
                Status: {systemStatus}
              </span>
            </div>
          </div>

          {/* Right: Workspace Actions */}
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
              onClick={() => onNavigate('pr')}
              className="px-3 py-1.5 text-xs font-semibold bg-[#397BFF] hover:bg-[#5EA1FF] text-[#F1F5FC] rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <GitPullRequest className="w-3.5 h-3.5" aria-hidden="true" />
              <span>PR #284 Review</span>
            </button>

            <button
              type="button"
              onClick={onResetWorkspace}
              title="Reset or load another project"
              className="px-2.5 py-1.5 text-xs font-medium bg-[#080A0F] hover:bg-[#121926] text-[#A0AEC2] hover:text-[#F1F5FC] border border-[#263247] rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Change Source</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Switcher (Files | Code | Ask Gitvox) */}
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
          Files ({project.files.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('code')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            mobileTab === 'code'
              ? 'bg-[#397BFF] text-[#F1F5FC]'
              : 'bg-[#121926] text-[#A0AEC2]'
          }`}
        >
          Code ({activeFile?.name})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('ask')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            mobileTab === 'ask'
              ? 'bg-[#397BFF] text-[#F1F5FC]'
              : 'bg-[#121926] text-[#A0AEC2]'
          }`}
        >
          Ask Gitvox ({explanations.length})
        </button>
      </div>

      {/* Main 3-Pane Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: File Explorer & Project Overview */}
        <aside
          aria-label="Project File Explorer"
          className={`${
            mobileTab === 'files' ? 'flex' : 'hidden'
          } ${
            leftPanelOpen ? 'lg:flex lg:w-72' : 'lg:hidden'
          } w-full flex-col bg-[#0D111A] border-r border-[#263247] shrink-0`}
        >
          <div className="p-3.5 border-b border-[#263247] flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold text-[#F1F5FC]">Project Explorer</h2>
              <p className="text-[11px] text-[#77849A] font-mono tabular-nums mt-0.5">
                {project.files.length} files · {(project.totalSizeBytes / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={onExplainProjectOverview}
              className="px-2.5 py-1 text-xs font-medium bg-[#121926] hover:bg-[#192234] text-[#5EA1FF] border border-[#263247] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Explain Project
            </button>
          </div>

          {/* Searchable File Tree Input */}
          <div className="p-3 border-b border-[#263247]">
            <label htmlFor="project-file-search" className="sr-only">
              Filter project files
            </label>
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-[#77849A] absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="project-file-search"
                type="text"
                value={fileSearchQuery}
                onChange={(e) => setFileSearchQuery(e.target.value)}
                placeholder="Filter files or functions..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-[#080A0F] border border-[#263247] rounded text-[#F1F5FC] placeholder-[#77849A] focus:border-[#5EA1FF] focus:outline-none"
              />
            </div>
          </div>

          {/* File Tree List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#263247]/50">
            {filteredFiles.length === 0 ? (
              <div className="p-4 text-xs text-[#77849A]">
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
                    className={`w-full px-3.5 py-2.5 text-left transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#121926] text-[#F1F5FC]'
                        : 'text-[#A0AEC2] hover:bg-[#121926]/60 hover:text-[#F1F5FC]'
                    }`}
                  >
                    <div className="min-w-0 flex items-start gap-2">
                      <FileCode
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          isSelected ? 'text-[#5EA1FF]' : 'text-[#77849A]'
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-medium truncate">{file.name}</div>
                        <div className="text-[11px] text-[#77849A] font-mono truncate">
                          {file.folder || '/'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[#77849A] tabular-nums shrink-0">
                      {file.functions.length > 0 ? `${file.functions.length} fn` : file.language}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Honest Scope Indicator Footer */}
          <div className="p-3 bg-[#080A0F] border-t border-[#263247] text-[11px] text-[#77849A] leading-relaxed">
            <div className="font-medium text-[#A0AEC2]">Analysis Scope:</div>
            <p className="mt-0.5">{project.scopeNotice}</p>
          </div>
        </aside>

        {/* CENTER PANE: Source Code Viewer */}
        <main
          className={`${
            mobileTab === 'code' ? 'flex' : 'hidden'
          } lg:flex flex-1 flex-col min-w-0 bg-[#080A0F]`}
        >
          {/* Active File Toolbar */}
          <div className="px-4 py-2.5 bg-[#121926] border-b border-[#263247] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setLeftPanelOpen((prev) => !prev)}
                aria-label={leftPanelOpen ? 'Collapse file explorer' : 'Expand file explorer'}
                className="hidden lg:inline-flex p-1 text-[#A0AEC2] hover:text-[#F1F5FC] rounded cursor-pointer"
              >
                {leftPanelOpen ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4" />
                )}
              </button>

              <Code2 className="w-4 h-4 text-[#397BFF] shrink-0" aria-hidden="true" />
              <h1 className="text-xs font-mono font-semibold text-[#F1F5FC] truncate">
                {activeFile?.path}
              </h1>
              <span className="text-xs text-[#77849A] font-mono tabular-nums">
                · {codeLines.length} lines · {activeFile?.language}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onExplainCurrentFile();
                  setMobileTab('ask');
                }}
                className="px-3 py-1 text-xs font-medium bg-[#397BFF] hover:bg-[#5EA1FF] text-[#F1F5FC] rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Summarize File</span>
              </button>

              <button
                type="button"
                onClick={() => setRightPanelOpen((prev) => !prev)}
                aria-label={rightPanelOpen ? 'Collapse Ask Gitvox panel' : 'Expand Ask Gitvox panel'}
                className="hidden lg:inline-flex p-1 text-[#A0AEC2] hover:text-[#F1F5FC] rounded cursor-pointer"
              >
                {rightPanelOpen ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Function-Level Quick Explanation Bar */}
          {activeFile && activeFile.functions.length > 0 && (
            <div className="px-4 py-2 bg-[#0D111A] border-b border-[#263247] flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-[#77849A]">
                Explain Function:
              </span>
              {activeFile.functions.map((fn) => {
                const isSelected = selectedFunctionName === fn.name;
                return (
                  <button
                    key={`${fn.name}-${fn.startLine}`}
                    type="button"
                    onClick={() => handleFunctionClick(fn)}
                    className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#397BFF]/20 border-[#397BFF] text-[#F1F5FC]'
                        : 'bg-[#080A0F] border-[#263247] text-[#A0AEC2] hover:border-[#5EA1FF] hover:text-[#F1F5FC]'
                    }`}
                  >
                    {fn.name}() <span className="text-[#77849A]">L{fn.startLine}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Code Viewer with Line Numbers & Horizontal Scroll */}
          <div className="flex-1 overflow-auto py-3 font-mono text-xs leading-relaxed">
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
                  className={`px-4 py-0.5 flex items-baseline gap-4 ${
                    isHighlighted ? 'bg-[#397BFF]/15' : 'hover:bg-[#121926]/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedLineRange([lineNum, lineNum])}
                    aria-label={`Select line ${lineNum}`}
                    className="w-8 text-right text-[11px] text-[#77849A] hover:text-[#5EA1FF] select-none tabular-nums shrink-0 cursor-pointer"
                  >
                    {lineNum}
                  </button>
                  <div className="flex-1 whitespace-pre">
                    {renderHighlightedLine(lineText)}
                    {fnAtLine && (
                      <button
                        type="button"
                        onClick={() => handleFunctionClick(fnAtLine)}
                        className="ml-4 px-2 py-0.5 text-[10px] font-sans font-medium bg-[#121926] hover:bg-[#397BFF] text-[#5EA1FF] hover:text-[#F1F5FC] border border-[#263247] rounded transition-colors cursor-pointer"
                      >
                        Explain {fnAtLine.name}()
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* RIGHT PANE: Contextual Ask Gitvox Panel */}
        <aside
          aria-label="Contextual Ask Gitvox Panel"
          className={`${
            mobileTab === 'ask' ? 'flex' : 'hidden'
          } ${
            rightPanelOpen ? 'lg:flex lg:w-96' : 'lg:hidden'
          } w-full flex-col bg-[#0D111A] border-l border-[#263247] shrink-0`}
        >
          <div className="p-3.5 border-b border-[#263247] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#397BFF]" aria-hidden="true" />
              <h2 className="text-xs font-semibold text-[#F1F5FC]">Ask Gitvox</h2>
            </div>
            <span className="text-[11px] font-mono text-[#77849A]">
              Context: {activeFile?.name}
            </span>
          </div>

          {/* Quick Command Chips */}
          <div className="p-3 bg-[#121926]/50 border-b border-[#263247]">
            <div className="text-[11px] text-[#77849A] mb-2">
              Quick Grounded Actions & Voice Intents:
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onExecuteCommand('Explain this project.')}
                className="px-2.5 py-1 text-[11px] bg-[#080A0F] hover:bg-[#121926] text-[#F1F5FC] border border-[#263247] rounded transition-colors cursor-pointer"
              >
                Explain this project
              </button>
              <button
                type="button"
                onClick={() => onExecuteCommand('Summarize this file.')}
                className="px-2.5 py-1 text-[11px] bg-[#080A0F] hover:bg-[#121926] text-[#F1F5FC] border border-[#263247] rounded transition-colors cursor-pointer"
              >
                Summarize this file
              </button>
              <button
                type="button"
                onClick={() => onExecuteCommand('Explain the selected function.')}
                className="px-2.5 py-1 text-[11px] bg-[#080A0F] hover:bg-[#121926] text-[#F1F5FC] border border-[#263247] rounded transition-colors cursor-pointer"
              >
                Explain selected function
              </button>
            </div>
          </div>

          {/* Grounded Explanations Feed */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {explanations.map((exp) => (
              <article
                key={exp.id}
                className="p-3.5 bg-[#080A0F] border border-[#263247] rounded-md text-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[#F1F5FC]">{exp.title}</h3>
                  <span className="text-[10px] font-mono text-[#77849A] shrink-0">
                    {exp.timestamp}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-[#5EA1FF]">{exp.scopeLabel}</div>

                <p className="text-[#A0AEC2] leading-relaxed">{exp.summary}</p>

                {exp.details.length > 0 && (
                  <ul className="space-y-1 text-[#A0AEC2] pt-1 border-t border-[#263247]/60">
                    {exp.details.map((detail, idx) => (
                      <li key={idx} className="leading-relaxed">
                        • {detail}
                      </li>
                    ))}
                  </ul>
                )}

                {exp.evidenceSnippet && (
                  <pre className="p-2 bg-[#0D111A] border border-[#263247] rounded font-mono text-[11px] text-[#F1F5FC] overflow-x-auto">
                    {exp.evidenceSnippet}
                  </pre>
                )}

                <div className="pt-1.5 border-t border-[#263247]/60 text-[10px] text-[#77849A]">
                  {exp.confidenceNote}
                </div>
              </article>
            ))}
          </div>

          {/* Contextual Question Input Fallback */}
          <form
            onSubmit={handleQuestionSubmit}
            className="p-3 bg-[#121926] border-t border-[#263247]"
          >
            <label htmlFor="workspace-question-input" className="sr-only">
              Ask a question or type a command about {activeFile?.name}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="workspace-question-input"
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder={`Ask about ${activeFile?.name} or type a command...`}
                className="flex-1 px-3 py-2 text-xs bg-[#080A0F] border border-[#263247] rounded text-[#F1F5FC] placeholder-[#77849A] focus:border-[#5EA1FF] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Submit Question"
                className="px-3 py-2 text-xs font-semibold bg-[#397BFF] hover:bg-[#5EA1FF] text-[#F1F5FC] rounded transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ask</span>
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
};
