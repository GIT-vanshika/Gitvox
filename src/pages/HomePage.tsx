import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileCode,
  FolderOpen,
  GitPullRequest,
  MessageSquare,
  Mic,
  ShieldCheck,
} from 'lucide-react';
import { GitvoxWordmark } from '../components/common/GitvoxBrand';
import { Reveal } from '../components/common/Reveal';
import { AcousticSphere3D } from '../components/AcousticSphere3D';
import { SAMPLE_PULL_REQUEST } from '../data/samplePullRequest';
import { SAMPLE_FINDINGS } from '../data/sampleFindings';
import { computeFileDiff } from '../services/diffService';
import { renderHighlightedLine } from '../utils/syntaxHighlight';
import { RouteId } from '../types/gitvox';

interface HomePageProps {
  onNavigate: (route: RouteId, targetFilePath?: string) => void;
}

const FEATURES = [
  {
    icon: FolderOpen,
    title: 'Understand an unfamiliar codebase',
    body: 'Load a file or ZIP archive, browse the tree, and get grounded explanations of files, functions, and architecture.',
  },
  {
    icon: GitPullRequest,
    title: 'Review a pull request with context',
    body: 'Inspect line-by-line diffs in unified or split view, jump to findings, and track files as you review.',
  },
  {
    icon: MessageSquare,
    title: 'Ask by voice, read the answer',
    body: 'One microphone. Speak naturally. Gitvox resolves the right code context and returns a detailed answer in a dismissible panel.',
  },
];

const WORKFLOW = [
  {
    number: '01',
    title: 'Load your context',
    body: 'Open the sample project or upload source files and a ZIP archive. Everything is parsed in memory.',
  },
  {
    number: '02',
    title: 'Speak your question',
    body: 'Ask to explain the PR, summarize changes, walk through a file, or explain a line range.',
  },
  {
    number: '03',
    title: 'Read the grounded answer',
    body: 'The assistant uses the actual diff or source file and returns an answer with references and risks.',
  },
];

const SEVERITY_CLASS = {
  high: 'sev-high',
  medium: 'sev-medium',
  low: 'sev-low',
} as const;

