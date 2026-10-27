import {
  getSpeechLanguage,
  getUnsupportedBrowserMessage,
  isSpeechRecognitionSupported,
} from './speechRecognition';

export interface VoiceIntegrationStatus {
  supported: boolean;
  language: string;
  label: string;
  message: string;
}

/**
 * Reports browser-native speech support. No key, account, or model files are
 * required; support depends on the browser's SpeechRecognition implementation.
 */
export function getVoiceIntegrationStatus(): VoiceIntegrationStatus {
  const supported = isSpeechRecognitionSupported();
  return {
    supported,
    language: getSpeechLanguage(),
    label: supported
      ? 'Browser speech recognition available'
      : 'Browser speech recognition unavailable',
    message: supported
      ? 'Voice uses the browser SpeechRecognition API. Availability and offline behavior vary by browser.'
      : getUnsupportedBrowserMessage(),
  };
}

/**
 * Checks browser microphone access honestly when the user requests a hardware permission check.
 */
export async function requestMicrophonePermissionCheck(): Promise<{
  granted: boolean;
  message: string;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      granted: false,
      message:
        'Browser audio input API (navigator.mediaDevices) is unavailable in this environment.',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return {
      granted: true,
      message:
        'Microphone permission granted. Click Start Listening and speak one of the supported commands.',
    };
  } catch {
    return {
      granted: false,
      message:
        'Microphone permission denied or no audio input device found. Allow microphone access in the browser or use the text commands.',
    };
  }
}

export interface GitHubIntegrationStatus {
  available: boolean;
  label: string;
  reason: string;
}

export function getGitHubIntegrationStatus(): GitHubIntegrationStatus {
  return {
    available: false,
    label: 'Planned / Unavailable in Demo MVP',
    reason:
      'Live GitHub repository and pull-request API import is modularized for future integration. Upload local source files, a ZIP project, or inspect the built-in sample repository and PR #284.',
  };
}