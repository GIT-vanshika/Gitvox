import React from 'react';
import { Mic, Radio } from 'lucide-react';

interface FloatingMicProps {
  onClick: () => void;
  /** Hidden while the assistant results panel owns the screen. */
  hidden?: boolean;
  state?: 'idle' | 'listening' | 'wake-listening' | 'processing' | 'error';
  wakeWordEnabled?: boolean;
}

/**
 * The single voice entry point, anchored bottom-left within the viewport.
 * Features graphite circular base, neon-green microphone icon, subtle border,
 * and restrained shadow.
 *
 * Supports wake phrase "Hey Gitvox" indication.
 */
export const FloatingMic: React.FC<FloatingMicProps> = ({
  onClick,
  hidden = false,
  state = 'idle',
  wakeWordEnabled = true,
}) => {
  if (hidden) return null;

  const isListening = state === 'listening';
  const isWakeListening = state === 'wake-listening';

  return (
    <div
      className={`floating-mic ${isListening ? 'floating-mic--listening' : ''}`}
      role="region"
      aria-label="Voice command assistant"
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={
          isListening
            ? 'Listening for voice command'
            : isWakeListening
            ? 'Say "Hey Gitvox" or click to speak'
            : 'Start a voice command'
        }
        title={
          wakeWordEnabled
            ? 'Say "Hey Gitvox" or click to ask'
            : 'Start a voice command (or click to ask Gitvox)'
        }
        data-state={state}
        className="floating-mic__button relative"
      >
        {isWakeListening ? (
          <Radio className="h-5 w-5 text-accent animate-pulse" aria-hidden="true" />
        ) : (
          <Mic className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
      <span className="floating-mic__label" aria-hidden="true">
        {isWakeListening ? 'Say "Hey Gitvox"' : 'Ask Gitvox'}
      </span>
    </div>
  );
};

export default FloatingMic;
