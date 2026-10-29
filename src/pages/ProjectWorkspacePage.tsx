import React, { useMemo, useRef, useState, useEffect } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { FileTree } from '../components/common/FileTree';
import {
  CodeFunction,
  LoadedProject,
  ProjectFile,
  RouteId,
  SystemStatus,
} from '../types/gitvox';

import {
  validateUniversalSyntax,
  detectLanguageFromPath,
  SyntaxDiagnostic,
} from '../services/unifiedSyntaxEngine';

export type { SyntaxDiagnostic };
export const checkCodeSyntax = validateUniversalSyntax;

const getMonacoLanguage = (filePath?: string): string => {
  return detectLanguageFromPath(filePath);
};

export const getFileIcon = (filePath: string) => {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.json')) {
    return <span className="font-code-block text-[12px] text-amber-400 font-bold">&#123;&#125;</span>;
  }
  if (lower.endsWith('.py') || lower.endsWith('.pyw')) {
    return <span className="material-symbols-outlined text-[15px] text-emerald-400">terminal</span>;
  }
  if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.h') || lower.endsWith('.hpp') || lower.endsWith('.c')) {
    return <span className="font-code-block text-[11px] text-blue-400 font-bold">C++</span>;
  }
  if (lower.endsWith('.rs')) {
    return <span className="material-symbols-outlined text-[15px] text-amber-500">settings</span>;
  }
  if (lower.endsWith('.go')) {
    return <span className="font-code-block text-[11px] text-cyan-400 font-bold">GO</span>;
  }
  if (lower.endsWith('.java')) {
    return <span className="material-symbols-outlined text-[15px] text-red-400">coffee</span>;
  }
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) {
    return <span className="font-code-block text-[12px] text-cyan-400 font-bold">&lt;&gt;</span>;
  }
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs')) {
    return <span className="material-symbols-outlined text-[15px] text-yellow-400">javascript</span>;
  }
  if (lower.endsWith('.md')) {
    return <span className="material-symbols-outlined text-[15px] text-slate-400">description</span>;
  }
  return <span className="material-symbols-outlined text-[15px] text-secondary">code</span>;
};

interface ProjectWorkspacePageProps {
  project: LoadedProject;
  selectedFilePath: string;
  onSelectFile: (filePath: string) => void;
  selectedFunctionName: string | null;
  onSelectFunction: (fn: CodeFunction) => void;
  explanations?: any[];
  onExplainProjectOverview?: () => void;
  onExplainCurrentFile: () => void;
  onAskQuestion?: (question: string) => void;
  onExecuteCommand?: (command: string) => void;
  onResetWorkspace: () => void;
  onNavigate: (route: RouteId) => void;
  systemStatus: SystemStatus;
  onOpenChat?: () => void;
  onUpdateFileContent?: (filePath: string, newContent: string) => void;
}

