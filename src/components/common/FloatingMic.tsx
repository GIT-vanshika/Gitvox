import React from 'react';
import { Mic } from 'lucide-react';

interface FloatingMicProps {
  onClick: () => void;
  /** Hidden while the assistant results panel owns the screen. */
  hidden?: boolean;
  state?: 'idle' | 'listening' | 'processing' | 'error';
}

/**
 * The single voice entry point, anchored bottom-left within the viewport.
 * Features graphite circular base, neon-green microphone icon, subtle border,
 * and restrained shadow.
 */
export const FloatingMic: React.FC<FloatingMicProps> = ({
  onClick,
  hidden = false,
  state = 'idle',
}) => {
  if (hidden) return null;

  return (
    <div
      className={`floating-mic ${state === 'listening' ? 'floating-mic--listening' : ''}`}
      role="region"
      aria-label="Voice command assistant"
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={state === 'listening' ? 'Listening for voice command' : 'Start a voice command'}
        title="Start a voice command (or click to ask Gitvox)"
        data-state={state}
        className="floating-mic__button"
      >
        <Mic className="h-5 w-5" aria-hidden="true" />
      </button>
      <span className="floating-mic__label" aria-hidden="true">
        Ask Gitvox
      </span>
    </div>
  );
};

export default FloatingMic;
