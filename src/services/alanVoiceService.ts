export interface AlanIntegrationConfig {
  sdkKeyConfigured: boolean;
  statusLabel: string;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unavailable';
}

/**
 * Inspects whether Alan AI SDK credentials are configured in the environment.
 * Never fakes a live voice session when credentials are absent.
 */
export function getAlanIntegrationConfig(): AlanIntegrationConfig {
  const sdkKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_ALAN_SDK_KEY as string | undefined)
      : undefined;

  const hasValidKey = Boolean(sdkKey && sdkKey.trim().length > 10 && sdkKey !== 'MY_ALAN_SDK_KEY');

  return {
    sdkKeyConfigured: hasValidKey,
    statusLabel: hasValidKey
      ? 'Alan AI Voice Adapter Ready'
      : 'Alan AI Voice Recognition Unavailable (VITE_ALAN_SDK_KEY not configured — Text Command Router Active)',
    permissionState: 'prompt',
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
      message: 'Browser audio input API (navigator.mediaDevices) is unavailable in this environment.',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return {
      granted: true,
      message:
        'Microphone permission granted. Configure VITE_ALAN_SDK_KEY to activate live Alan AI voice streaming, or use the command router below.',
    };
  } catch {
    return {
      granted: false,
      message:
        'Microphone permission denied or no audio input device found. Text-based command input remains active as fallback.',
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
