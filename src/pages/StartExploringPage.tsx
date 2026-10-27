import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  FileArchive,
  FolderGit2,
  GitPullRequest,
  Lock,
  Upload,
} from 'lucide-react';
import { zipSync, strToU8 } from 'fflate';
import { GitvoxWordmark } from '../components/common/GitvoxBrand';
import { Reveal } from '../components/common/Reveal';
import {
  EXCLUDED_DIRECTORIES,
  FileValidationError,
  parseSingleSourceContent,
  parseZipArchiveBytes,
  SUPPORTED_EXTENSIONS,
} from '../services/fileParser';
import { getGitHubIntegrationStatus } from '../services/voiceService';
import { SAMPLE_PROJECT } from '../data/sampleProject';
import { LoadedProject, RouteId, SystemStatus } from '../types/gitvox';

interface StartExploringPageProps {
  systemStatus: SystemStatus;
  onSetStatus: (status: SystemStatus) => void;
  onProjectLoaded: (project: LoadedProject) => void;
  onNavigate: (route: RouteId) => void;
}

export const StartExploringPage: React.FC<StartExploringPageProps> = ({
  systemStatus,
  onSetStatus,
  onProjectLoaded,
  onNavigate,
}) => {
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);
  const zipFileInputRef = useRef<HTMLInputElement | null>(null);

  const [errorBanner, setErrorBanner] = useState<{
    title: string;
    message: string;
    remediation?: string;
    status: SystemStatus;
  } | null>(null);

  const githubStatus = getGitHubIntegrationStatus();

  const handleSingleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorBanner(null);
    onSetStatus('Uploading');

    try {
      const arrayBuffer = await file.arrayBuffer();
      onSetStatus('Parsing');
      const loaded = parseSingleSourceContent(file.name, new Uint8Array(arrayBuffer));
      onSetStatus('Ready');
      onProjectLoaded(loaded);
    } catch (err) {
      if (err instanceof FileValidationError) {
        onSetStatus(err.status);
        setErrorBanner({
          title: `Upload Rejected (${err.status})`,
          message: err.message,
          remediation: err.remediation,
          status: err.status,
        });
      } else {
        onSetStatus('Failed');
        setErrorBanner({
          title: 'Upload Failed',
          message: err instanceof Error ? err.message : 'Unable to parse selected file.',
          status: 'Failed',
        });
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleZipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorBanner(null);
    onSetStatus('Uploading');

    try {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new FileValidationError(
          `Expected a .zip archive, but received "${file.name}".`,
          'Unsupported',
          'Upload a standard .zip archive or use the single source file uploader.'
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      onSetStatus('Parsing');
      const loaded = parseZipArchiveBytes(file.name, new Uint8Array(arrayBuffer));
      onSetStatus('Ready');
      onProjectLoaded(loaded);
    } catch (err) {
      if (err instanceof FileValidationError) {
        onSetStatus(err.status);
        setErrorBanner({
          title: `Archive Rejected (${err.status})`,
          message: err.message,
          remediation: err.remediation,
          status: err.status,
        });
      } else {
        onSetStatus('Failed');
        setErrorBanner({
          title: 'ZIP Parsing Error',
          message: err instanceof Error ? err.message : 'Unable to extract ZIP archive.',
          status: 'Failed',
        });
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleOpenBuiltInSample = () => {
    setErrorBanner(null);
    onSetStatus('Ready');
    onProjectLoaded(SAMPLE_PROJECT);
  };

  const handleTestGeneratedZipUpload = () => {
    setErrorBanner(null);
    onSetStatus('Parsing');
    try {
      const archiveBytes = zipSync({
        'rate-limiter-pkg/src/rateLimiter.js': strToU8(
          [
            'export function checkRateLimit(bucket, clientIp, maxRequests = 60) {',
            '  const current = bucket.get(clientIp) || 0;',
            '  if (current >= maxRequests) {',
            '    return { allowed: false, remaining: 0 };',
            '  }',
            '  bucket.set(clientIp, current + 1);',
            '  return { allowed: true, remaining: maxRequests - (current + 1) };',
            '}',
            '',
            'export function resetRateBucket(bucket) {',
            '  bucket.clear();',
            '  return true;',
            '}',
          ].join('\n')
        ),
        'rate-limiter-pkg/src/config.json': strToU8(
          JSON.stringify({ windowSeconds: 60, maxRequests: 60, strictHeaders: true }, null, 2)
        ),
        'rate-limiter-pkg/README.md': strToU8(
          '# rate-limiter-pkg\nIn-memory sliding window rate limiter parsed from ZIP archive.'
        ),
        'rate-limiter-pkg/node_modules/ignored-dep/index.js': strToU8('module.exports = {};'),
      });

      const parsed = parseZipArchiveBytes('rate-limiter-pkg.zip', archiveBytes);
      onSetStatus('Ready');
      onProjectLoaded(parsed);
    } catch (err) {
      onSetStatus('Failed');
      setErrorBanner({
        title: 'ZIP Parse Error',
        message: err instanceof Error ? err.message : 'Failed to parse generated archive.',
        status: 'Failed',
      });
    }
  };

  const handleSimulateInvalidUpload = () => {
    try {
      parseSingleSourceContent('compiled-binary.exe', new Uint8Array([0x00, 0x01, 0x02]));
    } catch (err) {
      if (err instanceof FileValidationError) {
        onSetStatus(err.status);
        setErrorBanner({
          title: `Validation Guard Triggered (${err.status})`,
          message: err.message,
          remediation: err.remediation,
          status: err.status,
        });
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="app-header">
        <div className="shell app-header__inner justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <GitvoxWordmark onClick={() => onNavigate('home')} />
            <span className="text-faint" aria-hidden="true">
              /
            </span>
            <span className="truncate text-sm font-medium text-body">Start exploring</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="chip hidden sm:inline-flex">{systemStatus}</span>
            <button
              type="button"
              onClick={() => onNavigate('pr')}
              className="btn btn-secondary btn-sm"
            >
              <GitPullRequest className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sample PR #284</span>
              <span className="sm:hidden">PR #284</span>
            </button>
          </div>
        </div>
      </header>

      <main className="shell flex-1 pb-28 pt-10">
        <div className="max-w-3xl">
          <p className="eyebrow">Workspace initialization</p>
          <h1 className="h2 mt-2">Choose how to load source code into Gitvox</h1>
          <p className="mt-3 text-sm leading-6 text-body">
            All uploaded files and archives are parsed statically in browser memory. Gitvox never
            executes uploaded code, never runs scripts, and never installs project dependencies.
          </p>
        </div>

        {errorBanner && (
          <div
            role="alert"
            className="mt-6 flex items-start justify-between gap-4 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--danger)]">{errorBanner.title}</h2>
                <p className="mt-1 text-xs leading-5 text-ink">{errorBanner.message}</p>
                {errorBanner.remediation && (
                  <p className="mt-1 text-xs leading-5 text-body">
                    <strong className="text-ink">How to fix:</strong> {errorBanner.remediation}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorBanner(null);
                onSetStatus('Idle');
              }}
              className="btn btn-ghost btn-xs shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <Reveal className="mt-8 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          {/* Option 1: single source file */}
          <div className="card-elevated flex min-w-0 flex-col justify-between p-5">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-faint">
                <span className="font-mono text-accent">01. Single source file</span>
                <span className="font-mono tabular-nums">Max 2.0 MB</span>
              </div>
              <h2 className="mt-3 flex items-center gap-2 text-base font-semibold text-ink">
                <FileCode className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                <span>Upload source code</span>
              </h2>
              <p className="mt-2 text-xs leading-5 text-body">
                Inspect an individual source file with syntax highlighting, automatic function
                extraction, and contextual explanations.
              </p>

              <div className="mt-4 border-t border-line pt-4 text-xs">
                <div className="mb-1 font-medium text-ink">Supported extensions</div>
                <p className="break-words font-mono leading-5 text-faint">
                  {Object.keys(SUPPORTED_EXTENSIONS).join(', ')}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <input
                ref={singleFileInputRef}
                type="file"
                id="single-source-file-input"
                onChange={handleSingleFileChange}
                className="sr-only"
                aria-label="Upload single source file"
              />
              <button
                type="button"
                onClick={() => singleFileInputRef.current?.click()}
                className="btn btn-secondary w-full"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Select source file
              </button>

              <button
                type="button"
                onClick={handleSimulateInvalidUpload}
                className="w-full py-1 text-center text-[11px] text-faint hover:text-body cursor-pointer"
              >
                Test unsupported format validation (.exe)
              </button>
            </div>
          </div>

          {/* Option 2: ZIP project */}
          <div className="card-elevated flex min-w-0 flex-col justify-between p-5">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-faint">
                <span className="font-mono text-accent">02. Project archive</span>
                <span className="font-mono tabular-nums">Max 10.0 MB text</span>
              </div>
              <h2 className="mt-3 flex items-center gap-2 text-base font-semibold text-ink">
                <FileArchive className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                <span>Upload a ZIP project</span>
              </h2>
              <p className="mt-2 text-xs leading-5 text-body">
                Parse a multi-file repository archive in browser memory. Normalizes relative paths,
                blocks path traversal (<code className="text-ink">../</code>), and filters generated
                directories.
              </p>

              <div className="mt-4 border-t border-line pt-4 text-xs">
                <div className="mb-1 font-medium text-ink">Automatically excluded</div>
                <p className="break-words font-mono leading-5 text-faint">
                  {EXCLUDED_DIRECTORIES.slice(0, 6).join(', ')}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <input
                ref={zipFileInputRef}
                type="file"
                id="zip-archive-file-input"
                accept=".zip,application/zip"
                onChange={handleZipFileChange}
                className="sr-only"
                aria-label="Upload project ZIP archive"
              />
              <button
                type="button"
                onClick={() => zipFileInputRef.current?.click()}
                className="btn btn-secondary w-full"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Select .ZIP archive
              </button>

              <button
                type="button"
                onClick={handleTestGeneratedZipUpload}
                className="w-full py-1 text-center text-[11px] font-medium text-accent hover:underline cursor-pointer"
              >
                Or parse sample in-memory ZIP (rate-limiter-pkg.zip)
              </button>
            </div>
          </div>

          {/* Option 3: built-in sample */}
          <div className="card-elevated flex min-w-0 flex-col justify-between border-[var(--accent-border)] hover:border-[var(--accent)] p-5">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-faint">
                <span className="font-mono text-[var(--success)]">03. Instant demo ready</span>
                <span className="font-mono tabular-nums">7 files · PR #284</span>
              </div>
              <h2 className="mt-3 flex items-center gap-2 text-base font-semibold text-ink">
                <FolderGit2 className="h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden="true" />
                <span>Open built-in sample project</span>
              </h2>
              <p className="mt-2 text-xs leading-5 text-body">
                Explore <strong className="font-medium text-ink">acme-platform/api-server</strong>{' '}
                and its companion Pull Request{' '}
                <strong className="font-medium text-ink">#284</strong> ("Add token-based
                authentication middleware") with zero configuration.
              </p>

              <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-xs text-body">
                <div className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]"
                    aria-hidden="true"
                  />
                  <span>7 source files across middleware, services, routes, tests</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]"
                    aria-hidden="true"
                  />
                  <span>Genuine base vs. proposed diffs (+86 / -24 lines)</span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button type="button" onClick={handleOpenBuiltInSample} className="btn btn-primary w-full">
                <FolderGit2 className="h-4 w-4" aria-hidden="true" />
                Open built-in sample project
              </button>

              <button
                type="button"
                onClick={() => onNavigate('pr')}
                className="btn btn-secondary w-full"
              >
                <GitPullRequest className="h-3.5 w-3.5" aria-hidden="true" />
                Open sample pull request #284
              </button>
            </div>
          </div>
        </Reveal>

        <div className="card-muted mt-8 p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-ink">
                    Direct GitHub repository &amp; pull-request import
                  </span>
                  <span className="text-faint" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-[var(--warning)]">{githubStatus.label}</span>
                </div>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-body">
                  {githubStatus.reason}
                </p>
              </div>
            </div>

            <span className="shrink-0 font-mono text-xs text-faint">
              Status: unavailable integration
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};
