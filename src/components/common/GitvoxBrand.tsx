import React from 'react';

interface GitvoxBrandProps {
  onClick?: () => void;
}

export const GitvoxLogoMark: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M7.5 6.5L3 12L7.5 17.5"
      stroke="var(--accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.5 6.5L21 12L16.5 17.5"
      stroke="var(--accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 6V18" stroke="var(--text)" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M9.5 9V15" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M14.5 9V15" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const GitvoxWordmark: React.FC<GitvoxBrandProps> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[15px] font-semibold tracking-tight text-ink transition-colors hover:text-accent cursor-pointer"
      aria-label="Gitvox home"
    >
      <GitvoxLogoMark className="h-5 w-5 shrink-0" />
      <span>Gitvox</span>
    </button>
  );
};
