import React from 'react';
import { AlertTriangle, AudioWaveform, FileCode, GitPullRequest, Mic } from 'lucide-react';

const WAVE_BARS = [0.5, 0.9, 0.4, 1, 0.65, 0.35, 0.8, 0.55, 0.95, 0.45];

const NODES = [
  {
    icon: FileCode,
    label: 'File context',
    value: 'src/middleware/auth.js',
    accent: 'blue' as const,
    position: 'left-[-1%] top-[5%]',
    delay: '0s',
  },
  {
    icon: AudioWaveform,
    label: 'Voice intent',
    value: '“Explain this pull request”',
    accent: 'blue' as const,
    position: 'right-[-1%] top-[17%]',
    delay: '1.4s',
  },
  {
    icon: GitPullRequest,
    label: 'Diff evidence',
    value: 'PR #284 · +86 / -24',
    accent: 'blue' as const,
    position: 'right-[-1%] bottom-[15%]',
    delay: '2.6s',
  },
  {
    icon: AlertTriangle,
    label: 'Review finding',
    value: 'High severity · auth.js:12',
    accent: 'red' as const,
    position: 'left-[-1%] bottom-[6%]',
    delay: '3.6s',
  },
];

/**
 * Decorative 3D orbital visual for the voice-to-code relationship.
 * Rings are real CSS 3D transforms; node cards float in depth.
 */
export const VoiceCore: React.FC = () => {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px]" aria-hidden="true">
      {/* Ambient glow */}
      <div className="absolute inset-[18%] rounded-full bg-[#397BFF]/20 blur-[70px]" />
      <div className="absolute inset-[34%] rounded-full bg-[#FF294F]/10 blur-[50px]" />

      {/* Orbital rings */}
      <div className="orbit-scene absolute inset-0">
        <div className="orbit-ring" style={{ inset: '6%', animationDuration: '30s' }} />
        <div
          className="orbit-ring orbit-ring--red"
          style={{ inset: '16%', animationDuration: '44s', animationDirection: 'reverse' }}
        />
        <div
          className="orbit-ring"
          style={{
            inset: '27%',
            animationDuration: '58s',
            borderColor: 'rgba(57, 123, 255, 0.14)',
          }}
        />
      </div>

      {/* Signal lines */}
      <svg
        viewBox="0 0 400 400"
        className="absolute inset-0 h-full w-full"
        fill="none"
        preserveAspectRatio="none"
      >
        <path d="M200 200 Q 148 148 118 104" className="signal-line" stroke="rgba(94,161,255,0.35)" strokeWidth="1" />
        <path d="M200 200 Q 262 158 292 118" className="signal-line" stroke="rgba(94,161,255,0.3)" strokeWidth="1" />
        <path d="M200 200 Q 268 252 300 288" className="signal-line" stroke="rgba(94,161,255,0.25)" strokeWidth="1" />
        <path d="M200 200 Q 142 246 112 286" className="signal-line" stroke="rgba(255,82,111,0.35)" strokeWidth="1" />
      </svg>

      {/* Core */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative grid h-28 w-28 place-items-center rounded-full border border-[#5EA1FF]/40 bg-[#0B1220]/90 md:h-32 md:w-32">
          <span className="animate-pulse-ring absolute inset-0 rounded-full border border-[#5EA1FF]/45" />
          <span
            className="animate-pulse-ring absolute inset-0 rounded-full border border-[#FF294F]/30"
            style={{ animationDelay: '1.2s' }}
          />
          <div className="core-pulse grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#1B3A78] via-[#12203B] to-[#0B1220] md:h-24 md:w-24">
            <Mic className="h-9 w-9 text-[#EAF1FF]" strokeWidth={1.6} />
          </div>
        </div>

        {/* Waveform */}
        <div className="mt-5 flex h-8 items-center justify-center gap-1">
          {WAVE_BARS.map((scale, index) => (
            <span
              key={index}
              className="wave-bar w-[3px] origin-center rounded-full bg-gradient-to-t from-[#397BFF] to-[#8FB8FF]"
              style={{
                height: `${scale * 100}%`,
                animationDelay: `${index * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Floating evidence cards */}
      {NODES.map((node) => {
        const Icon = node.icon;
        const isRed = node.accent === 'red';
        return (
          <div
            key={node.label}
            className={`animate-float absolute ${node.position} w-[142px] rounded-xl border p-2.5 backdrop-blur-md sm:w-[160px] sm:p-3 ${
              isRed
                ? 'border-[#FF294F]/45 bg-[#1A0B12]/80 shadow-[0_16px_40px_-22px_rgba(255,41,79,0.8)]'
                : 'border-[#263247] bg-[#0B1220]/80 shadow-[0_16px_40px_-22px_rgba(57,123,255,0.7)]'
            }`}
            style={{ animationDelay: node.delay }}
          >
            <div className="flex items-center gap-2">
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${isRed ? 'text-[#FF526F]' : 'text-[#5EA1FF]'}`}
                strokeWidth={1.8}
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#77849A]">
                {node.label}
              </span>
            </div>
            <p
              className={`mt-1.5 truncate font-mono text-[10.5px] ${
                isRed ? 'text-[#FFD5DC]' : 'text-[#D6E2F5]'
              }`}
            >
              {node.value}
            </p>
          </div>
        );
      })}
    </div>
  );
};
