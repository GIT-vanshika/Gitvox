import React from 'react';
import { Mic, MessageSquare } from 'lucide-react';

export interface FloatingActionsProps {
  onVoiceClick: () => void;
  onChatClick: () => void;
  /** Hidden while the assistant results panel owns the screen. */
  hidden?: boolean;
  voiceState?: 'idle' | 'listening' | 'processing' | 'error';
}

/**
 * Voice and chat shortcuts, anchored bottom-right within the viewport.
 * Chat button sits directly above the floating microphone button.
 */
export const FloatingActions: React.FC<FloatingActionsProps> = ({
  onVoiceClick,
  onChatClick,
  hidden = false,
  voiceState = 'idle',
}) => {
  if (hidden) return null;

  return (
    <div
      className="floating-actions"
      role="region"
      aria-label="Gitvox voice and chat assistant shortcuts"
    >
      {/* Chat button directly above the microphone */}
      <div className="floating-action-item">
        <button
          type="button"
          onClick={onChatClick}
          aria-label="Start text chat with Gitvox"
          title="Start text chat with Gitvox"
          className="floating-action-btn floating-action-btn--chat"
        >
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="floating-action-label" aria-hidden="true">
          Start Chat
        </span>
      </div>

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
    onChatClick={onClick}
    hidden={hidden}
    voiceState={state}
  />
);

export default FloatingActions;
