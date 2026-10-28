import React from 'react';
import { Mic } from 'lucide-react';

export interface FloatingActionsProps {
  onVoiceClick: () => void;
  onChatClick?: () => void;
  /** Hidden while the assistant results panel owns the screen. */
  hidden?: boolean;
  voiceState?: 'idle' | 'listening' | 'processing' | 'error';
}

/**
 * Voice action shortcut, anchored bottom-right within the viewport.
 */
export const FloatingActions: React.FC<FloatingActionsProps> = ({
  onVoiceClick,
  hidden = false,
  voiceState = 'idle',
}) => {
  if (hidden) return null;

  return (
    <div
      className="floating-actions"
      role="region"
      aria-label="Gitvox voice assistant shortcut"
    >
      {/* Voice microphone button */}
      <div
        className={`floating-action-item ${
          voiceState === 'listening' ? 'floating-action-item--listening' : ''
        }`}
      >
        <button
          type="button"
          onClick={onVoiceClick}
          aria-label={
            voiceState === 'listening'
              ? 'Listening for voice command'
              : 'Start a voice command'
          }
          title="Start a voice command (or click to speak)"
          data-state={voiceState}
          className="floating-action-btn floating-action-btn--mic"
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="floating-action-label" aria-hidden="true">
          {voiceState === 'listening' ? 'Listening…' : 'Ask Gitvox (Voice)'}
        </span>
      </div>
    </div>
  );
};

// Backwards compatibility alias
export const FloatingMic: React.FC<{
  onClick: () => void;
  hidden?: boolean;
  state?: 'idle' | 'listening' | 'processing' | 'error';
}> = ({ onClick, hidden, state }) => (
  <FloatingActions
    onVoiceClick={onClick}
    hidden={hidden}
    voiceState={state}
  />
);

export default FloatingActions;
