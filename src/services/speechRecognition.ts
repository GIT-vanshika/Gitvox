/**
 * Browser-native speech recognition wrapper around the Web Speech API
 * (`SpeechRecognition` / `webkitSpeechRecognition`).
 *
 * This module only turns microphone audio into transcripts. It never interprets
 * commands and never generates explanations: Gitvox's command router and model
 * backend stay separate from recognition.
 *
 * No SDK, account, API key, or paid service is required.
 */

export type SpeechRecognitionStatus =
  | 'idle'
  | 'listening'
  | 'unsupported'
  | 'permission-denied'
  | 'error';

export interface SpeechRecognitionErrorInfo {
  code: string;
  message: string;
  recoverable: boolean;
  status: SpeechRecognitionStatus;
}

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export const DEFAULT_SPEECH_LANGUAGE = 'en-US';

export const SPEECH_LANGUAGE_PRESETS = [
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-IN', label: 'English (India)' },
  { id: 'hi-IN', label: 'Hindi (India) - future' },
] as const;

export const DUPLICATE_RESULT_WINDOW_MS = 2500;

function readViteEnv(name: string): string | undefined {
  if (typeof import.meta === 'undefined' || !import.meta.env) return undefined;
  const value = (import.meta.env as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

export function getSpeechLanguage(): string {
  const configured = readViteEnv('VITE_SPEECH_LANGUAGE')?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_SPEECH_LANGUAGE;
}

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export function getUnsupportedBrowserMessage(): string {
  return 'This browser does not support the Web Speech API (SpeechRecognition / webkitSpeechRecognition). Try a recent desktop Chrome or Edge, or use the text commands below.';
}

export function mapSpeechRecognitionError(errorCode: string): SpeechRecognitionErrorInfo {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        code: errorCode,
        status: 'permission-denied',
        recoverable: true,
        message:
          'Microphone permission was denied or blocked. Allow microphone access for this site in the browser, then click Start Listening again.',
      };
    case 'no-speech':
      return {
        code: errorCode,
        status: 'error',
        recoverable: true,
        message:
          'No speech was detected. Click Start Listening, then speak one of the supported commands clearly.',
      };
    case 'audio-capture':
      return {
        code: errorCode,
        status: 'error',
        recoverable: true,
        message: 'No microphone was found or the audio device is unavailable.',
      };
    case 'network':
      return {
        code: errorCode,
        status: 'error',
        recoverable: true,
        message:
          'The browser speech service could not be reached. The Web Speech API is not guaranteed to work offline; check the connection and retry.',
      };
    case 'aborted':
      return {
        code: errorCode,
        status: 'idle',
        recoverable: true,
        message: 'Recognition stopped.',
      };
    case 'language-not-supported':
      return {
        code: errorCode,
        status: 'error',
        recoverable: false,
        message:
          'The configured speech language is not supported by this browser. Change VITE_SPEECH_LANGUAGE or use the text commands.',
      };
    default:
      return {
        code: errorCode || 'unknown',
        status: 'error',
        recoverable: true,
        message: `Speech recognition failed (${errorCode || 'unknown error'}). Retry or use the text commands below.`,
      };
  }
}

export interface SpeechTranscriptPayload {
  transcript: string;
  isFinal: boolean;
}

export interface SpeechRecognitionSessionOptions {
  language?: string;
  onStatus?: (status: SpeechRecognitionStatus) => void;
  onTranscript?: (payload: SpeechTranscriptPayload) => void;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (error: SpeechRecognitionErrorInfo) => void;
  recognitionFactory?: () => SpeechRecognitionLike | null;
  now?: () => number;
}

