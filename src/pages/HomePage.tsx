import React, { useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  FileCode,
  GitPullRequest,
  Mic,
  FolderGit2,
  Terminal,
} from 'lucide-react';
import { GitvoxWordmark } from '../components/common/GitvoxBrand';
import { SAMPLE_PULL_REQUEST } from '../data/samplePullRequest';
import { SAMPLE_FINDINGS } from '../data/sampleFindings';
import { computeFileDiff } from '../services/diffService';
import { renderHighlightedLine } from '../utils/syntaxHighlight';
import { RouteId } from '../types/gitvox';

interface HomePageProps {
  onNavigate: (route: RouteId, targetFilePath?: string) => void;
  onOpenVoiceModal: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onOpenVoiceModal }) => {
  const [heroPreviewTab, setHeroPreviewTab] = useState<'diff' | 'explanation'>('diff');

  const previewFile = SAMPLE_PULL_REQUEST.files[0]; // src/middleware/auth.js
  const previewDiff = computeFileDiff(
    previewFile.baseContent,
    previewFile.proposedContent,
    previewFile.path
  );
  const previewLines = previewDiff.unifiedLines.slice(0, 14);
  const topFinding = SAMPLE_FINDINGS[0];

  return (
    <div className="min-h-screen bg-[#080A0F] text-[#F1F5FC] flex flex-col">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4 single-line nav links) — Zone 3 (1 primary CTA) */}
      <header className="sticky top-0 z-30 bg-[#080A0F]/95 border-b border-[#263247] px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <GitvoxWordmark onClick={() => onNavigate('home')} />

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A0AEC2]"
          >
            <a
              href="#how-it-works"
              className="hover:text-[#F1F5FC] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#code-understanding"
              className="hover:text-[#F1F5FC] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Code Understanding
            </a>
            <a
              href="#pull-request-review"
              className="hover:text-[#F1F5FC] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Pull Request Review
            </a>
            <button
              type="button"
              onClick={() => onNavigate('project')}
              className="hover:text-[#F1F5FC] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sample Workspace
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="px-4 py-2 text-xs font-semibold text-[#F1F5FC] bg-[#397BFF] hover:bg-[#5EA1FF] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Start Exploring
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section: Editorial, Asymmetric 2-Column Split */}
        <section className="max-w-7xl mx-auto px-6 pt-14 pb-20 border-b border-[#263247]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* Left Column: Editorial Value Proposition (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between py-2">
              <div>
                <p className="text-xs font-medium text-[#5EA1FF] tracking-wide">
                  Your code. Your voice. Your clarity.
                </p>

                <h1
                  className="mt-4 font-bold tracking-tight text-[#F1F5FC] leading-[1.12]"
                  style={{
                    fontSize: 'clamp(2.25rem, 3.8vw, 3.5rem)',
                    textWrap: 'balance',
                  }}
                >
                  Understand code. Review smarter. Speak naturally.
                </h1>

                <p className="mt-5 text-base text-[#A0AEC2] leading-relaxed max-w-xl">
                  Explore unfamiliar projects, understand code changes, and investigate potential
                  bugs through conversational AI.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('explore')}
                    className="px-5 py-2.5 text-sm font-semibold bg-[#397BFF] hover:bg-[#5EA1FF] text-[#F1F5FC] rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Start Exploring Code</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('pr')}
                    className="px-5 py-2.5 text-sm font-medium bg-[#121926] hover:bg-[#192234] text-[#F1F5FC] border border-[#263247] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Try Sample Pull Request
                  </button>
                </div>
              </div>

              {/* Unboxed Metadata Summary (Zero-Pill Discipline) */}
              <div className="mt-10 pt-6 border-t border-[#263247] text-xs text-[#77849A] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[#A0AEC2] font-medium">Built-in Sample Ready</span>
                <span aria-hidden="true">·</span>
                <span>acme-platform/api-server</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">PR #284 (+86 / -24)</span>
                <span aria-hidden="true">·</span>
                <span>Alan AI Voice + Text Router</span>
              </div>
            </div>

            {/* Right Column: Genuine Miniature Gitvox Workspace Preview (7 cols) */}
            <div className="lg:col-span-7 flex flex-col bg-[#0D111A] border border-[#263247] rounded-lg overflow-hidden">
              {/* Workspace Preview Header */}
              <div className="px-4 py-3 bg-[#121926] border-b border-[#263247] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-mono text-[#F1F5FC] min-w-0">
                  <FileCode className="w-4 h-4 text-[#397BFF] shrink-0" aria-hidden="true" />
                  <span className="truncate">{previewFile.path}</span>
                  <span className="text-[#77849A]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-[#39D98A] tabular-nums">+{previewDiff.additions}</span>
                  <span className="text-[#FF526F] tabular-nums">-{previewDiff.deletions}</span>
                </div>

                {/* Interactive Segmented Control */}
                <div className="flex items-center gap-1 p-0.5 bg-[#080A0F] border border-[#263247] rounded-md">
                  <button
                    type="button"
                    onClick={() => setHeroPreviewTab('diff')}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
                        className={`px-4 py-0.5 flex items-baseline gap-3 ${bgClass}`}
                      >
                        <span className="w-6 text-right text-[11px] text-[#77849A] select-none tabular-nums shrink-0">
                          {line.oldLineNumber ?? ''}
                        </span>
                        <span className="w-6 text-right text-[11px] text-[#77849A] select-none tabular-nums shrink-0">
                          {line.newLineNumber ?? ''}
                        </span>
                        <span
                          className={`w-3 select-none shrink-0 font-bold ${
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
                <div className="flex-1 p-5 flex flex-col justify-between bg-[#080A0F]">
                  <div>
                    <div className="text-xs text-[#77849A] font-mono">
                      Grounded Explanation · src/middleware/auth.js (Lines 5–24)
                    </div>
                    <h2 className="text-sm font-semibold text-[#F1F5FC] mt-1.5">
                      Bearer Token Extraction & Expiration Guard
                    </h2>
                    <p className="text-xs text-[#A0AEC2] mt-2 leading-relaxed">
                      Replaces the static <code className="text-[#F1F5FC]">x-api-key</code> header
                      comparison with <code className="text-[#5EA1FF]">extractBearerToken()</code>{' '}
                      and <code className="text-[#5EA1FF]">verifyAccessToken()</code>. Verifies{' '}
                      <code className="text-[#F1F5FC]">payload.exp</code> against current epoch
                      milliseconds and populates scoped permissions on{' '}
                      <code className="text-[#F1F5FC]">req.user</code>.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#263247] flex items-center justify-between text-xs text-[#77849A]">
                    <span>Confidence: Verified against base & proposed source</span>
                    <button
                      type="button"
                      onClick={() => onNavigate('project', 'src/middleware/auth.js')}
                      className="text-[#5EA1FF] hover:underline cursor-pointer"
                    >
                      Inspect in Workspace →
                    </button>
                  </div>
                </div>
              )}

              {/* Selective Neon-Red Brand Accent: Contextual Review Finding Strip */}
              <div className="px-4 py-3 bg-[#121926] border-t border-[#FF294F]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5 text-xs">
                  <AlertTriangle
                    className="w-4 h-4 text-[#FF294F] shrink-0 mt-0.5 sm:mt-0"
                    aria-hidden="true"
                  />
                  <div>
                    <span className="font-semibold text-[#FF526F]">
                      High Severity Sample Finding:
                    </span>{' '}
                    <span className="text-[#F1F5FC]">{topFinding.title}</span>
                    <span className="text-[#77849A] ml-2 font-mono">
                      ({topFinding.filePath}:{topFinding.startLine})
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('pr', topFinding.filePath)}
                  className="text-xs font-medium text-[#5EA1FF] hover:text-[#F1F5FC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Diff Line →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Product Capabilities Section: Asymmetric Layout (No 3 identical cards) */}
        <section
          id="code-understanding"
          className="max-w-7xl mx-auto px-6 py-20 border-b border-[#263247]"
        >
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-[#5EA1FF]">Core Capabilities</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F5FC]">
              Built for contextual code comprehension, not copy-paste chat threads.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Primary Marquee Capability (7 Columns) */}
            <div className="lg:col-span-7 bg-[#0D111A] border border-[#263247] rounded-lg p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 text-xs text-[#77849A]">
                  <span className="font-mono text-[#5EA1FF]">01. Understand Any Project</span>
                  <span>Bounded Static Parsing · Zero Code Execution</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-[#F1F5FC]">
                  Explore files, trace logic, and learn how a codebase works.
                </h3>
                <p className="mt-2.5 text-sm text-[#A0AEC2] leading-relaxed">
                  Upload individual source files or multi-folder ZIP repositories directly into
                  browser memory. Gitvox maps directory structures, extracts callable functions with
                  exact line ranges, and generates grounded explanations tied to actual source lines.
                </p>

                {/* Embedded Authentic Function Trace Excerpt */}
                <div className="mt-6 bg-[#080A0F] border border-[#263247] rounded-md p-4 font-mono text-xs">
                  <div className="flex items-center justify-between text-[#77849A] pb-2.5 mb-2.5 border-b border-[#263247]">
                    <span>src/services/tokenService.js</span>
                    <span className="tabular-nums">3 functions extracted</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[#F1F5FC]">
                      <span>issueAccessToken(&#123; sub, role, scopes &#125;)</span>
                      <span className="text-[#5EA1FF] tabular-nums">Lines 6–12</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[#A0AEC2]">
                      <span>verifyAccessToken(token)</span>
                      <span className="text-[#77849A] tabular-nums">Lines 13–21</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[#A0AEC2]">
                      <span>getTokenTtl()</span>
                      <span className="text-[#77849A] tabular-nums">Lines 23–25</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#263247] flex items-center justify-between">
                <span className="text-xs text-[#77849A]">
                  Supports JS, TS, JSX, TSX, Python, Go, Rust, Java, C/C++, JSON, Markdown
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('project')}
                  className="text-xs font-semibold text-[#5EA1FF] hover:text-[#F1F5FC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Project Workspace →
                </button>
              </div>
            </div>

            {/* Right Asymmetric Stack: Capabilities 02 & 03 (5 Columns) */}
            <div className="lg:col-span-5 flex flex-col gap-8 justify-between">
              <div className="flex-1 bg-[#0D111A] border border-[#263247] rounded-lg p-6 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#5EA1FF]">02. Review Code Changes</div>
                  <h3 className="mt-2 text-lg font-semibold text-[#F1F5FC]">
                    Inspect actual diffs, understand modifications, and investigate potential issues.
                  </h3>
                  <p className="mt-2 text-sm text-[#A0AEC2] leading-relaxed">
                    Compare explicit base and proposed source versions in unified or side-by-side
                    split view. Jump straight from severity-ranked review findings to the exact file
                    and line range, and track per-file review completion.
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-[#263247] flex items-center justify-between text-xs">
                  <span className="text-[#77849A] font-mono tabular-nums">
                    Sample PR #284 · 5 files · +86 / -24
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('pr')}
                    className="font-semibold text-[#5EA1FF] hover:text-[#F1F5FC] transition-colors cursor-pointer"
                  >
                    Inspect PR #284 →
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-[#0D111A] border border-[#263247] rounded-lg p-6 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#FF526F]">03. Talk to Your Code</div>
                  <h3 className="mt-2 text-lg font-semibold text-[#F1F5FC]">
                    Use Alan AI voice interaction when configured, with text input as a fallback.
                  </h3>
                  <p className="mt-2 text-sm text-[#A0AEC2] leading-relaxed">
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
                <div className="mt-5 pt-3 border-t border-[#263247] flex items-center justify-between text-xs">
                  <span className="text-[#77849A]">Deterministic Command Router Ready</span>
                  <button
                    type="button"
                    onClick={onOpenVoiceModal}
                    className="font-semibold text-[#5EA1FF] hover:text-[#F1F5FC] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Open Command Router →</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="max-w-7xl mx-auto px-6 py-20 border-b border-[#263247]"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-[#5EA1FF]">Workflow</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F5FC]">
                From unfamiliar repository to confident code review in three steps.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="px-4 py-2 text-xs font-semibold bg-[#121926] hover:bg-[#192234] text-[#F1F5FC] border border-[#263247] rounded-md transition-colors self-start md:self-auto whitespace-nowrap shrink-0 cursor-pointer"
            >
              Go to Upload & Sample Loader
            </button>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="pt-5 border-t border-[#263247]">
              <div className="text-xs font-mono text-[#5EA1FF]">01. Load Source Context</div>
              <h3 className="mt-2 text-lg font-semibold text-[#F1F5FC]">
                Upload code or open a sample.
              </h3>
              <p className="mt-2 text-sm text-[#A0AEC2] leading-relaxed">
                Select a supported source file (up to 2 MB), drop a project ZIP archive (up to 10 MB
                extracted text), or launch the built-in{' '}
                <code className="text-xs text-[#F1F5FC]">acme-platform/api-server</code> repository
                with zero setup.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="mt-4 text-xs font-medium text-[#5EA1FF] hover:underline cursor-pointer"
              >
                Choose Input Source →
              </button>
            </div>

            <div className="pt-5 border-t border-[#263247]">
              <div className="text-xs font-mono text-[#5EA1FF]">02. Navigate & Query</div>
              <h3 className="mt-2 text-lg font-semibold text-[#F1F5FC]">
                Explore files and ask questions.
              </h3>
              <p className="mt-2 text-sm text-[#A0AEC2] leading-relaxed">
                Search the file tree, inspect syntax-highlighted code with line numbers, click
                individual function signatures, and ask contextual questions grounded in the loaded
                files.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('project')}
                className="mt-4 text-xs font-medium text-[#5EA1FF] hover:underline cursor-pointer"
              >
                Explore Sample Project →
              </button>
            </div>

            <div className="pt-5 border-t border-[#263247]">
              <div className="text-xs font-mono text-[#FF526F]">03. Inspect Diffs & Findings</div>
              <h3 className="mt-2 text-lg font-semibold text-[#F1F5FC]">
                Understand changes and review potential issues.
              </h3>
              <p className="mt-2 text-sm text-[#A0AEC2] leading-relaxed">
                Step through unified or split diffs, explain individual change hunks, navigate
                illustrative security and logic findings by line reference, and mark files reviewed.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('pr')}
                className="mt-4 text-xs font-medium text-[#5EA1FF] hover:underline cursor-pointer"
              >
                Review Sample PR #284 →
              </button>
            </div>
          </div>
        </section>

        {/* Product Demonstration Section: Interactive Entry Point to Sample PR #284 */}
        <section id="pull-request-review" className="max-w-7xl mx-auto px-6 py-20">
          <div className="bg-[#0D111A] border border-[#263247] rounded-lg p-7 sm:p-9">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-7 border-b border-[#263247]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#77849A]">
                  <span className="text-[#5EA1FF] font-medium">Interactive Demonstration</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{SAMPLE_PULL_REQUEST.repository}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">PR #{SAMPLE_PULL_REQUEST.number}</span>
                  <span aria-hidden="true">·</span>
                  <span>{SAMPLE_PULL_REQUEST.ciStatus}</span>
                </div>

                <h2 className="mt-2 text-xl sm:text-2xl font-bold text-[#F1F5FC]">
                  {SAMPLE_PULL_REQUEST.title}
                </h2>

                <p className="mt-2 text-sm text-[#A0AEC2] max-w-3xl">
                  Authored by <span className="text-[#F1F5FC]">{SAMPLE_PULL_REQUEST.author}</span>{' '}
                  merging{' '}
                  <code className="text-xs text-[#5EA1FF]">{SAMPLE_PULL_REQUEST.sourceBranch}</code>{' '}
                  into{' '}
                  <code className="text-xs text-[#F1F5FC]">{SAMPLE_PULL_REQUEST.targetBranch}</code>
                  . Inspect any of the {SAMPLE_PULL_REQUEST.filesChangedCount} changed files below
                  to open its live diff and review findings.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate('pr')}
                  className="px-5 py-2.5 text-xs font-semibold bg-[#397BFF] hover:bg-[#5EA1FF] text-[#F1F5FC] rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <GitPullRequest className="w-4 h-4" aria-hidden="true" />
                  <span>Open Full PR Review Workspace</span>
                </button>
              </div>
            </div>

            {/* 5 Changed Files Interactive Table */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-[#77849A] pb-3">
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

              <div className="divide-y divide-[#263247] border border-[#263247] rounded-md bg-[#080A0F]">
                {SAMPLE_PULL_REQUEST.files.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => onNavigate('pr', file.path)}
                    className="w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-[#121926] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-[#F1F5FC] font-medium truncate">
                        {file.path}
                      </div>
                      <div className="text-xs text-[#A0AEC2] mt-0.5 truncate">{file.summary}</div>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs tabular-nums shrink-0">
                      <span className="text-[#39D98A]">+{file.expectedAdditions}</span>
                      <span className="text-[#FF526F]">-{file.expectedDeletions}</span>
                      <span className="text-[#5EA1FF] font-sans font-medium">Inspect Diff →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-[#0D111A] border-t border-[#263247] px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <GitvoxWordmark onClick={() => onNavigate('home')} />
            <p className="text-xs text-[#A0AEC2] mt-2 max-w-md">
              Your code. Your voice. Your clarity. Open-source voice-first AI code-understanding and
              pull-request review platform.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#A0AEC2]">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="hover:text-[#F1F5FC] transition-colors cursor-pointer"
            >
              Start Exploring
            </button>
            <button
              type="button"
              onClick={() => onNavigate('project')}
              className="hover:text-[#F1F5FC] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Project Workspace</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pr')}
              className="hover:text-[#F1F5FC] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <GitPullRequest className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sample PR #284</span>
            </button>
            <button
              type="button"
              onClick={onOpenVoiceModal}
              className="hover:text-[#F1F5FC] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Command Router</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
