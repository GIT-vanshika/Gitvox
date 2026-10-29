import { useEffect, useMemo, useRef, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { StartExploringPage } from './pages/StartExploringPage';
import { ProjectWorkspacePage } from './pages/ProjectWorkspacePage';
import { PullRequestPage } from './pages/PullRequestPage';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { FloatingActions } from './components/common/FloatingMic';
import { SAMPLE_PROJECT } from './data/sampleProject';
import { SAMPLE_PULL_REQUEST } from './data/samplePullRequest';
import { SAMPLE_FINDINGS } from './data/sampleFindings';
import {
  buildContextualQuestionResponse,
  buildDiffHunkExplanation,
  buildFileExplanation,
  buildFunctionExplanation,
  buildProjectOverviewExplanation,
} from './services/aiService';
import { routeApplicationCommand } from './services/commandRouter';
import { interpretVoiceTranscript } from './services/voiceCommands';
import { buildAssistantRequest } from './services/assistantRequest';
import { explainAssistantWithModel, toModelErrorInfo } from './services/modelService';
import {
  type VoiceRequestResult,
} from './services/voiceAssistant';
import {
  AIExplanation,
  CodeFunction,
  CommandResult,
  DiffHunk,
  LoadedProject,
  RouteId,
  SystemStatus,
} from './types/gitvox';

export function App() {
  const initialRoute = useMemo<RouteId>(() => {
    if (typeof window === 'undefined') return 'home';
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return 'project';
    const r = params.get('route');
    if (r === 'explore' || r === 'project' || r === 'pr') return r;
    return 'home';
  }, []);

  const [currentRoute, setCurrentRoute] = useState<RouteId>(initialRoute);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('Ready');
  const [loadedProject, setLoadedProject] = useState<LoadedProject>(SAMPLE_PROJECT);
  const [selectedProjectFilePath, setSelectedProjectFilePath] = useState<string>(
    SAMPLE_PROJECT.files[0].path
  );
  const [selectedFunctionName, setSelectedFunctionName] = useState<string | null>(
    SAMPLE_PROJECT.files[0].functions[0]?.name || null
  );

  const [selectedPrFilePath, setSelectedPrFilePath] = useState<string>(
    SAMPLE_PULL_REQUEST.files[0].path
  );
  const [reviewedFiles, setReviewedFiles] = useState<Record<string, boolean>>({});

  const [explanations, setExplanations] = useState<AIExplanation[]>(() => [
    buildProjectOverviewExplanation(SAMPLE_PROJECT),
    buildFileExplanation(SAMPLE_PROJECT.files[0]),
  ]);

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantAutoStart, setAssistantAutoStart] = useState(false);
  const [assistantMode, setAssistantMode] = useState<'voice' | 'chat'>('voice');
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [lastCommandResult, setLastCommandResult] = useState<CommandResult | null>(null);

  // Escape key 3-second hold detection for hands-free microphone activation
  const [escapeHoldProgress, setEscapeHoldProgress] = useState<number | null>(null);
  const escapeHoldStartRef = useRef<number | null>(null);
  const escapeTimerRef = useRef<any>(null);
  const escapeIntervalRef = useRef<any>(null);

  const playMicActivationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentRoute]);

  const activeProjectFile = useMemo(() => {
    return (
      loadedProject.files.find((f) => f.path === selectedProjectFilePath) ||
      loadedProject.files[0] ||
      null
    );
  }, [loadedProject.files, selectedProjectFilePath]);

  const handleNavigate = (route: RouteId, targetFilePath?: string) => {
    if (targetFilePath) {
      if (route === 'pr') {
        setSelectedPrFilePath(targetFilePath);
      } else if (route === 'project') {
        setSelectedProjectFilePath(targetFilePath);
      }
    }
    setCurrentRoute(route);
  };

  const handleProjectLoaded = (newProject: LoadedProject) => {
    setLoadedProject(newProject);
    setHasUploadedFile(newProject.sourceType !== 'sample');
    const firstFile = newProject.files[0];
    setSelectedProjectFilePath(firstFile.path);
    setSelectedFunctionName(firstFile.functions[0]?.name || null);
    setExplanations([
      buildProjectOverviewExplanation(newProject),
      buildFileExplanation(firstFile),
    ]);
    setSystemStatus('Completed');
    setCurrentRoute('project');
  };

  const handleSelectProjectFile = (filePath: string) => {
    setSelectedProjectFilePath(filePath);
    const file = loadedProject.files.find((f) => f.path === filePath);
    if (file) {
      setSelectedFunctionName(file.functions[0]?.name || null);
    }
  };

  const handleSelectFunction = (fn: CodeFunction) => {
    setSelectedFunctionName(fn.name);
    if (!activeProjectFile) return;
    const fnExp = buildFunctionExplanation(activeProjectFile, fn);
    setExplanations((prev) => [fnExp, ...prev]);
    setSystemStatus('Completed');
  };

  const handleExplainProjectOverview = () => {
    const exp = buildProjectOverviewExplanation(loadedProject);
    setExplanations((prev) => [exp, ...prev]);
    setSystemStatus('Completed');
  };

  const handleExplainCurrentFile = () => {
    if (!activeProjectFile) return;
    const exp = buildFileExplanation(activeProjectFile);
    setExplanations((prev) => [exp, ...prev]);
    setSystemStatus('Completed');
  };

  const handleUpdateFileContent = (filePath: string, newContent: string) => {
    setLoadedProject((prev) => {
      const updatedFiles = prev.files.map((file) => {
        if (file.path === filePath) {
          return {
            ...file,
            content: newContent,
            sizeBytes: new Blob([newContent]).size,
          };
        }
        return file;
      });
      return {
        ...prev,
        files: updatedFiles,
      };
    });
  };

  const handleExecuteCommand = (commandText: string): CommandResult => {
    const result = routeApplicationCommand(commandText, {
      project: loadedProject,
      selectedFile: activeProjectFile,
      selectedFunctionName,
      pullRequest: SAMPLE_PULL_REQUEST,
      findings: SAMPLE_FINDINGS,
      currentRoute,
      selectedPrFile:
        SAMPLE_PULL_REQUEST.files.find((file) => file.path === selectedPrFilePath) || null,
    });

    setLastCommandResult(result);

    if (result.recognized) {
      if (result.targetFilePath) {
        if (result.targetRoute === 'pr' || currentRoute === 'pr') {
          setSelectedPrFilePath(result.targetFilePath);
        } else {
          setSelectedProjectFilePath(result.targetFilePath);
        }
      }
      if (result.targetRoute && result.targetRoute !== currentRoute) {
        setCurrentRoute(result.targetRoute);
      }
      if (result.explanation) {
        setExplanations((prev) => [result.explanation!, ...prev]);
      }
      setSystemStatus('Completed');
    } else {
      // If typed in the workspace question input and not a deterministic command, answer as a grounded question
      const qaExp = buildContextualQuestionResponse(
        commandText,
        loadedProject,
        activeProjectFile,
        SAMPLE_PULL_REQUEST
      );
      setExplanations((prev) => [qaExp, ...prev]);
      setSystemStatus('Completed');
    }

    return result;
  };

  const handleAskQuestion = (question: string) => {
    handleExecuteCommand(question);
  };

  /**
   * Opens the assistant drawer. The floating microphone requests an automatic
   * listening session right away; page-level text buttons open the drawer idle.
   */
  const openAssistant = (autoStart = false) => {
    setAssistantMode('voice');
    setAssistantAutoStart(autoStart);
    setAssistantOpen(true);
  };

  const openVoiceAssistant = (autoStart = true) => {
    setAssistantMode('voice');
    setAssistantAutoStart(autoStart);
    setAssistantOpen(true);
  };

  const openChatAssistant = () => {
    setAssistantMode('chat');
    setAssistantAutoStart(false);
    setAssistantOpen(true);
  };

  /**
   * Listen for 3-second hold on Escape key anywhere to automatically open microphone
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.repeat) return; // Prevent OS keyrepeat from resetting timer

        const startTime = Date.now();
        escapeHoldStartRef.current = startTime;
        setEscapeHoldProgress(0);

        if (escapeIntervalRef.current) clearInterval(escapeIntervalRef.current);
        escapeIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const pct = Math.min(100, Math.round((elapsed / 3000) * 100));
          setEscapeHoldProgress(pct);
        }, 40);

        if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
        escapeTimerRef.current = setTimeout(() => {
          if (escapeIntervalRef.current) clearInterval(escapeIntervalRef.current);
          setEscapeHoldProgress(null);
          escapeHoldStartRef.current = null;
          playMicActivationChime();
          openVoiceAssistant(true);
        }, 3000);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const heldFor = escapeHoldStartRef.current ? Date.now() - escapeHoldStartRef.current : 0;

        if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
        if (escapeIntervalRef.current) clearInterval(escapeIntervalRef.current);
        setEscapeHoldProgress(null);
        escapeHoldStartRef.current = null;

        // Quick tap closes assistant if open
        if (heldFor < 500 && assistantOpen) {
          setAssistantOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
      if (escapeIntervalRef.current) clearInterval(escapeIntervalRef.current);
    };
  }, [assistantOpen]);

  /**
   * Generates an in-memory grounded explanation fallback when backend model API is
   * unreachable (such as in static frontend deployments like Vercel).
   */
  const generateGroundedLocalExplanation = (transcript: string) => {
    const commandResult = routeApplicationCommand(transcript, {
      project: loadedProject,
      selectedFile: activeProjectFile,
      selectedFunctionName,
      pullRequest: SAMPLE_PULL_REQUEST,
      findings: SAMPLE_FINDINGS,
      currentRoute,
      selectedPrFile:
        SAMPLE_PULL_REQUEST.files.find((file) => file.path === selectedPrFilePath) || null,
    });

    if (commandResult.recognized && commandResult.explanation) {
      const exp = commandResult.explanation;
      const formatted = [
        `## ${exp.title}`,
        '',
        `**Scope:** ${exp.scopeLabel}`,
        '',
        exp.summary,
        '',
        ...exp.details.map((d) => `- ${d}`),
        ...(exp.evidenceSnippet ? ['', '> ' + exp.evidenceSnippet.split('\n').join('\n> ')] : []),
        '',
        `*${exp.confidenceNote}*`,
      ].join('\n');

      return {
        text: formatted,
        model: 'Gitvox Local Grounded Engine (In-Memory)',
        provider: 'Gitvox Deterministic Runtime',
        latencyMs: 12,
        generatedAt: new Date().toISOString(),
      };
    }

    const qaExp = buildContextualQuestionResponse(
      transcript,
      loadedProject,
      activeProjectFile,
      SAMPLE_PULL_REQUEST
    );

    const formatted = [
      `## ${qaExp.title}`,
      '',
      `**Scope:** ${qaExp.scopeLabel}`,
      '',
      qaExp.summary,
      '',
      ...qaExp.details.map((d) => `- ${d}`),
      ...(qaExp.evidenceSnippet ? ['', '> ' + qaExp.evidenceSnippet.split('\n').join('\n> ')] : []),
      '',
      `*${qaExp.confidenceNote}*`,
    ].join('\n');

    return {
      text: formatted,
      model: 'Gitvox Local Grounded Engine (In-Memory)',
      provider: 'Gitvox Contextual Engine',
      latencyMs: 15,
      generatedAt: new Date().toISOString(),
    };
  };

  /**
   * Every voice request is grounded in the current route-aware context and sent
   * through the existing server-side model bridge.
   * If the server endpoint is unreachable (e.g. static Vercel deployment), it
   * gracefully falls back to the in-memory grounded AI explanation engine!
   */
  const handleVoiceRequest = async (transcript: string): Promise<VoiceRequestResult> => {
    const match = interpretVoiceTranscript(transcript);

    if (match.kind === 'clarify') {
      return { kind: 'clarification', message: match.message };
    }
    if (match.kind === 'unsupported') {
      return { kind: 'error', message: match.message, retryable: false };
    }

    const built = buildAssistantRequest(match, {
      route: currentRoute,
      pullRequest: SAMPLE_PULL_REQUEST,
      selectedPrFile:
        SAMPLE_PULL_REQUEST.files.find((file) => file.path === selectedPrFilePath) || null,
      project: loadedProject,
      selectedFile: activeProjectFile,
      selectedFunctionName,
    });

    if (!built.ok) {
      return { kind: 'clarification', message: built.reason };
    }

    setSystemStatus('Analyzing');
    try {
      const explanation = await explainAssistantWithModel(built.request);
      setSystemStatus('Completed');
      return { kind: 'answer', title: built.title, explanation };
    } catch (_error) {
      try {
        const localExplanation = generateGroundedLocalExplanation(transcript);
        setSystemStatus('Completed');
        return {
          kind: 'answer',
          title: built.title,
          explanation: localExplanation,
        };
      } catch (fallbackError) {
        setSystemStatus('Failed');
        const info = toModelErrorInfo(fallbackError);
        return {
          kind: 'error',
          message: 'Could not process query. Please try again.',
          retryable: info.retryable,
        };
      }
    }
  };

  const handleExplainDiffHunk = (filePath: string, hunk: DiffHunk, fileSummary: string) => {
    const exp = buildDiffHunkExplanation(filePath, hunk, fileSummary);
    setExplanations((prev) => [exp, ...prev]);
    setSystemStatus('Completed');
  };

  const handleToggleFileReviewed = (filePath: string) => {
    setReviewedFiles((prev) => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
  };

  const handleResetWorkspace = () => {
    setHasUploadedFile(false);
    setSystemStatus('Idle');
    setCurrentRoute('explore');
  };

  return (
    <div className="min-h-screen bg-page text-ink">
      <main>
        {currentRoute === 'home' && <HomePage onNavigate={handleNavigate} />}

        {currentRoute === 'explore' && (
          <StartExploringPage
            systemStatus={systemStatus}
            onSetStatus={setSystemStatus}
            onProjectLoaded={handleProjectLoaded}
            onNavigate={handleNavigate}
          />
        )}

        {currentRoute === 'project' && (
          <ProjectWorkspacePage
            project={loadedProject}
            selectedFilePath={selectedProjectFilePath}
            onSelectFile={handleSelectProjectFile}
            selectedFunctionName={selectedFunctionName}
            onSelectFunction={handleSelectFunction}
            explanations={explanations}
            onExplainProjectOverview={handleExplainProjectOverview}
            onExplainCurrentFile={handleExplainCurrentFile}
            onAskQuestion={handleAskQuestion}
            onExecuteCommand={handleExecuteCommand}
            onResetWorkspace={handleResetWorkspace}
            onNavigate={handleNavigate}
            systemStatus={systemStatus}
            onOpenChat={openChatAssistant}
            onUpdateFileContent={handleUpdateFileContent}
          />
        )}

        {currentRoute === 'pr' && (
          <PullRequestPage
            pullRequest={SAMPLE_PULL_REQUEST}
            findings={SAMPLE_FINDINGS}
            selectedFilePath={selectedPrFilePath}
            onSelectFile={setSelectedPrFilePath}
            reviewedFiles={reviewedFiles}
            onToggleFileReviewed={handleToggleFileReviewed}
            explanations={explanations}
            onExplainHunk={handleExplainDiffHunk}
            onExecuteCommand={handleExecuteCommand}
            onNavigate={handleNavigate}
            onOpenChat={openChatAssistant}
          />
        )}
      </main>

      <ChatDrawer
        isOpen={assistantOpen}
        autoStart={assistantAutoStart}
        initialMode={assistantMode}
        onClose={() => setAssistantOpen(false)}
        onAutoStartHandled={() => setAssistantAutoStart(false)}
        onVoiceRequest={handleVoiceRequest}
      />

      <FloatingActions
        onVoiceClick={() => openVoiceAssistant(true)}
        onChatClick={openChatAssistant}
        hidden={assistantOpen}
        voiceState={
          systemStatus === 'Analyzing'
            ? 'processing'
            : systemStatus === 'Failed'
            ? 'error'
            : 'idle'
        }
      />

      {/* 3-Second Escape Key Hold Voice HUD Indicator */}
      {escapeHoldProgress !== null && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] animate-fade-in pointer-events-none">
          <div className="flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-surface-container-high/95 border border-primary/40 shadow-[0_8px_32px_rgba(245,158,11,0.35)] backdrop-blur-xl text-on-surface">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container-highest"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-primary transition-all duration-75"
                  strokeDasharray={`${escapeHoldProgress}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="material-symbols-outlined text-[18px] text-primary absolute animate-pulse">mic</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-telemetry-tag text-telemetry-tag text-primary font-bold uppercase tracking-wider">
                  HOLDING ESCAPE TO TALK
                </span>
                <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-code-block text-[10px] font-bold">
                  {((3000 - (escapeHoldProgress / 100) * 3000) / 1000).toFixed(1)}s
                </span>
              </div>
              <span className="text-[12px] text-on-surface-variant font-body-sm">
                Release anytime to cancel • Hold to communicate immediately
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
