import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  AudioWaveform,
  FileCode,
  GitBranch,
  GitPullRequest,
  Mic,
  FolderGit2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { GitvoxWordmark } from '../components/common/GitvoxBrand';
import { Reveal } from '../components/effects/Reveal';
import { TiltCard } from '../components/effects/TiltCard';
import { VoiceCore } from '../components/effects/VoiceCore';
import { SAMPLE_PULL_REQUEST } from '../data/samplePullRequest';
import { SAMPLE_FINDINGS } from '../data/sampleFindings';
import { computeFileDiff } from '../services/diffService';
import { renderHighlightedLine } from '../utils/syntaxHighlight';
import { RouteId } from '../types/gitvox';

interface HomePageProps {
  onNavigate: (route: RouteId, targetFilePath?: string) => void;
  onOpenVoiceModal: () => void;
}

const VOICE_COMMANDS = [
  'Explain this project.',
  'Show the authentication middleware.',
  'Summarize this file.',
  'Explain this pull request.',
  'Check these changes for potential bugs.',
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onOpenVoiceModal }) => {
  const [heroPreviewTab, setHeroPreviewTab] = useState<'diff' | 'explanation'>('diff');
  const [scrolled, setScrolled] = useState(false);

  const previewFile = SAMPLE_PULL_REQUEST.files[0]; // src/middleware/auth.js
  const previewDiff = computeFileDiff(
    previewFile.baseContent,
    previewFile.proposedContent,
    previewFile.path
  );
  const previewLines = previewDiff.unifiedLines.slice(0, 14);
  const topFinding = SAMPLE_FINDINGS[0];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col text-[#F1F5FC]">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4 single-line nav links) — Zone 3 (1 primary CTA) */}
      <header
        className={`sticky top-0 z-40 border-b px-6 py-3.5 transition-all duration-500 ${
          scrolled
            ? 'glass-bar border-[#263247]/80 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.95)]'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8">
          <GitvoxWordmark onClick={() => onNavigate('home')} />

          <nav
            aria-label="Primary Navigation"
            className="hidden items-center gap-7 text-sm font-medium text-[#A0AEC2] md:flex"
          >
            <a
              href="#how-it-works"
              className="nav-link whitespace-nowrap text-sm transition-colors hover:text-[#F1F5FC]"
            >
              How It Works
            </a>
            <a
              href="#code-understanding"
              className="nav-link whitespace-nowrap text-sm transition-colors hover:text-[#F1F5FC]"
            >
              Code Understanding
            </a>
            <a
              href="#pull-request-review"
              className="nav-link whitespace-nowrap text-sm transition-colors hover:text-[#F1F5FC]"
            >
              Pull Request Review
            </a>
            <button
              type="button"
              onClick={() => onNavigate('project')}
              className="nav-link shrink-0 cursor-pointer whitespace-nowrap text-sm transition-colors hover:text-[#F1F5FC]"
            >
              Sample Workspace
            </button>
          </nav>

          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="btn-primary inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#397BFF] px-4 py-2 text-xs font-semibold text-[#F1F5FC] shadow-[0_10px_30px_-14px_rgba(57,123,255,0.9)] ring-1 ring-inset ring-white/15 transition-all hover:-translate-y-0.5 hover:bg-[#5EA1FF] hover:shadow-[0_16px_40px_-14px_rgba(57,123,255,1)]"
            >
              Start Exploring
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section: Editorial, Asymmetric 2-Column Split */}
        <section className="relative overflow-hidden border-b border-[#263247]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-[#397BFF]/20 blur-[130px]" />
            <div className="absolute -right-20 top-1/4 h-[380px] w-[380px] rounded-full bg-[#FF294F]/10 blur-[130px]" />
            <div className="grid-lines-fade absolute inset-0 opacity-50" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-14 lg:pb-32 lg:pt-20">
            <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10">
              {/* Left Column: Editorial Value Proposition (5 cols) */}
              <div className="lg:col-span-5">
                <Reveal>
                  <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5EA1FF]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39D98A] opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#39D98A]" />
                    </span>
                    Voice-first code intelligence
                  </p>
                </Reveal>

                <Reveal delay={90}>
                  <h1
                    className="font-display mt-5 text-[#F1F5FC]"
                    style={{ fontSize: 'clamp(2.4rem, 4vw, 3.85rem)' }}
                  >
                    <span className="block">Understand code.</span>
                    <span className="block">Review smarter.</span>
                    <span className="text-gradient block">Speak naturally.</span>
                  </h1>
                </Reveal>

                <Reveal delay={170}>
                  <p className="mt-6 max-w-xl text-base leading-relaxed text-[#A0AEC2]">
                    Explore unfamiliar projects, understand code changes, and investigate potential
                    bugs through conversational AI — grounded in the files you actually loaded.
                  </p>
                </Reveal>

                <Reveal delay={240}>
                  <div className="mt-9 flex flex-wrap items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => onNavigate('explore')}
                      className="btn-primary group inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#397BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_-18px_rgba(57,123,255,0.95)] ring-1 ring-inset ring-white/15 transition-all hover:-translate-y-0.5 hover:bg-[#5EA1FF]"
                    >
                      <span>Start Exploring Code</span>
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate('pr')}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#263247] bg-[#0D111A]/80 px-5 py-3 text-sm font-medium text-[#F1F5FC] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[#397BFF]/60 hover:bg-[#121926]"
                    >
                      <GitPullRequest className="h-4 w-4 text-[#5EA1FF]" aria-hidden="true" />
                      Try Sample Pull Request
                    </button>
                  </div>
                </Reveal>

                {/* Unboxed Metadata Summary (Zero-Pill Discipline) */}
                <Reveal delay={320}>
                  <div className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#263247] pt-6 text-xs text-[#77849A]">
                    <span className="font-medium text-[#A0AEC2]">Built-in Sample Ready</span>
                    <span aria-hidden="true">·</span>
                    <span>acme-platform/api-server</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">PR #284 (+86 / -24)</span>
                    <span aria-hidden="true">·</span>
                    <span>Alan AI Voice + Text Router</span>
                  </div>
                </Reveal>
              </div>

              {/* Right Column: Genuine Miniature Gitvox Workspace Preview (7 cols) */}
              <div className="relative lg:col-span-7">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-6 rounded-[32px] bg-gradient-to-tr from-[#397BFF]/25 via-transparent to-[#FF294F]/20 blur-2xl"
                />

                <Reveal delay={140}>
                  <TiltCard className="rounded-2xl" max={6}>
                    <div className="relative overflow-hidden rounded-2xl border border-[#263247] bg-[#0D111A] shadow-[0_50px_140px_-50px_rgba(57,123,255,0.6)]">
                      {/* Workspace Preview Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#263247] bg-[#121926]/90 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-[#F1F5FC]">
                          <FileCode className="h-4 w-4 shrink-0 text-[#397BFF]" aria-hidden="true" />
                          <span className="truncate">{previewFile.path}</span>
                          <span className="text-[#77849A]" aria-hidden="true">
                            ·
                          </span>
                          <span className="tabular-nums text-[#39D98A]">+{previewDiff.additions}</span>
                          <span className="tabular-nums text-[#FF526F]">-{previewDiff.deletions}</span>
                        </div>

                        {/* Interactive Segmented Control */}
                        <div className="flex items-center gap-1 rounded-md border border-[#263247] bg-[#080A0F] p-0.5">
                          <button
                            type="button"
                            onClick={() => setHeroPreviewTab('diff')}
                            className={`shrink-0 cursor-pointer whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                              heroPreviewTab === 'diff'
                                ? 'bg-[#397BFF] text-[#F1F5FC]'
                                : 'text-[#A0AEC2] hover:text-[#F1F5FC]'
                            }`}
                          >
                            Unified Diff
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeroPreviewTab('explanation')}
                            className={`shrink-0 cursor-pointer whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                              heroPreviewTab === 'explanation'
                                ? 'bg-[#397BFF] text-[#F1F5FC]'
                                : 'text-[#A0AEC2] hover:text-[#F1F5FC]'
                            }`}
                          >
                            Grounded AI Context
                          </button>
                        </div>
                      </div>

                      {/* Workspace Preview Content */}
                      {heroPreviewTab === 'diff' ? (
                        <div className="flex-1 overflow-x-auto py-2 font-mono text-xs leading-relaxed">
                          {previewLines.map((line, index) => {
                            const bgClass =
                              line.type === 'added'
                                ? 'bg-[#39D98A]/10 text-[#F1F5FC]'
                                : line.type === 'deleted'
                                ? 'bg-[#FF526F]/10 text-[#A0AEC2]'
                                : 'text-[#A0AEC2]';
                            const prefix =
                              line.type === 'added' ? '+' : line.type === 'deleted' ? '-' : ' ';

                            return (
                              <div
                                key={`${index}-${line.oldLineNumber ?? 'n'}-${line.newLineNumber ?? 'n'}`}
                                className={`flex items-baseline gap-3 px-4 py-0.5 ${bgClass}`}
                              >
                                <span className="w-6 shrink-0 select-none text-right text-[11px] tabular-nums text-[#77849A]">
                                  {line.oldLineNumber ?? ''}
                                </span>
                                <span className="w-6 shrink-0 select-none text-right text-[11px] tabular-nums text-[#77849A]">
                                  {line.newLineNumber ?? ''}
                                </span>
                                <span
                                  className={`w-3 shrink-0 select-none font-bold ${
                                    line.type === 'added'
                                      ? 'text-[#39D98A]'
                                      : line.type === 'deleted'
                                      ? 'text-[#FF526F]'
                                      : 'text-[#77849A]'
                                  }`}
                                >
                                  {prefix}
                                </span>
                                <span className="whitespace-pre">{renderHighlightedLine(line.content)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-1 flex-col justify-between bg-[#080A0F]/80 p-5">
                          <div>
                            <div className="font-mono text-xs text-[#77849A]">
                              Grounded Explanation · src/middleware/auth.js (Lines 5–24)
                            </div>
                            <h2 className="mt-1.5 text-sm font-semibold text-[#F1F5FC]">
                              Bearer Token Extraction &amp; Expiration Guard
                            </h2>
                            <p className="mt-2 text-xs leading-relaxed text-[#A0AEC2]">
                              Replaces the static <code className="text-[#F1F5FC]">x-api-key</code>{' '}
                              header comparison with{' '}
                              <code className="text-[#5EA1FF]">extractBearerToken()</code> and{' '}
                              <code className="text-[#5EA1FF]">verifyAccessToken()</code>. Verifies{' '}
                              <code className="text-[#F1F5FC]">payload.exp</code> against current epoch
                              milliseconds and populates scoped permissions on{' '}
                              <code className="text-[#F1F5FC]">req.user</code>.
                            </p>
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-[#263247] pt-3 text-xs text-[#77849A]">
                            <span>Confidence: Verified against base &amp; proposed source</span>
                            <button
                              type="button"
                              onClick={() => onNavigate('project', 'src/middleware/auth.js')}
                              className="cursor-pointer text-[#5EA1FF] hover:underline"
                            >
                              Inspect in Workspace →
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Selective Neon-Red Brand Accent: Contextual Review Finding Strip */}
                      <div className="flex flex-col justify-between gap-3 border-t border-[#FF294F]/40 bg-[#121926] px-4 py-3 sm:flex-row sm:items-center">
                        <div className="flex items-start gap-2.5 text-xs sm:items-center">
                          <AlertTriangle
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#FF294F] sm:mt-0"
                            aria-hidden="true"
                          />
                          <div>
                            <span className="font-semibold text-[#FF526F]">
                              High Severity Sample Finding:
                            </span>{' '}
                            <span className="text-[#F1F5FC]">{topFinding.title}</span>
                            <span className="ml-2 font-mono text-[#77849A]">
                              ({topFinding.filePath}:{topFinding.startLine})
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onNavigate('pr', topFinding.filePath)}
                          className="shrink-0 cursor-pointer whitespace-nowrap text-xs font-medium text-[#5EA1FF] transition-colors hover:text-[#F1F5FC]"
                        >
                          Open Diff Line →
                        </button>
                      </div>
                    </div>

                    {/* Floating depth layers */}
                    <div
                      className="pointer-events-none absolute -right-10 -top-16 hidden w-[218px] rounded-xl border border-[#397BFF]/40 bg-[#0B1220]/85 p-3 shadow-[0_24px_60px_-24px_rgba(57,123,255,0.9)] backdrop-blur-md lg:block"
                      style={{ transform: 'translateZ(70px)' }}
                    >
                      <div className="flex items-center gap-2">
                        <AudioWaveform className="h-3.5 w-3.5 text-[#5EA1FF]" aria-hidden="true" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#77849A]">
                          Voice intent matched
                        </span>
                      </div>
                      <p className="mt-1.5 font-mono text-[11px] text-[#D6E2F5]">
                        “Explain this pull request.”
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-[#39D98A]" aria-hidden="true" />
                        <span className="text-[10px] text-[#39D98A]">Grounded on 5 files</span>
                      </div>
                    </div>

                    <div
                      className="pointer-events-none absolute -bottom-16 -right-6 hidden w-[210px] rounded-xl border border-[#FF294F]/45 bg-[#190A11]/90 p-3.5 shadow-[0_24px_60px_-24px_rgba(255,41,79,0.85)] backdrop-blur-md lg:block"
                      style={{ transform: 'translateZ(52px)' }}
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-[#FF526F]" aria-hidden="true" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FF9AAA]">
                          Review finding
                        </span>
                      </div>
                      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[#FFD9DF]">
                        High severity
                        <br />
                        auth.js:12
                      </p>
                    </div>
                  </TiltCard>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* Voice command marquee */}
        <div className="marquee relative overflow-hidden border-b border-[#263247] bg-[#0A0E16]/70 py-3.5">
          <div className="marquee-track flex w-max items-center">
            {[0, 1].map((loop) => (
              <div
                key={loop}
                className="flex items-center gap-10 pr-10"
                aria-hidden={loop === 1 ? 'true' : undefined}
              >
                <span className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5EA1FF]">
                  <Mic className="h-3 w-3" aria-hidden="true" />
                  Try saying
                </span>
                {VOICE_COMMANDS.map((command) => (
                  <span
                    key={`${loop}-${command}`}
                    className="flex items-center gap-3 whitespace-nowrap font-mono text-xs text-[#A0AEC2]"
                  >
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#FF294F]/70" />
                    {command}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Product Capabilities Section: Asymmetric Layout (No 3 identical cards) */}
        <section id="code-understanding" className="relative mx-auto max-w-7xl px-6 py-24">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5EA1FF]">
                Core Capabilities
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#F1F5FC] sm:text-3xl">
                Built for contextual code comprehension, not copy-paste chat threads.
              </h2>
            </div>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
            {/* Primary Marquee Capability (7 Columns) */}
            <Reveal className="lg:col-span-7" delay={60}>
              <div className="surface-card flex h-full flex-col justify-between overflow-hidden p-7">
                <div>
                  <div className="flex items-center justify-between gap-4 text-xs text-[#77849A]">
                    <span className="font-mono text-[#5EA1FF]">01. Understand Any Project</span>
                    <span className="hidden sm:inline">Bounded Static Parsing · Zero Code Execution</span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-[#F1F5FC]">
                    Explore files, trace logic, and learn how a codebase works.
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#A0AEC2]">
                    Upload individual source files or multi-folder ZIP repositories directly into
                    browser memory. Gitvox maps directory structures, extracts callable functions with
                    exact line ranges, and generates grounded explanations tied to actual source lines.
                  </p>

                  {/* Embedded Authentic Function Trace Excerpt */}
                  <div className="mt-6 rounded-xl border border-[#263247] bg-[#080A0F]/90 p-4 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[#263247] pb-2.5 text-[#77849A]">
                      <span>src/services/tokenService.js</span>
                      <span className="tabular-nums">3 functions extracted</span>
                    </div>
                    <div className="mt-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-[#F1F5FC]">
                        <span className="truncate">issueAccessToken(&#123; sub, role, scopes &#125;)</span>
                        <span className="shrink-0 tabular-nums text-[#5EA1FF]">Lines 6–12</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[#A0AEC2]">
                        <span className="truncate">verifyAccessToken(token)</span>
                        <span className="shrink-0 tabular-nums text-[#77849A]">Lines 13–21</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[#A0AEC2]">
                        <span className="truncate">getTokenTtl()</span>
                        <span className="shrink-0 tabular-nums text-[#77849A]">Lines 23–25</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#263247] pt-4">
                  <span className="text-xs text-[#77849A]">
                    Supports JS, TS, JSX, TSX, Python, Go, Rust, Java, C/C++, JSON, Markdown
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('project')}
                    className="shrink-0 cursor-pointer whitespace-nowrap text-xs font-semibold text-[#5EA1FF] transition-colors hover:text-[#F1F5FC]"
                  >
                    Open Project Workspace →
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Right Asymmetric Stack: Capabilities 02 & 03 (5 Columns) */}
            <div className="flex flex-col justify-between gap-8 lg:col-span-5">
              <Reveal delay={140}>
                <div className="surface-card flex flex-col justify-between p-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-[#5EA1FF]">
                      <GitPullRequest className="h-3.5 w-3.5" aria-hidden="true" />
                      02. Review Code Changes
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-[#F1F5FC]">
                      Inspect actual diffs, understand modifications, and investigate potential issues.
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#A0AEC2]">
                      Compare explicit base and proposed source versions in unified or side-by-side
                      split view. Jump straight from severity-ranked review findings to the exact file
                      and line range, and track per-file review completion.
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-[#263247] pt-3 text-xs">
                    <span className="font-mono tabular-nums text-[#77849A]">
                      Sample PR #284 · 5 files · +86 / -24
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('pr')}
                      className="cursor-pointer font-semibold text-[#5EA1FF] transition-colors hover:text-[#F1F5FC]"
                    >
                      Inspect PR #284 →
                    </button>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={220}>
                <div className="surface-card card-red flex flex-col justify-between p-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono text-[#FF526F]">
                      <AudioWaveform className="h-3.5 w-3.5" aria-hidden="true" />
                      03. Talk to Your Code
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-[#F1F5FC]">
                      Use Alan AI voice interaction when configured, with text input as a fallback.
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#A0AEC2]">
                      Speak or type natural developer commands like{' '}
                      <span className="font-mono text-xs text-[#F1F5FC]">
                        "Show the authentication middleware"
                      </span>{' '}
                      or{' '}
                      <span className="font-mono text-xs text-[#F1F5FC]">
                        "Check these changes for potential bugs"
                      </span>{' '}
                      to navigate files and trigger grounded explanations.
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-[#263247] pt-3 text-xs">
                    <span className="text-[#77849A]">Deterministic Command Router Ready</span>
                    <button
                      type="button"
                      onClick={onOpenVoiceModal}
                      className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-[#5EA1FF] transition-colors hover:text-[#F1F5FC]"
                    >
                      <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Open Command Router →</span>
                    </button>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="relative border-y border-[#263247] bg-[#0A0E16]/40">
          <div className="mx-auto max-w-7xl px-6 py-24">
            <Reveal>
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5EA1FF]">
                    Workflow
                  </p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#F1F5FC] sm:text-3xl">
                    From unfamiliar repository to confident code review in three steps.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('explore')}
                  className="shrink-0 cursor-pointer self-start whitespace-nowrap rounded-lg border border-[#263247] bg-[#0D111A] px-4 py-2 text-xs font-semibold text-[#F1F5FC] transition-all hover:-translate-y-0.5 hover:border-[#397BFF]/60 hover:bg-[#121926] md:self-auto"
                >
                  Go to Upload &amp; Sample Loader
                </button>
              </div>
            </Reveal>

            <div className="relative mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
              <div
                aria-hidden="true"
                className="absolute left-0 right-0 top-0 hidden h-px bg-gradient-to-r from-[#397BFF]/60 via-[#5EA1FF]/40 to-[#FF294F]/50 md:block"
              />

              {[
                {
                  number: '01',
                  tone: 'blue',
                  title: 'Load Source Context',
                  body: (
                    <>
                      Select a supported source file (up to 2 MB), drop a project ZIP archive (up to
                      10 MB extracted text), or launch the built-in{' '}
                      <code className="text-xs text-[#F1F5FC]">acme-platform/api-server</code>{' '}
                      repository with zero setup.
                    </>
                  ),
                  action: 'Choose Input Source',
                  route: 'explore' as RouteId,
                },
                {
                  number: '02',
                  tone: 'blue',
                  title: 'Navigate & Query',
                  body: (
                    <>
                      Search the file tree, inspect syntax-highlighted code with line numbers, click
                      individual function signatures, and ask contextual questions grounded in the
                      loaded files.
                    </>
                  ),
                  action: 'Explore Sample Project',
                  route: 'project' as RouteId,
                },
                {
                  number: '03',
                  tone: 'red',
                  title: 'Inspect Diffs & Findings',
                  body: (
                    <>
                      Step through unified or split diffs, explain individual change hunks, navigate
                      illustrative security and logic findings by line reference, and mark files
                      reviewed.
                    </>
                  ),
                  action: 'Review Sample PR #284',
                  route: 'pr' as RouteId,
                },
              ].map((step, index) => (
                <Reveal key={step.number} delay={index * 110}>
                  <div className="group relative h-full pt-6">
                    <span
                      aria-hidden="true"
                      className="font-display pointer-events-none absolute -top-6 right-0 select-none text-7xl text-[#F1F5FC]/[0.045] transition-colors duration-500 group-hover:text-[#5EA1FF]/[0.09]"
                    >
                      {step.number}
                    </span>
                    <div
                      className={`flex items-center gap-2 font-mono text-xs ${
                        step.tone === 'red' ? 'text-[#FF526F]' : 'text-[#5EA1FF]'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {step.number}.
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-[#F1F5FC]">{step.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[#A0AEC2]">{step.body}</p>
                    <button
                      type="button"
                      onClick={() => onNavigate(step.route)}
                      className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#5EA1FF] transition-all hover:gap-2.5 hover:text-[#F1F5FC]"
                    >
                      {step.action}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Immersive Voice-Core Section */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#397BFF]/[0.09] blur-[120px]" />
          </div>

          <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 py-24 lg:grid-cols-12">
            <Reveal className="lg:col-span-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF526F]">
                  One interface
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#F1F5FC] sm:text-3xl">
                  One voice. Every layer of your codebase.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-[#A0AEC2]">
                  Speak a question and Gitvox grounds the answer in the files, diffs, and findings you
                  loaded — no copy-paste, no context switching, no guesswork.
                </p>

                <ul className="mt-8 space-y-5">
                  {[
                    {
                      icon: ScanSearch,
                      title: 'Grounded in exact lines',
                      copy: 'Explanations reference real file paths, function ranges, and changed hunks.',
                    },
                    {
                      icon: GitBranch,
                      title: 'Deterministic routing',
                      copy: 'Recognized intents navigate straight to the right file, diff, or review context.',
                    },
                    {
                      icon: ShieldCheck,
                      title: 'Zero code execution',
                      copy: 'Static parsing inside browser memory. Uploaded code is never run.',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.title} className="flex items-start gap-4">
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#263247] bg-[#0D111A]">
                          <Icon className="h-4 w-4 text-[#5EA1FF]" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-[#F1F5FC]">{item.title}</h3>
                          <p className="mt-1 text-sm leading-relaxed text-[#A0AEC2]">{item.copy}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>

            <Reveal className="lg:col-span-6" delay={120}>
              <div className="relative">
                <VoiceCore />
                <p className="mt-10 text-center font-mono text-[11px] text-[#77849A]">
                  Voice question → routed intent → file, diff &amp; finding evidence
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Product Demonstration Section: Interactive Entry Point to Sample PR #284 */}
        <section id="pull-request-review" className="mx-auto max-w-7xl px-6 pb-24">
          <Reveal>
            <div className="surface-card overflow-hidden p-7 sm:p-9">
              <div className="flex flex-col justify-between gap-6 border-b border-[#263247] pb-7 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#77849A]">
                    <span className="font-medium text-[#5EA1FF]">Interactive Demonstration</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{SAMPLE_PULL_REQUEST.repository}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">PR #{SAMPLE_PULL_REQUEST.number}</span>
                    <span aria-hidden="true">·</span>
                    <span>{SAMPLE_PULL_REQUEST.ciStatus}</span>
                  </div>

                  <h2 className="mt-2 text-xl font-bold text-[#F1F5FC] sm:text-2xl">
                    {SAMPLE_PULL_REQUEST.title}
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm text-[#A0AEC2]">
                    Authored by <span className="text-[#F1F5FC]">{SAMPLE_PULL_REQUEST.author}</span>{' '}
                    merging{' '}
                    <code className="text-xs text-[#5EA1FF]">{SAMPLE_PULL_REQUEST.sourceBranch}</code>{' '}
                    into{' '}
                    <code className="text-xs text-[#F1F5FC]">{SAMPLE_PULL_REQUEST.targetBranch}</code>.
                    Inspect any of the {SAMPLE_PULL_REQUEST.filesChangedCount} changed files below to
                    open its live diff and review findings.
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('pr')}
                    className="btn-primary inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#397BFF] px-5 py-2.5 text-xs font-semibold text-[#F1F5FC] shadow-[0_16px_40px_-18px_rgba(57,123,255,0.95)] ring-1 ring-inset ring-white/15 transition-all hover:-translate-y-0.5 hover:bg-[#5EA1FF]"
                  >
                    <GitPullRequest className="h-4 w-4" aria-hidden="true" />
                    <span>Open Full PR Review Workspace</span>
                  </button>
                </div>
              </div>

              {/* 5 Changed Files Interactive Table */}
              <div className="mt-6">
                <div className="flex items-center justify-between pb-3 text-xs text-[#77849A]">
                  <span>
                    Changed Files in Sample PR #{SAMPLE_PULL_REQUEST.number} (Click any file to review
                    diff)
                  </span>
                  <span className="font-mono tabular-nums">
                    {SAMPLE_PULL_REQUEST.filesChangedCount} files ·{' '}
                    <span className="text-[#39D98A]">+{SAMPLE_PULL_REQUEST.additionsCount}</span> /{' '}
                    <span className="text-[#FF526F]">-{SAMPLE_PULL_REQUEST.deletionsCount}</span>
                  </span>
                </div>

                <div className="divide-y divide-[#263247] overflow-hidden rounded-xl border border-[#263247] bg-[#080A0F]/90">
                  {SAMPLE_PULL_REQUEST.files.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => onNavigate('pr', file.path)}
                      className="group flex w-full cursor-pointer flex-col justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#121926] sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs font-medium text-[#F1F5FC]">
                          {file.path}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[#A0AEC2]">{file.summary}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 font-mono text-xs tabular-nums">
                        <span className="text-[#39D98A]">+{file.expectedAdditions}</span>
                        <span className="text-[#FF526F]">-{file.expectedDeletions}</span>
                        <span className="inline-flex items-center gap-1 font-sans font-medium text-[#5EA1FF]">
                          Inspect Diff
                          <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-7xl px-6 pb-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-[#397BFF]/35 bg-gradient-to-br from-[#0B1526] via-[#0D111A] to-[#180A10] px-7 py-14 text-center sm:px-12">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[#397BFF]/25 blur-[100px]" />
                <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[#FF294F]/15 blur-[100px]" />
                <div className="grid-lines-fade absolute inset-0 opacity-40" />
              </div>

              <div className="relative">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#5EA1FF]">
                  Your code · Your voice · Your clarity
                </p>
                <h2 className="font-display mx-auto mt-4 max-w-3xl text-3xl text-[#F1F5FC] sm:text-5xl">
                  Bring your voice to the codebase.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#A0AEC2]">
                  Start with the built-in sample project, or load your own files and ZIP archives —
                  everything stays in browser memory.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('explore')}
                    className="btn-primary group inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#397BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_-18px_rgba(57,123,255,0.95)] ring-1 ring-inset ring-white/15 transition-all hover:-translate-y-0.5 hover:bg-[#5EA1FF]"
                  >
                    Start Exploring
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('project')}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#263247] bg-[#0D111A]/80 px-5 py-3 text-sm font-medium text-[#F1F5FC] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[#397BFF]/60"
                  >
                    <FolderGit2 className="h-4 w-4 text-[#5EA1FF]" aria-hidden="true" />
                    Open Sample Workspace
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="relative border-t border-[#263247] bg-[#0A0E16]/70 px-6 py-12">
        <div className="divider-glow absolute inset-x-0 top-0" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <GitvoxWordmark onClick={() => onNavigate('home')} />
            <p className="mt-3 max-w-md text-xs leading-relaxed text-[#A0AEC2]">
              Your code. Your voice. Your clarity. Open-source voice-first AI code-understanding and
              pull-request review platform.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#A0AEC2]">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="cursor-pointer transition-colors hover:text-[#F1F5FC]"
            >
              Start Exploring
            </button>
            <button
              type="button"
              onClick={() => onNavigate('project')}
              className="inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-[#F1F5FC]"
            >
              <FolderGit2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Project Workspace</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pr')}
              className="inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-[#F1F5FC]"
            >
              <GitPullRequest className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sample PR #284</span>
            </button>
            <button
              type="button"
              onClick={onOpenVoiceModal}
              className="inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-[#F1F5FC]"
            >
              <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Command Router</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