export interface SpeechRecognitionSession {
  readonly supported: boolean;
  isListening: () => boolean;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

/**
 * One session handles one spoken command: `continuous` is false, so the
 * microphone stops after a final result. The UI starts a session whenever the
 * user clicks the microphone button.
 */
export function createSpeechRecognitionSession(
  options: SpeechRecognitionSessionOptions = {}
): SpeechRecognitionSession {
  const defaultFactory = (): SpeechRecognitionLike | null => {
    const Ctor = getSpeechRecognitionConstructor();
    return Ctor ? new Ctor() : null;
  };
  const factory = options.recognitionFactory ?? defaultFactory;
  const now = options.now ?? (() => Date.now());
  const supported = factory() !== null;

  let recognition: SpeechRecognitionLike | null = null;
  let shouldListen = false;
  let listening = false;
  let disposed = false;
  let lastFinalText = '';
  let lastFinalAt = 0;

  const emitStatus = (status: SpeechRecognitionStatus) => {
    if (!disposed) options.onStatus?.(status);
  };

  const handleResult = (event: SpeechRecognitionEventLike) => {
    if (disposed) return;

    let interim = '';
    let final = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result || result.length === 0) continue;
      const transcript = result[0].transcript ?? '';
      if (result.isFinal) final += transcript;
      else interim += transcript;
    }

    const interimText = interim.trim();
    if (interimText) {
      options.onTranscript?.({ transcript: interimText, isFinal: false });
    }

    const finalText = final.trim();
    if (!finalText) return;

    const normalized = finalText.toLowerCase().replace(/\s+/g, ' ');
    const timestamp = now();
    if (normalized === lastFinalText && timestamp - lastFinalAt < DUPLICATE_RESULT_WINDOW_MS) {
      return;
    }
    lastFinalText = normalized;
    lastFinalAt = timestamp;

    shouldListen = false;
    options.onTranscript?.({ transcript: finalText, isFinal: true });
    options.onFinalTranscript?.(finalText);
  };

  const handleError = (event: SpeechRecognitionErrorEventLike) => {
    if (disposed) return;
    const info = mapSpeechRecognitionError(event.error);
    shouldListen = false;
    emitStatus(info.status);
    options.onError?.(info);
  };

  const buildRecognition = (): SpeechRecognitionLike | null => {
    const instance = factory();
    if (!instance) return null;

    instance.lang = options.language ?? getSpeechLanguage();
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      if (disposed) return;
      listening = true;
      emitStatus('listening');
    };
    instance.onresult = handleResult;
    instance.onerror = handleError;
    instance.onend = () => {
      listening = false;
      if (!disposed && !shouldListen) {
        emitStatus('idle');
      }
    };

    return instance;
  };

  return {
    supported,
    isListening: () => shouldListen && listening,
    start() {
      if (disposed) return;

      if (!recognition) {
        recognition = buildRecognition();
      }

      if (!recognition) {
        emitStatus('unsupported');
        options.onError?.({
          code: 'unsupported',
          status: 'unsupported',
          recoverable: false,
          message: getUnsupportedBrowserMessage(),
        });
        return;
      }

      if (shouldListen) return;

      shouldListen = true;
      lastFinalText = '';
      lastFinalAt = 0;

      try {
        recognition.start();
        emitStatus('listening');
      } catch (error) {
        if (error instanceof Error && /already started/i.test(error.message)) {
          return;
        }
        shouldListen = false;
        const info: SpeechRecognitionErrorInfo = {
          code: 'start-failed',
          status: 'error',
          recoverable: true,
          message:
            'Speech recognition could not start. Check microphone permissions and try again, or use the text commands below.',
        };
        emitStatus('error');
        options.onError?.(info);
      }
    },
    stop() {
      shouldListen = false;
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // Stopping an inactive recognizer
        }
      }
      listening = false;
      emitStatus('idle');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      shouldListen = false;
      listening = false;

      const instance = recognition;
      recognition = null;
      if (instance) {
        instance.onresult = null;
        instance.onerror = null;
        instance.onend = null;
        instance.onstart = null;
        try {
          instance.abort();
        } catch {
          // Aborting during teardown
        }
      }
    },
  };
}