const SAMPLE_STEPS = [
  {
    number: '01',
    title: 'Open the sample project',
    description: 'Browse the seven-file Express API and its authentication flow.',
    icon: FolderOpen,
    detail:
      'Load acme-platform/api-server with zero setup, then move between middleware, services, routes, and tests.',
  },
  {
    number: '02',
    title: 'Ask Gitvox a question',
    description: 'Speak or type a request about the PR, a file, or a line range.',
    icon: Mic,
    detail:
      'The assistant resolves the current file or diff, sends the real context to the model, and returns a grounded answer.',
  },
  {
    number: '03',
    title: 'Review the evidence',
    description: 'Inspect the diff and findings without losing the code in the process.',
    icon: GitPullRequest,
    detail:
      'Use unified or split diffs, jump to a finding, and mark files reviewed as you work through the pull request.',
  },
] as const;

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [activeSampleStep, setActiveSampleStep] = useState(0);
  const previewFile = SAMPLE_PULL_REQUEST.files[0];
  const previewDiff = computeFileDiff(
    previewFile.baseContent,
    previewFile.proposedContent,
    previewFile.path
  );
  const previewLines = previewDiff.unifiedLines.slice(2, 16);
  const findings = SAMPLE_FINDINGS.slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="app-header">
        <div className="shell app-header__inner justify-between">
          <div className="flex min-w-0 items-center gap-6">
            <GitvoxWordmark onClick={() => onNavigate('home')} />

            <nav
              aria-label="Primary navigation"
              className="hidden items-center gap-1 text-[13px] font-medium text-body md:flex"
            >
              <a
                href="#product"
                className="rounded px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-accent"
              >
                Overview
              </a>
              <button
                type="button"
                onClick={() => onNavigate('project')}
                className="rounded px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-accent cursor-pointer"
              >
                Live Workspace
              </button>
              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="rounded px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-accent cursor-pointer"
              >
                Upload Source
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pr')}
                className="rounded px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-accent cursor-pointer"
              >
                PR #284 Review
              </button>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="btn btn-ghost btn-sm hidden sm:inline-flex"
            >
              Upload Code
            </button>
            <button
              type="button"
              onClick={() => onNavigate('project')}
              className="btn btn-secondary btn-sm"
            >
              <FolderOpen className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>Sample Project</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Top Telemetry Ribbon */}
        <div className="w-full bg-[#06070b] border-b border-[#1a1f30]/60 px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_#f59e0b]" />
              <span className="text-accent font-medium">Local Voice Matrix Active</span>
            </div>
            <span className="hidden md:inline text-faint">• Sub-20ms Audio Pipeline</span>
            <span className="hidden lg:inline text-secondary">• Client-Side Sandboxing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#131724] text-body border border-[#242a40]">
              In-Browser Isolation
            </span>
            <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-semibold border border-accent/20">
              100% Privacy Preserved
            </span>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative w-full px-4 sm:px-8 py-10 lg:py-16 overflow-hidden border-b border-line">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-accent/10 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute top-1/4 -right-32 w-[32rem] h-[32rem] bg-secondary/15 rounded-full blur-[160px] pointer-events-none" />

          <div className="max-w-7xl mx-auto flex flex-col gap-8 relative z-10">
            {/* Status Tag */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1f30] border border-accent/20">
                <Mic className="h-3.5 w-3.5 text-accent" />
                <span className="font-mono text-[11px] uppercase text-accent tracking-wider font-semibold">
                  Conversational Dev Environment
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-faint">
                <span>Streaming latency</span>
                <span className="text-accent font-semibold">~14ms</span>
              </div>
            </div>

            {/* Main Headline */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
              <div className="lg:col-span-8 flex flex-col gap-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink font-['Plus_Jakarta_Sans',sans-serif]">
                  Talk to your codebase.
                  <span className="block bg-gradient-to-r from-[#f59e0b] via-amber-300 to-[#8b5cf6] bg-clip-text text-transparent">
                    Navigate and code hands-free.
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-body max-w-2xl leading-relaxed">
                  Query your project structure, inspect code branches, diagnose bugs, and explore edits using natural voice commands in real time.
                </p>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-2 bg-[#0d101a] p-5 rounded-xl border border-secondary/20 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-secondary uppercase font-semibold">Zero Remote Storage</span>
                  <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-mono text-[10px] border border-accent/20">Local AST</span>
                </div>
                <p className="text-xs text-body leading-relaxed">
                  Code analysis executes strictly within your local browser sandbox. Your proprietary source files never touch external servers.
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('project')}
                className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-accent text-[#1f1300] text-sm font-semibold shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all hover:bg-accent-hover hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Open Sample Project</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#1a1f30] hover:bg-[#242a40] text-ink text-sm font-medium border border-[#242a40] transition-all hover:border-secondary/40 cursor-pointer"
              >
                <FileCode className="h-4 w-4 text-secondary" />
                <span>Upload Code (ZIP / Git)</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('pr')}
                className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#0d101a] hover:bg-[#131724] text-accent font-mono text-[11px] uppercase tracking-wider border border-accent/30 transition-all cursor-pointer"
              >
                <GitPullRequest className="h-3.5 w-3.5 text-accent" />
                <span>PR #284 Review</span>
              </button>
            </div>

            {/* Hero Visual: Acoustic Voice Matrix 3D Scene (7 cols) + Voice Telemetry HUD (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch mt-2">
              {/* 3D Scene Container */}
              <div className="lg:col-span-7 relative flex flex-col justify-between rounded-2xl bg-[#06070b] border border-accent/20 shadow-2xl overflow-hidden min-h-[440px] p-5">
                <div className="flex items-center justify-between z-20">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0d101a]/90 backdrop-blur-md border border-accent/30">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_#f59e0b]" />
                    <span className="font-mono text-[11px] text-ink uppercase tracking-wider">Acoustic Matrix // Voice Orb</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-secondary/15 text-secondary font-mono text-[10px] border border-secondary/30">
                    3D Equalizer Active
                  </span>
                </div>

                {/* Live Three.js Acoustic Waveform Canvas */}
                <AcousticSphere3D />

                {/* Bottom Telemetry inside 3D canvas */}
                <div className="relative z-20 flex items-center justify-between text-faint font-mono text-[10px] border-t border-[#1a1f30]/60 pt-3 bg-gradient-to-t from-[#06070b]/80 to-transparent">
                  <span className="text-accent font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    Golden Orbital Harmonic
                  </span>
                  <span className="text-secondary font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Violet Waveform Sphere
                  </span>
                </div>
              </div>

              {/* Voice Telemetry HUD */}
              <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-[#0d101a] border border-[#1a1f30]/70 p-5 sm:p-6 shadow-xl relative">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#1a1f30]/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
                      <span className="font-mono text-[11px] text-ink uppercase font-bold tracking-wider">Voice Telemetry</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-mono text-[10px] border border-accent/20">Ready</span>
                  </div>

                  {/* Audio Waveform Equalizer Display */}
                  <div className="my-4 p-4 rounded-xl bg-[#06070b] border border-[#1a1f30]/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between font-mono text-[10px] text-faint">
                      <span className="flex items-center gap-1.5 text-ink">
                        <Mic className="h-3.5 w-3.5 text-accent" />
                        Microphone Input
                      </span>
                      <span className="text-secondary font-semibold">Optimal dB</span>
                    </div>
                    <div className="h-10 w-full flex items-center justify-between gap-1.5 px-2">
                      <span className="w-1.5 bg-accent/70 rounded-full h-3" />
                      <span className="w-1.5 bg-accent rounded-full h-6 animate-pulse" />
                      <span className="w-1.5 bg-secondary rounded-full h-9 animate-pulse" style={{ animationDelay: '100ms' }} />
                      <span className="w-1.5 bg-[var(--accent-pink)] rounded-full h-7 animate-pulse" style={{ animationDelay: '200ms' }} />
                      <span className="w-1.5 bg-accent rounded-full h-10 animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 bg-secondary rounded-full h-5 animate-pulse" style={{ animationDelay: '80ms' }} />
                      <span className="w-1.5 bg-accent rounded-full h-8 animate-pulse" style={{ animationDelay: '250ms' }} />
                      <span className="w-1.5 bg-secondary/80 rounded-full h-4 animate-pulse" />
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#1a1f30]/50 mt-1 border border-[#242a40]/40">
                      <span className="font-mono text-[10px] text-accent uppercase block mb-1 font-semibold">Spoken Query Sample</span>
                      <p className="font-mono text-[12px] text-ink leading-relaxed">
                        “Show the authentication flow in auth.js and check environment variables”
                      </p>
                    </div>
                  </div>
                </div>

                {/* Grounding Feedback Card */}
                <div className="p-4 rounded-xl bg-[#131724] border border-[#1a1f30]/70 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-accent uppercase font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                      Code Grounded
                    </span>
                    <span className="text-faint font-mono text-[10px]">src/auth.js:L9</span>
                  </div>
                  <p className="text-xs text-body">
                    Matched target file and highlighted the JWT fallback token condition.
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-[#1a1f30]/40">
                    <span className="font-mono text-[10px] text-secondary">Tap floating mic to speak</span>
                    <button
                      type="button"
                      onClick={() => onNavigate('project')}
                      className="px-3 py-1 rounded bg-accent/20 hover:bg-accent text-accent hover:text-[#1f1300] font-mono text-[10px] font-semibold transition-all border border-accent/30 cursor-pointer"
                    >
                      Inspect Code
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="border-b border-line">
          <div className="shell py-12 sm:py-14">
            <Reveal className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="border-t border-line-strong pt-4">
                  <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h2 className="mt-3 text-[15px] font-semibold text-ink">{title}</h2>
                  <p className="mt-2 text-[13px] leading-6 text-body">{body}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section id="workflow" className="border-b border-line bg-soft">
          <div className="shell py-12 sm:py-14">
            <Reveal>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="eyebrow">Workflow</p>
                  <h2 className="h2 mt-2">From unfamiliar repository to confident review.</h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('explore')}
                  className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-accent hover:underline sm:self-auto"
                >
                  Load a project
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
                {WORKFLOW.map((step) => (
                  <div key={step.number} className="border-t border-line-strong pt-4">
                    <span className="font-mono text-[11px] text-accent">{step.number}</span>
                    <h3 className="mt-2 text-sm font-semibold text-ink">{step.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-body">{step.body}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="sample-project" className="border-b border-line">
          <div className="shell py-12 sm:py-14">
            <Reveal>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="eyebrow">Sample project</p>
                  <h2 className="h2 mt-2">Explore a real pull request end to end.</h2>
                  <p className="mt-2 max-w-xl text-[13px] leading-6 text-body">
                    Follow the same three-step workflow the product is built around. Select a step
                    to see what happens.
                  </p>
                </div>
                <span className="font-mono text-[11px] text-faint">PR #284 · +86 / −24</span>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
                {SAMPLE_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const active = activeSampleStep === index;
                  return (
                    <button
                      key={step.number}
                      type="button"
                      onClick={() => setActiveSampleStep(index)}
                      aria-pressed={active}
                      className={`min-w-0 rounded-lg border p-4 text-left transition-all duration-150 cursor-pointer ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_2px_12px_rgba(183,255,60,0.15)]'
                          : 'border-line bg-[var(--bg-subtle)] hover:border-line-strong hover:bg-[var(--bg-muted)] hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(0,0,0,0.4)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-faint">{step.number}</span>
                        <Icon
                          className={`h-4 w-4 ${active ? 'text-accent' : 'text-faint'}`}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="mt-3 block text-[13px] font-semibold text-ink">
                        {step.title}
                      </span>
                      <span className="mt-1 block text-[12px] leading-5 text-body">
                        {step.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="card mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-12">
                  <div className="min-w-0 border-b border-line p-5 lg:col-span-5 lg:border-b-0 lg:border-r">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                      Step {SAMPLE_STEPS[activeSampleStep].number}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-ink">
                      {SAMPLE_STEPS[activeSampleStep].title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-6 text-body">
                      {SAMPLE_STEPS[activeSampleStep].detail}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate('project')}
                        className="btn btn-primary btn-sm"
                      >
                        Open sample project
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('pr')}
                        className="btn btn-secondary btn-sm"
                      >
                        Open PR #284
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 p-5 lg:col-span-7">
                    {activeSampleStep === 0 && (
                      <div className="space-y-2">
                        {SAMPLE_PULL_REQUEST.files.slice(0, 4).map((file) => (
                          <div
                            key={file.path}
                            className="flex items-center justify-between gap-3 rounded-md border border-line bg-soft px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <FileCode
                                className="h-3.5 w-3.5 shrink-0 text-faint"
                                aria-hidden="true"
                              />
                              <span className="truncate font-mono text-[11px] text-body">
                                {file.path}
                              </span>
                            </div>
                            <span className="shrink-0 font-mono text-[10px] text-faint">
                              +{file.expectedAdditions} / −{file.expectedDeletions}
                            </span>
                          </div>
                        ))}
                        <p className="pt-1 text-[11px] text-faint">
                          7 source files · parsed in memory · no setup
                        </p>
                      </div>
                    )}

                    {activeSampleStep === 1 && (
                      <div className="space-y-3">
                        <div className="ml-auto max-w-[88%] rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3 text-xs">
                          <div className="flex items-center gap-1.5 font-medium text-accent">
                            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                            Ask Gitvox
                          </div>
                          <p className="mt-1 text-ink">"Explain lines 5 to 27."</p>
                        </div>
                        <div className="max-w-[94%] rounded-lg border border-line bg-soft p-3 text-xs">
                          <div className="font-mono text-[10px] uppercase tracking-wide text-faint">
                            src/middleware/auth.js · L5–L27
                          </div>
                          <p className="mt-1.5 leading-5 text-body">
                            The middleware extracts a Bearer token, verifies its signature and
                            expiry, then attaches the decoded user and scopes to the request.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="chip">token verification</span>
                            <span className="chip">HMAC-SHA256</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeSampleStep === 2 && (
                      <div className="space-y-3">
                        <div className="overflow-hidden rounded-md border border-line font-mono text-[11px] leading-6">
                          <div className="bg-[var(--diff-add-bg)] px-3 py-1 text-[var(--diff-add-line)]">
                            + import {'{'} verifyAccessToken {'}'} from '../services/tokenService.js';
                          </div>
                          <div className="bg-[var(--diff-del-bg)] px-3 py-1 text-[var(--diff-del-line)]">
                            − const legacyKey = req.headers['x-api-key'];
                          </div>
                          <div className="bg-[var(--diff-add-bg)] px-3 py-1 text-[var(--diff-add-line)]">
                            + const token = extractBearerToken(req.headers.authorization);
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className="sev-high inline-flex items-center gap-1 rounded px-2 py-1">
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                            High · signing secret
                          </span>
                          <span className="sev-medium inline-flex items-center gap-1 rounded px-2 py-1">
                            Medium · timing comparison
                          </span>
                          <span className="sev-low inline-flex items-center gap-1 rounded px-2 py-1">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            0 / 5 reviewed
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-b border-line bg-soft">
          <div className="shell py-12 sm:py-14">
            <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-5">
                <p className="eyebrow">Review with evidence</p>
                <h2 className="h2 mt-2">A review workspace built around the code.</h2>
                <p className="mt-3 text-[13px] leading-6 text-body">
                  The diff stays central. Findings are specific, uncertainty is labeled, and every
                  explanation can be traced back to the changed lines.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={() => onNavigate('pr')} className="btn btn-primary">
                    <GitPullRequest className="h-3.5 w-3.5" aria-hidden="true" />
                    Open PR #284
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('explore')}
                    className="btn btn-secondary"
                  >
                    Upload code
                  </button>
                </div>
              </div>

              <div className="min-w-0 lg:col-span-7">
                <div className="card">
                  <div className="panel-head">
                    <span className="text-xs font-medium text-ink">Illustrative review findings</span>
                    <span className="font-mono text-[10px] text-faint">PR #284</span>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {findings.map((finding) => (
                      <div key={finding.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_CLASS[finding.severity]}`}
                          >
                            {finding.severity}
                          </span>
                          <span className="font-mono text-[10px] text-faint">
                            {finding.filePath.split('/').pop()}:L{finding.startLine}
                          </span>
                        </div>
                        <h3 className="mt-2 text-[13px] font-semibold text-ink">{finding.title}</h3>
                        <p className="mt-1 text-[12px] leading-5 text-body">{finding.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="bg-page">
        <div className="shell flex flex-col gap-4 pb-24 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <GitvoxWordmark onClick={() => onNavigate('home')} />
          <p className="text-xs text-faint">Your code. Your voice. Your clarity.</p>
          <div className="flex items-center gap-5 text-xs text-body">
            <button
              type="button"
              onClick={() => onNavigate('project')}
              className="hover:text-ink cursor-pointer"
            >
              Project
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pr')}
              className="hover:text-ink cursor-pointer"
            >
              Pull request
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
