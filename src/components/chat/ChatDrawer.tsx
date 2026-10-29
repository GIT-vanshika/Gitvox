import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MessageSquare, Mic, Send, Square, X } from 'lucide-react';
import {
  createSpeechRecognitionSession,
  isSpeechRecognitionSupported,
  type SpeechRecognitionSession,
} from '../../services/speechRecognition';
import type { VoiceRequestResult } from '../../services/voiceAssistant';
import { AssistantMarkdown } from '../voice/AssistantMarkdown';

interface ChatDrawerProps {
  isOpen: boolean;
  autoStart: boolean;
  initialMode?: 'voice' | 'chat';
  onClose: () => void;
  onAutoStartHandled: () => void;
  onVoiceRequest: (transcript: string) => Promise<VoiceRequestResult>;
}

type VoiceStatus = 'idle' | 'listening' | 'unsupported' | 'error';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  title?: string;
  variant?: 'normal' | 'error' | 'clarification';
  retryTranscript?: string;
}

const DUPLICATE_TRANSCRIPT_WINDOW_MS = 2500;

function conciseSpeechError(code: string, fallback: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it in your browser, then try again.';
    case 'no-speech':
      return "I didn't hear anything. Try again, or type below.";
    case 'audio-capture':
      return 'No microphone is available. Type your question below.';
    case 'network':
      return 'Speech recognition is unavailable right now. Try again, or type below.';
    case 'language-not-supported':
      return 'Speech recognition does not support the configured language. Type below.';
    default:
      return fallback || 'Voice recognition failed. Try again, or type below.';
  }
}

