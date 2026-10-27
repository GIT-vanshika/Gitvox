import React from 'react';
import { Mic } from 'lucide-react';

interface FloatingMicProps {
  onClick: () => void;
  /** Hidden while the assistant results panel owns the screen. */
  hidden?: boolean;
}

/**
 * The single voice entry point, anchored bottom-right on every route.
 * Pages reserve bottom padding so it never permanently covers content.
 */
export const FloatingMic: React.FC<FloatingMicProps> = ({ onClick, hidden = false }) => {
  if (hidden) return null;

  return (
    <div className="floating-mic">
      <span className="floating-mic__label" aria-hidden="true">
        Ask Gitvox
      </span>
      <button
        type="button"
        onClick={onClick}
        aria-label="Start a voice command"
        title="Start a voice command"
        className="floating-mic__button"
      >
        <Mic className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
};

export default FloatingMic;