export const ProjectWorkspacePage: React.FC<ProjectWorkspacePageProps> = ({
  project,
  selectedFilePath,
  onSelectFile,
  onExplainCurrentFile,
  onNavigate,
  onOpenChat,
  onUpdateFileContent,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openFiles, setOpenFiles] = useState<string[]>(() => {
    const list = [selectedFilePath];
    if (project.files.length > 1 && !list.includes(project.files[1].path)) {
      list.push(project.files[1].path);
    }
    if (project.files.length > 2 && !list.includes(project.files[2].path)) {
      list.push(project.files[2].path);
    }
    return list;
  });

  const [cursorPosition, setCursorPosition] = useState({ line: 9, col: 24 });
  const [openEditorsCollapsed, setOpenEditorsCollapsed] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SyntaxDiagnostic[]>([]);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const initialContentsRef = useRef<Record<string, string>>({});

  // Ensure current file is in openFiles
  useEffect(() => {
    if (selectedFilePath && !openFiles.includes(selectedFilePath)) {
      setOpenFiles((prev) => [...prev, selectedFilePath]);
    }
  }, [selectedFilePath, openFiles]);

  const activeFile: ProjectFile = useMemo(() => {
    return project.files.find((f) => f.path === selectedFilePath) || project.files[0];
  }, [project.files, selectedFilePath]);

  if (activeFile && initialContentsRef.current[activeFile.path] === undefined) {
    initialContentsRef.current[activeFile.path] = activeFile.content;
  }

  const isEdited = Boolean(
    activeFile &&
      initialContentsRef.current[activeFile.path] !== undefined &&
      activeFile.content !== initialContentsRef.current[activeFile.path]
  );

  const runDiagnostics = (code: string, filePath: string) => {
    if (!monacoRef.current || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const syntaxErrors = checkCodeSyntax(code, filePath);

    // 1. Monaco Markers (Standard VS Code Marker System)
    const severity = monacoRef.current.MarkerSeverity?.Error ?? 8;
    const markers = syntaxErrors.map((err) => ({
      startLineNumber: err.startLineNumber,
      startColumn: Math.max(1, err.startColumn),
      endLineNumber: err.endLineNumber,
      endColumn: Math.max(err.endColumn, err.startColumn + 4),
      message: err.message,
      severity,
    }));

    monacoRef.current.editor.setModelMarkers(model, 'gitvox-universal-validator', markers);

    // 2. Direct DOM Text Inline Decorations (Guarantees visible red wavy line across all browsers)
    if (typeof editorRef.current.deltaDecorations === 'function') {
      const newDecorations = syntaxErrors.map((err) => {
        const lineContent = model.getLineContent(err.startLineNumber) || '';
        const startCol = Math.max(1, err.startColumn);
        const endCol = Math.max(err.endColumn, startCol + 4, Math.min(lineContent.length + 1, startCol + 6));

        return {
          range: new monacoRef.current.Range(err.startLineNumber, startCol, err.endLineNumber, endCol),
          options: {
            isWholeLine: false,
            inlineClassName: 'gitvox-error-squiggly-inline',
            hoverMessage: { value: `**${err.message}**` },
            glyphMarginClassName: 'gitvox-error-glyph',
            overviewRuler: {
              color: '#ef4444',
              position: monacoRef.current.editor.OverviewRulerLane?.Right ?? 4,
            },
            minimap: {
              color: '#ef4444',
              position: monacoRef.current.editor.MinimapPosition?.Inline ?? 1,
            },
          },
        };
      });

      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, newDecorations);
    }

    setDiagnostics(syntaxErrors);
  };

  useEffect(() => {
    if (activeFile) {
      runDiagnostics(activeFile.content, activeFile.path);
    }
  }, [activeFile?.path]);

  const handleResetFile = () => {
    if (activeFile && initialContentsRef.current[activeFile.path] !== undefined && onUpdateFileContent) {
      onUpdateFileContent(activeFile.path, initialContentsRef.current[activeFile.path]);
      runDiagnostics(initialContentsRef.current[activeFile.path], activeFile.path);
    }
  };

  const handleDownloadFile = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCloseTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const nextOpen = openFiles.filter((p) => p !== path);
    setOpenFiles(nextOpen);
    if (selectedFilePath === path && nextOpen.length > 0) {
      onSelectFile(nextOpen[0]);
    }
  };

  const handleUndo = () => {
    if (editorRef.current) {
      editorRef.current.trigger('gitvox', 'undo', null);
      editorRef.current.focus();
    }
  };

  const handleRedo = () => {
    if (editorRef.current) {
      editorRef.current.trigger('gitvox', 'redo', null);
      editorRef.current.focus();
    }
  };

  const handleJumpToError = (diag: SyntaxDiagnostic) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(diag.startLineNumber);
      editorRef.current.setPosition({
        lineNumber: diag.startLineNumber,
        column: diag.startColumn,
      });
      editorRef.current.focus();
    }
  };

  const handleEditorBeforeMount: BeforeMount = (monaco) => {
    // Enable TS/JS compiler diagnostics
    if (monaco?.languages?.typescript) {
      monaco.languages.typescript.javascriptDefaults?.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
      monaco.languages.typescript.typescriptDefaults?.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    }

    // Register Gitvox Studio Dark Theme matching VS Code / screenshot
    monaco.editor.defineTheme('gitvox-studio-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', background: '0c1017', foreground: 'e2e8f0' },
        { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
        { token: 'keyword.control', foreground: '38bdf8', fontStyle: 'bold' },
        { token: 'string', foreground: '34d399' },
        { token: 'string.escape', foreground: '6ee7b7' },
        { token: 'number', foreground: 'fbbf24' },
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'type', foreground: 'a78bfa' },
        { token: 'type.identifier', foreground: 'c084fc' },
        { token: 'function', foreground: '67e8f9' },
        { token: 'identifier', foreground: 'f1f5f9' },
        { token: 'variable', foreground: 'e2e8f0' },
        { token: 'variable.parameter', foreground: 'cbd5e1' },
        { token: 'operator', foreground: '38bdf8' },
        { token: 'delimiter', foreground: '94a3b8' },
        { token: 'delimiter.bracket', foreground: '38bdf8' },
      ],
      colors: {
        'editor.background': '#0c1017',
        'editor.foreground': '#e2e8f0',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#38bdf8',
        'editor.lineHighlightBackground': '#131b29',
        'editor.lineHighlightBorder': '#1e293b00',
        'editor.selectionBackground': '#1e293b',
        'editor.inactiveSelectionBackground': '#1e293b80',
        'editorCursor.foreground': '#38bdf8',
        'editorWhitespace.foreground': '#334155',
        'editorIndentGuide.background': '#1e293b',
        'editorIndentGuide.activeBackground': '#38bdf840',
        'editorGutter.background': '#0c1017',
        'editorWidget.background': '#0f172a',
        'editorWidget.border': '#334155',
        'editorError.foreground': '#f87171',
        'editorWarning.foreground': '#fbbf24',
        'editorInfo.foreground': '#38bdf8',
      },
    });
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({ line: e.position.lineNumber, col: e.position.column });
    });
    if (activeFile) {
      runDiagnostics(activeFile.content, activeFile.path);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body-md text-body-md min-h-screen flex flex-col selection:bg-primary/25 selection:text-primary">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-2xl shadow-[0_4px_28px_rgba(0,0,0,0.7)] border-b border-surface-container-high/60">
        <div className="h-16 w-full px-gutter flex items-center justify-between gap-space-md">
          {/* Logo & Version */}
          <div className="flex items-center gap-space-lg">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-space-sm group cursor-pointer text-left bg-transparent border-0 p-0"
              type="button"
            >
              <div className="w-8 h-8 rounded-xl bg-surface-container-high border border-primary/30 flex items-center justify-center relative shadow-[0_0_16px_rgba(245,158,11,0.25)]">
                <span className="material-symbols-outlined text-primary text-[18px]">terminal</span>
                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-secondary rounded-full border-2 border-surface flex items-center justify-center">
                  <span className="w-1 h-1 bg-white rounded-full animate-ping"></span>
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-md text-[18px] tracking-tight font-bold text-on-surface">Gitvox</span>
                <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-telemetry-tag text-telemetry-tag uppercase tracking-wider border border-primary/20">
                  v2.4
                </span>
              </div>
            </button>
            <nav className="hidden md:flex items-center gap-space-xs p-1 rounded-xl bg-surface-container-lowest/80 backdrop-blur-md border border-surface-container-high/60">
              <button
                onClick={() => onNavigate('home')}
                className="px-3 py-1 rounded-lg text-on-surface-variant font-body-sm text-body-sm transition-all hover:bg-surface-container hover:text-on-surface cursor-pointer"
                type="button"
              >
                Overview
              </button>
              <button
                onClick={() => onNavigate('project')}
                aria-current="page"
                className="px-3 py-1 rounded-lg transition-all bg-surface-container-high text-primary font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] cursor-pointer"
                type="button"
              >
                Live Workspace
              </button>
              <button
                onClick={() => onNavigate('pr')}
                className="px-3 py-1 rounded-lg text-on-surface-variant font-body-sm text-body-sm transition-all hover:bg-surface-container hover:text-on-surface cursor-pointer"
                type="button"
              >
                PR Review Studio
              </button>
              <button
                onClick={() => onNavigate('explore')}
                className="px-3 py-1 rounded-lg text-on-surface-variant font-body-sm text-body-sm transition-all hover:bg-surface-container hover:text-on-surface cursor-pointer"
                type="button"
              >
                Upload Source
              </button>
            </nav>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => onNavigate('explore')}
              className="hidden sm:inline-flex items-center px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-sm text-body-sm transition-all border border-surface-container-highest/60 cursor-pointer"
              type="button"
            >
              Open Sample Project
            </button>
            <button
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-fixed text-on-primary font-body-sm text-body-sm font-semibold transition-all shadow-[0_0_16px_rgba(245,158,11,0.25)] cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
              <span>Upload Code</span>
            </button>
            <div className="flex items-center gap-2 pl-1">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-lowest border border-surface-container-high">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="font-telemetry-tag text-[10px] text-primary">IDLE</span>
              </div>
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[16px]">person</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="w-full pt-16 bg-surface flex-1 flex flex-col">
        <div className="relative w-full flex-1 flex min-h-[calc(100vh-4rem-28px)] bg-surface-container-lowest text-on-surface select-none overflow-hidden">
          {/* COLLAPSIBLE LEFT FILE EXPLORER */}
          <aside
            id="fileExplorerPanel"
            className={`${
              sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
            } flex-shrink-0 bg-surface-container-low transition-all duration-300 ease-in-out flex flex-col z-20 border-r border-surface-container-high/60 shadow-xl`}
          >
            {/* Explorer Header & Breadcrumb */}
            <div className="h-12 px-space-md bg-surface-container flex items-center justify-between border-b border-surface-container-high/50">
              <div className="flex items-center gap-space-sm min-w-0">
                <span className="material-symbols-outlined text-[18px] text-secondary">folder_open</span>
                <div className="flex items-center gap-1 font-telemetry-tag text-telemetry-tag text-on-surface truncate">
                  <span className="text-on-surface-variant font-medium">acme-platform</span>
                  <span className="text-outline">/</span>
                  <span className="text-secondary font-bold truncate">{project.name}</span>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors cursor-pointer"
                title="Toggle Sidebar"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">view_sidebar</span>
              </button>
            </div>

            {/* Quick Action Mini-Toolbar */}
            <div className="px-space-md py-space-xs bg-surface-container-low flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant border-b border-surface-container-high/40">
              <span className="uppercase tracking-wider font-telemetry-tag text-[10px] text-outline font-semibold">
                WORKSPACE EXPLORER
              </span>
              <div className="flex items-center gap-space-xs text-outline">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="hover:text-primary transition-colors cursor-pointer p-0.5"
                  title="Collapse Sidebar"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">unfold_less</span>
                </button>
              </div>
            </div>

            {/* Explorer Tree & Badges Scrollable Area */}
            <div className="flex-1 overflow-y-auto px-space-xs py-space-xs font-telemetry-tag text-telemetry-tag space-y-space-xs">
              {/* OPEN EDITORS SECTION (Interactive Dropdown) */}
              <div className="py-space-xs">
                <button
                  type="button"
                  onClick={() => setOpenEditorsCollapsed((prev) => !prev)}
                  className="w-full px-space-sm py-1.5 flex items-center justify-between text-outline cursor-pointer hover:text-on-surface hover:bg-surface-container/40 rounded select-none transition-colors group"
                  aria-expanded={!openEditorsCollapsed}
                  title="Toggle Open Editors"
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-primary transition-colors">
                      {openEditorsCollapsed ? 'chevron_right' : 'expand_more'}
                    </span>
                    <span className="tracking-widest text-[10px]">OPEN EDITORS</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-telemetry-tag font-semibold">
                    {openFiles.length}
                  </span>
                </button>

                {/* List of Open Editors - Collapsible */}
                {!openEditorsCollapsed && (
                  <div className="space-y-0.5 mt-0.5">
                    {openFiles.map((filePath) => {
                      const file = project.files.find((f) => f.path === filePath);
                      const isCurrent = filePath === activeFile.path;
                      return (
                        <div
                          key={filePath}
                          onClick={() => onSelectFile(filePath)}
                          className={`group mx-1 px-space-sm py-1.5 rounded flex items-center justify-between cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-surface-container border border-primary/30 shadow-sm'
                              : 'hover:bg-surface-container/60 text-on-surface-variant'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isCurrent ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                            ) : (
                              <span className="w-1.5 h-1.5"></span>
                            )}
                            <span className="material-symbols-outlined text-[16px] text-secondary">javascript</span>
                            <span className={`truncate ${isCurrent ? 'text-on-surface font-semibold' : ''}`}>
                              {file ? file.name : filePath.split('/').pop()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleCloseTab(e, filePath)}
                              className="material-symbols-outlined text-[14px] text-outline opacity-0 group-hover:opacity-100 hover:text-on-surface transition-all p-0.5"
                              type="button"
                              title="Close"
                            >
                              close
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FILES TREE SECTION */}
              <div className="py-space-xs">
                <div className="px-space-sm py-1 flex items-center justify-between text-outline cursor-pointer hover:text-on-surface border-b border-surface-container-high/40 pb-1.5 mb-1">
                  <span className="tracking-wider text-[11px] font-bold uppercase font-telemetry-tag">
                    FILES
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-outline">
                    folder_open
                  </span>
                </div>

                <FileTree
                  files={project.files}
                  selectedFilePath={activeFile.path}
                  onSelectFile={onSelectFile}
                />
              </div>
            </div>

            {/* Sidebar Status Telemetry */}
            <div className="p-space-sm bg-surface-container-lowest m-space-xs rounded-xl flex items-center justify-between border border-surface-container-high/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
                <span className="font-telemetry-tag text-[10px] text-on-surface-variant uppercase font-semibold">
                  SYNC ENGINE
                </span>
              </div>
              <span className="font-telemetry-tag text-[10px] text-primary font-bold">
                WATCHING {project.files.length} FILES
              </span>
            </div>
          </aside>

          {/* Central Workspace Area */}
          <section className="flex-1 flex flex-col bg-[#0c1017] min-w-0 relative">
            {/* Top Tab Bar (Matching VS Code / Image style) */}
            <div className="h-10 bg-[#080b11] flex items-center justify-between px-space-xs select-none border-b border-surface-container-high/60">
              <div className="flex items-center h-full space-x-0.5 overflow-x-auto">
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-1.5 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container mr-1 cursor-pointer"
                    title="Open Sidebar"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">view_sidebar</span>
                  </button>
                )}

                {openFiles.map((filePath) => {
                  const isCurrent = filePath === activeFile.path;
                  const name = filePath.split('/').pop();
                  return (
                    <div
                      key={filePath}
                      onClick={() => onSelectFile(filePath)}
                      className={`h-full px-space-md flex items-center gap-2 cursor-pointer relative group transition-colors border-r border-surface-container-high/30 ${
                        isCurrent
                          ? 'bg-[#0c1017] text-on-surface'
                          : 'bg-[#080b11] hover:bg-[#0c1017]/70 text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {getFileIcon(filePath)}
                      <span className={`font-telemetry-tag text-telemetry-tag ${isCurrent ? 'font-semibold text-white' : ''}`}>
                        {name}
                      </span>
                      <button
                        onClick={(e) => handleCloseTab(e, filePath)}
                        className="material-symbols-outlined text-[13px] text-outline group-hover:text-on-surface transition-colors ml-1 p-0.5 rounded hover:bg-surface-container"
                        type="button"
                        title="Close tab"
                      >
                        close
                      </button>
                      {isCurrent && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Editor View Action Icons */}
              <div className="flex items-center gap-1 text-on-surface-variant px-space-sm">
                <button
                  onClick={handleUndo}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors font-telemetry-tag text-[11px] cursor-pointer"
                  title="Undo (Ctrl+Z)"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[15px]">undo</span>
                  <span>Undo</span>
                </button>
                <button
                  onClick={handleRedo}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors font-telemetry-tag text-[11px] cursor-pointer"
                  title="Redo (Ctrl+Y)"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[15px]">redo</span>
                </button>
                <div className="h-4 w-px bg-surface-container-high mx-1"></div>
                <button
                  onClick={() => setWordWrap((prev) => !prev)}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    wordWrap
                      ? 'text-primary bg-primary/10'
                      : 'hover:text-on-surface hover:bg-surface-container'
                  }`}
                  title={wordWrap ? 'Disable Word Wrap (Slide Horizontally)' : 'Enable Word Wrap'}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">wrap_text</span>
                </button>
                {isEdited && (
                  <button
                    onClick={handleResetFile}
                    className="p-1 hover:text-primary hover:bg-surface-container rounded transition-colors cursor-pointer"
                    title="Revert modifications to original file"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">history</span>
                  </button>
                )}
                <button
                  onClick={handleDownloadFile}
                  className="p-1 hover:text-on-surface hover:bg-surface-container rounded transition-colors cursor-pointer"
                  title="Download File"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                </button>
                {onOpenChat && (
                  <button
                    onClick={onOpenChat}
                    className="p-1 hover:text-on-surface hover:bg-surface-container rounded transition-colors cursor-pointer text-primary"
                    title="Start Chat with Gitvox Assistant"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                  </button>
                )}
              </div>
            </div>

            {/* Editor Canvas Area with Full Sliding Capability */}
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden bg-[#0c1017] relative">
              {/* Monaco Editor Container */}
              <div className="flex-1 min-h-0 min-w-0 relative w-full h-full">
                <Editor
                  height="100%"
                  path={activeFile.path}
                  language={getMonacoLanguage(activeFile.path)}
                  theme="gitvox-studio-dark"
                  value={activeFile.content}
                  beforeMount={handleEditorBeforeMount}
                  onMount={handleEditorDidMount}
                  onChange={(val) => {
                    if (val !== undefined) {
                      if (onUpdateFileContent) {
                        onUpdateFileContent(activeFile.path, val);
                      }
                      runDiagnostics(val, activeFile.path);
                    }
                  }}
                  options={{
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono, monospace',
                    lineHeight: 22,
                    minimap: { enabled: true, side: 'right' },
                    scrollBeyondLastLine: true,
                    scrollBeyondLastColumn: 12,
                    automaticLayout: true,
                    smoothScrolling: true,
                    renderLineHighlight: 'all',
                    bracketPairColorization: { enabled: true },
                    tabSize: 2,
                    wordWrap: wordWrap ? 'on' : 'off',
                    scrollbar: {
                      vertical: 'visible',
                      horizontal: 'visible',
                      verticalScrollbarSize: 14,
                      horizontalScrollbarSize: 14,
                      verticalSliderSize: 14,
                      horizontalSliderSize: 14,
                      useShadows: true,
                      alwaysConsumeMouseWheel: false,
                    },
                  }}
                />
              </div>
            </div>

            {/* BOTTOM CODE STATUS BAR (VS Code Authentic Look) */}
            <footer className="h-7 bg-[#080b11] px-space-md flex items-center justify-between font-telemetry-tag text-[11px] text-on-surface-variant z-10 select-none border-t border-surface-container-highest/60">
              {/* Left Metas: Git & AST Diagnostics */}
              <div className="flex items-center gap-space-md">
                <div className="flex items-center gap-1 text-on-surface hover:text-primary transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-[14px]">fork_right</span>
                  <span className="font-semibold">main</span>
                </div>
                <div className="flex items-center gap-1 hover:text-on-surface transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-[14px] text-primary">sync</span>
                  <span>0 ↓ 1 ↑</span>
                </div>

                {diagnostics.length > 0 ? (
                  <div
                    onClick={() => handleJumpToError(diagnostics[0])}
                    className="flex items-center gap-1.5 text-error font-semibold cursor-pointer px-2 py-0.5 rounded bg-error/15 border border-error/30 hover:bg-error/25 transition-all"
                    title={`Click to jump to line ${diagnostics[0].startLineNumber}: ${diagnostics[0].message}`}
                  >
                    <span className="material-symbols-outlined text-[14px] text-error animate-pulse">error</span>
                    <span>
                      {diagnostics.length} {diagnostics.length === 1 ? 'Error' : 'Errors'} • Ln {diagnostics[0].startLineNumber}: {diagnostics[0].message}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>0 Errors • AST CLEAN</span>
                  </div>
                )}
              </div>

              {/* Right Metas: Encoding, Language & Telemetry */}
              <div className="flex items-center gap-space-md">
                <span className="hover:text-on-surface cursor-pointer">
                  Ln {cursorPosition.line}, Col {cursorPosition.col}
                </span>
                <span className="hover:text-on-surface cursor-pointer">UTF-8</span>
                <span className="hover:text-on-surface cursor-pointer">LF</span>
                <div className="flex items-center gap-1 text-secondary font-semibold cursor-pointer">
                  <span className="material-symbols-outlined text-[13px]">code</span>
                  <span>{getMonacoLanguage(activeFile.path)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-surface-container px-2 py-0.5 rounded border border-secondary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span className="text-secondary font-semibold">VOICE ~14ms</span>
                </div>
              </div>
            </footer>
          </section>
        </div>
      </main>

      {/* Telemetry Footer */}
      <footer className="w-full bg-surface-container-lowest py-2 shadow-[0_-1px_8px_rgba(0,0,0,0.04)] border-t border-surface-container-high/60">
        <div className="w-full px-gutter flex flex-col sm:flex-row items-center justify-between gap-space-sm font-body-sm text-body-sm text-on-surface-variant">
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-1.5 font-telemetry-tag text-telemetry-tag">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span>ENGINE LATENCY</span>
              <span className="text-secondary font-semibold">~14ms</span>
            </div>
            <span className="text-outline-variant font-telemetry-tag">•</span>
            <div className="flex items-center gap-1 font-telemetry-tag text-telemetry-tag text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-secondary">shield_lock</span>
              <span>E2E ZERO-RETENTION PRIVACY</span>
            </div>
          </div>
          <div className="flex items-center gap-space-md font-telemetry-tag text-telemetry-tag">
            <span className="text-outline">LOCAL_MODE // READY</span>
            <span>© 2025 GITVOX INTEL</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
