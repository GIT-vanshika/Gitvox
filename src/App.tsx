import { useEffect, useMemo, useRef, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { StartExploringPage } from './pages/StartExploringPage';
import { ProjectWorkspacePage } from './pages/ProjectWorkspacePage';
import { PullRequestPage } from './pages/PullRequestPage';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { FloatingMic } from './components/common/FloatingMic';
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
  friendlyAssistantError,
  type VoiceRequestResult,
} from './services/voiceAssistant';
import {
  createSpeechRecognitionSession,
  isSpeechRecognitionSupported,
  type SpeechRecognitionSession,
} from './services/speechRecognition';
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
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [lastCommandResult, setLastCommandResult] = useState<CommandResult | null>(null);

  // Background wake word detection listener
  const wakeSessionRef = useRef<SpeechRecognitionSession | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentRoute]);

  // Set up background wake word listener when assistant is closed
  useEffect(() => {
    if (assistantOpen || !isSpeechRecognitionSupported()) {
      if (wakeSessionRef.current) {
        wakeSessionRef.current.dispose();
        wakeSessionRef.current = null;
      }
      return;
    }

    try {
      const session = createSpeechRecognitionSession({
        continuous: true,
        onWakeWordDetected: (commandAfter) => {
          // Wake word "Gitvox" detected! Open assistant and trigger listening
          openAssistant(true);
        },
      });
      session.start();
      wakeSessionRef.current = session;
    } catch {
      // Background wake listening fallback
    }

    return () => {
      if (wakeSessionRef.current) {
        wakeSessionRef.current.dispose();
        wakeSessionRef.current = null;
      }
    };
  }, [assistantOpen]);

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
   * listening session; page-level text buttons open the drawer idle.
   */
  const openAssistant = (autoStart = false) => {
    setAssistantAutoStart(autoStart);
    setAssistantOpen(true);
  };

  /**
   * Every voice request is grounded in the current route-aware context and sent
   * through the existing server-side model bridge. Clarification is returned
   * before any model call when the transcript is ambiguous.
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
    } catch (error) {
      setSystemStatus('Failed');
      const info = toModelErrorInfo(error);
      return {
        kind: 'error',
        message: friendlyAssistantError(info),
        retryable: info.retryable,
      };
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
          />
        )}
      </main>

      <ChatDrawer
        isOpen={assistantOpen}
        autoStart={assistantAutoStart}
        onClose={() => setAssistantOpen(false)}
        onAutoStartHandled={() => setAssistantAutoStart(false)}
        onVoiceRequest={handleVoiceRequest}
      />

      <FloatingMic
        onClick={() => openAssistant(true)}
        hidden={assistantOpen}
        state={
          systemStatus === 'Analyzing'
            ? 'processing'
            : systemStatus === 'Failed'
            ? 'error'
            : isSpeechRecognitionSupported()
            ? 'wake-listening'
            : 'idle'
        }
        wakeWordEnabled={isSpeechRecognitionSupported()}
      />
    </div>
  );
}

export default App;