function welcomeMessage(mode: 'voice' | 'chat'): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    text:
      mode === 'voice'
        ? 'Voice-first code intelligence ready. Tap the microphone below and ask about the current pull request, a selected file, or a line range.'
        : 'Ask about the current pull request, a selected file, or a line range. Type below or use the microphone.',
  };
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  autoStart,
  initialMode = 'voice',
  onClose,
  onAutoStartHandled,
  onVoiceRequest,
}) => {
  const [mode, setMode] = useState<'voice' | 'chat'>(initialMode);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(initialMode)]);
  const [isThinking, setIsThinking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isSupported] = useState(() => isSpeechRecognitionSupported());

  const sessionRef = useRef<SpeechRecognitionSession | null>(null);
  const requestHandlerRef = useRef(onVoiceRequest);
  const autoStartHandledRef = useRef(onAutoStartHandled);
  const autoStartRef = useRef(autoStart);
  const inFlightRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const lastHandledRef = useRef({ text: '', at: 0 });
  const messageIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const micRef = useRef<HTMLButtonElement | null>(null);
  const runRequestRef = useRef<(transcript: string) => Promise<void>>(async () => {});
  const startListeningRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (isOpen && initialMode) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    requestHandlerRef.current = onVoiceRequest;
  }, [onVoiceRequest]);

  useEffect(() => {
    autoStartHandledRef.current = onAutoStartHandled;
  }, [onAutoStartHandled]);

  useEffect(() => {
    autoStartRef.current = autoStart;
  }, [autoStart]);

  const nextMessageId = () => {
    messageIdRef.current += 1;
    return `message-${messageIdRef.current}`;
  };

  const appendMessage = (message: Omit<ChatMessage, 'id'>) => {
    setMessages((current) => [...current, { ...message, id: nextMessageId() }]);
  };

  const runRequest = async (transcript: string) => {
    const text = transcript.trim();
    if (!text || inFlightRef.current) return;

    const key = text.toLowerCase();
    const now = Date.now();
    if (
      key === lastHandledRef.current.text &&
      now - lastHandledRef.current.at < DUPLICATE_TRANSCRIPT_WINDOW_MS
    ) {
      return;
    }

    lastHandledRef.current = { text: key, at: now };
    inFlightRef.current = true;
    const generation = requestGenerationRef.current;

    appendMessage({ role: 'user', text });
    setIsThinking(true);
    setVoiceError('');

    try {
      const result = await requestHandlerRef.current(text);
      if (generation !== requestGenerationRef.current) return;

      if (result.kind === 'answer') {
        appendMessage({
          role: 'assistant',
          text: result.explanation.text,
          title: result.title,
        });
      } else if (result.kind === 'clarification') {
        appendMessage({
          role: 'assistant',
          text: result.message,
          variant: 'clarification',
        });
      } else {
        appendMessage({
          role: 'assistant',
          text: result.message,
          variant: 'error',
          retryTranscript: text,
        });
      }
    } catch (error) {
      if (generation !== requestGenerationRef.current) return;
      const message =
        error instanceof Error ? error.message : 'I could not generate an explanation. Please try again.';
      appendMessage({
        role: 'assistant',
        variant: 'error',
        text: message,
        retryTranscript: text,
      });
    } finally {
      if (generation === requestGenerationRef.current) {
        setIsThinking(false);
        inFlightRef.current = false;
      }
    }
  };

  runRequestRef.current = runRequest;

  const startListening = () => {
    if (!isSupported) {
      setVoiceStatus('unsupported');
      setVoiceError('Voice is unavailable in this browser. Please use text chat.');
      return;
    }

    sessionRef.current?.dispose();
    sessionRef.current = null;
    setVoiceError('');

    const session = createSpeechRecognitionSession({
      onStatus: (next) => {
        if (next === 'listening') setVoiceStatus('listening');
        if (next === 'unsupported') {
          setVoiceStatus('unsupported');
          setVoiceError('Voice is unavailable in this browser. Please use text chat.');
        }
      },
      onFinalTranscript: (transcript) => {
        setVoiceStatus('idle');
        void runRequestRef.current(transcript);
      },
      onError: (error) => {
        setVoiceStatus('error');
        setVoiceError(conciseSpeechError(error.code, error.message));
      },
    });

    sessionRef.current = session;
    session.start();
  };

  startListeningRef.current = startListening;

  useEffect(() => {
    if (!isOpen) {
      requestGenerationRef.current += 1;
      inFlightRef.current = false;
      sessionRef.current?.dispose();
      sessionRef.current = null;
      setVoiceStatus('idle');
      setVoiceError('');
      setIsThinking(false);
      return;
    }

    if (autoStartRef.current) {
      autoStartHandledRef.current();
      const timer = window.setTimeout(() => {
        startListeningRef.current();
      }, 100);
      return () => window.clearTimeout(timer);
    } else if (mode === 'chat') {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      sessionRef.current?.dispose();
    };
  }, []);

  const handleTextSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = textInput.trim();
    if (!query || isThinking) return;
    setTextInput('');
    void runRequest(query);
  };

  const handleMicClick = () => {
    if (voiceStatus === 'listening') {
      sessionRef.current?.stop();
      setVoiceStatus('idle');
      return;
    }
    startListening();
  };

  useEffect(() => {
    if (!isOpen) return;
    const openedAt = Date.now();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.repeat) return; // Ignore key repeat while holding
        // Ignore Escape within 1000ms of opening to allow smooth release from 3s hold
        if (Date.now() - openedAt < 1000) return;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleRetry = (transcript: string) => {
    lastHandledRef.current = { text: '', at: 0 };
    void runRequest(transcript);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[rgba(0,0,0,0.65)]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Gitvox assistant"
        onClick={(event) => event.stopPropagation()}
        className="chat-drawer flex h-full max-h-[100dvh] w-full max-w-full flex-col border-l border-line bg-page sm:max-w-[440px]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-[var(--bg-subtle)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Gitvox results</h2>
            <p className="mt-0.5 text-[11px] text-faint">
              {mode === 'voice' ? 'Voice assistant mode' : 'Interactive text chat'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-line bg-page p-0.5">
              <button
                type="button"
                onClick={() => setMode('voice')}
                aria-label="Switch to voice mode"
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  mode === 'voice'
                    ? 'bg-[var(--accent-soft)] text-accent font-semibold'
                    : 'text-faint hover:text-ink'
                }`}
              >
                <Mic className="h-3 w-3" aria-hidden="true" />
                Voice
              </button>
              <button
                type="button"
                onClick={() => setMode('chat')}
                aria-label="Switch to text chat mode"
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  mode === 'chat'
                    ? 'bg-[var(--accent-soft)] text-accent font-semibold'
                    : 'text-faint hover:text-ink'
                }`}
              >
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                Chat
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="btn btn-ghost btn-icon btn-sm"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    message.role === 'user'
                      ? 'max-w-[88%] rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-[13px] leading-6 text-ink'
                      : `max-w-[94%] rounded-lg border px-3.5 py-3 text-[13px] leading-6 ${
                          message.variant === 'error'
                            ? 'border-[var(--danger-border)] bg-[var(--danger-bg)]'
                            : message.variant === 'clarification'
                            ? 'border-[var(--warning-border)] bg-[var(--warning-bg)]'
                            : 'border-line bg-[var(--bg-subtle)]'
                        }`
                  }
                >
                  {message.role === 'assistant' && message.title && (
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-faint">
                      {message.title}
                    </div>
                  )}
                  {message.role === 'assistant' ? (
                    message.variant === 'error' || message.variant === 'clarification' ? (
                      <div>
                        <div className="flex items-start gap-2">
                          <AlertTriangle
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              message.variant === 'error'
                                ? 'text-[var(--danger)]'
                                : 'text-[var(--warning)]'
                            }`}
                            aria-hidden="true"
                          />
                          <p className="text-body">{message.text}</p>
                        </div>
                        {message.retryTranscript && (
                          <button
                            type="button"
                            onClick={() => handleRetry(message.retryTranscript!)}
                            className="mt-2 text-[11px] font-semibold text-[var(--danger)] underline-offset-2 hover:underline cursor-pointer"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    ) : (
                      <AssistantMarkdown text={message.text} />
                    )
                  ) : (
                    message.text
                  )}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[12px] text-faint">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden="true" />
                  Understanding your request…
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Voice-First Mode: ONLY the microphone control, no text input bar */}
        {mode === 'voice' ? (
          <div className="border-t border-line bg-[var(--bg-subtle)] px-4 py-4">
            {voiceError && (
              <p className="mb-3 rounded border border-[var(--warning-border)] bg-[var(--warning-bg)] px-2.5 py-1.5 text-[11px] leading-5 text-[var(--warning)]">
                {voiceError}
              </p>
            )}
            <div className="flex flex-col items-center justify-center gap-2">
              <button
                ref={micRef}
                type="button"
                onClick={handleMicClick}
                disabled={!isSupported || isThinking}
                aria-label={voiceStatus === 'listening' ? 'Stop listening' : 'Start voice input'}
                title={voiceStatus === 'listening' ? 'Stop listening' : 'Start voice input'}
                className={`inline-flex h-14 w-14 items-center justify-center rounded-full border transition-all cursor-pointer ${
                  voiceStatus === 'listening'
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[#111416] scale-105 shadow-lg'
                    : 'border-line bg-page text-accent hover:border-[var(--accent)] hover:bg-[var(--bg-muted)] hover:scale-105'
                }`}
              >
                {voiceStatus === 'listening' ? (
                  <Square className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Mic className="h-6 w-6" aria-hidden="true" />
                )}
              </button>
              <p className="text-[12px] font-medium text-body">
                {voiceStatus === 'listening' ? (
                  <span className="text-accent font-semibold animate-pulse">
                    Listening… speak your question
                  </span>
                ) : isThinking ? (
                  <span className="text-faint">Processing with model…</span>
                ) : (
                  <span className="text-faint">Tap microphone to speak</span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setMode('chat')}
                className="mt-1 text-[11px] text-faint hover:text-accent underline cursor-pointer"
              >
                Want to type? Switch to text chat
              </button>
            </div>
          </div>
        ) : (
          /* Text Chat Mode: Input text box + Send button + Microphone */
          <div className="border-t border-line bg-[var(--bg-subtle)] px-3 py-3">
            {voiceError && (
              <p className="mb-2 rounded border border-[var(--warning-border)] bg-[var(--warning-bg)] px-2.5 py-1.5 text-[11px] leading-5 text-[var(--warning)]">
                {voiceError}
              </p>
            )}
            <form onSubmit={handleTextSubmit}>
              <label htmlFor="chat-input" className="sr-only">
                Ask Gitvox
              </label>
              <div className="flex items-center gap-2">
                <button
                  ref={micRef}
                  type="button"
                  onClick={handleMicClick}
                  disabled={!isSupported || isThinking}
                  aria-label={voiceStatus === 'listening' ? 'Stop listening' : 'Start voice input'}
                  title={voiceStatus === 'listening' ? 'Stop listening' : 'Start voice input'}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                    voiceStatus === 'listening'
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[#111416]'
                      : 'border-line bg-page text-accent hover:border-[var(--accent)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  {voiceStatus === 'listening' ? (
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Mic className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <input
                  ref={inputRef}
                  id="chat-input"
                  type="text"
                  value={textInput}
                  onChange={(event) => setTextInput(event.target.value)}
                  placeholder={
                    voiceStatus === 'listening'
                      ? 'Listening…'
                      : 'Ask about this PR, a file, or lines 20–35…'
                  }
                  className="field min-w-0 flex-1"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={isThinking || !textInput.trim()}
                  className="btn btn-primary btn-icon shrink-0"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>
            {voiceStatus === 'listening' && (
              <p className="mt-2 text-[10px] font-medium text-accent">Listening…</p>
            )}
            <div className="mt-2 flex items-center justify-between text-[10px] text-faint">
              {!isSupported ? (
                <span>Voice unavailable in this browser.</span>
              ) : (
                <span>Text and voice enabled</span>
              )}
              <button
                type="button"
                onClick={() => setMode('voice')}
                className="hover:text-accent underline cursor-pointer"
              >
                Switch to voice-only
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
