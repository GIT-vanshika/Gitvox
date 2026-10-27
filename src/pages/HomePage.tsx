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
                className="rounded px-2 py-1.5 transition-colors hover:bg-muted hover:text-ink"
              >
                Product
              </a>
              <a
                href="#workflow"
                className="rounded px-2 py-1.5 transition-colors hover:bg-muted hover:text-ink"
              >
                Workflow
              </a>
              <a
                href="#sample-project"
                className="rounded px-2 py-1.5 transition-colors hover:bg-muted hover:text-ink"
              >
                Sample project
              </a>
              <button
                type="button"
                onClick={() => onNavigate('pr')}
                className="rounded px-2 py-1.5 transition-colors hover:bg-muted hover:text-ink cursor-pointer"
              >
                Sample PR
              </button>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="btn btn-ghost btn-sm hidden sm:inline-flex"
            >
              Upload code
            </button>
            <button type="button" onClick={() => onNavigate('pr')} className="btn btn-secondary btn-sm">
              <span className="hidden sm:inline">Open PR #284</span>
              <span className="sm:hidden">PR #284</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: text column and code preview are separate grid regions. */}
        <section className="border-b border-line">
          <div className="shell grid grid-cols-1 gap-10 py-12 lg:grid-cols-2 lg:items-start lg:gap-12 lg:py-16">
            <div className="min-w-0">
              <p className="eyebrow">Voice-first code intelligence</p>
              <h1 className="display mt-3 max-w-[19ch]">
                Understand code. Review smarter. Speak naturally.
              </h1>
              <p className="mt-5 max-w-[54ch] text-[15px] leading-7 text-body">
                Gitvox is a voice-first AI assistant for understanding codebases and reviewing pull
                requests. Ask a question and get an explanation grounded in the actual code and
                diff.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('project')}
                  className="btn btn-primary"
                >
                  Explore the sample project
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => onNavigate('pr')} className="btn btn-secondary">
                  Review PR #284
                </button>
              </div>

              <p className="mt-5 inline-flex items-center gap-2 text-[13px] text-body">
                <Mic className="h-4 w-4 text-accent" aria-hidden="true" />
                Or use the microphone in the bottom-right corner to ask by voice.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-xs">
                <span className="font-medium text-ink">Built-in sample ready</span>
                <span className="text-faint" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-body">acme-platform/api-server</span>
                <span className="text-faint" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-body">PR #284 · 5 files · +86 / −24</span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="code-panel">
                <div className="panel-head">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileCode className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span className="truncate font-mono text-xs text-body">{previewFile.path}</span>
                  </div>
                  <span className="chip">Unified diff</span>
                </div>

                <div className="code-scroll max-h-[340px] bg-page py-2">
                  {previewLines.map((line, index) => {
                    const tone =
                      line.type === 'added'
                        ? 'diff-row diff-row--add'
                        : line.type === 'deleted'
                        ? 'diff-row diff-row--del'
                        : 'diff-row';
                    const prefix =
                      line.type === 'added' ? '+' : line.type === 'deleted' ? '−' : ' ';
                    const markerTone =
                      line.type === 'added'
                        ? ''
                        : line.type === 'deleted'
                        ? ''
                        : 'diff-marker--neutral';

                    return (
                      <div
                        key={`${index}-${line.oldLineNumber}-${line.newLineNumber}`}
                        className={`${tone} py-[1px]`}
                      >
                        <span className="code-gutter w-8">{line.oldLineNumber ?? ''}</span>
                        <span className="code-gutter w-8">{line.newLineNumber ?? ''}</span>
                        <span className={`diff-marker ${markerTone}`}>{prefix}</span>
                        <span className="code-source">
                          {renderHighlightedLine(line.content, previewFile.language)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-soft px-4 py-2.5">
                  <span className="text-[11px] text-faint">
                    Grounded in the real base and proposed files.
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('pr')}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                  >
                    Open review
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
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
                      className={`min-w-0 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                          : 'border-line bg-page hover:border-line-strong hover:bg-soft'
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
