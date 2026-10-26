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
    {/* Left code bracket */}
    <path
      d="M7.5 6.5L3 12L7.5 17.5"
      stroke="#397BFF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Right code bracket */}
    <path
      d="M16.5 6.5L21 12L16.5 17.5"
      stroke="#397BFF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Center voice waveform bars */}
    <path
      d="M12 5.5V18.5"
      stroke="#FF294F"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M9.75 9V15"
      stroke="#F1F5FC"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M14.25 9V15"
      stroke="#F1F5FC"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

export const GitvoxWordmark: React.FC<GitvoxBrandProps> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#F1F5FC] hover:text-[#5EA1FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      aria-label="Gitvox Home"
    >
      <GitvoxLogoMark className="w-5 h-5 shrink-0" />
      <span>Gitvox</span>
    </button>
  );
};
