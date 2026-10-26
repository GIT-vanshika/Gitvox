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
import {
  EXCLUDED_DIRECTORIES,
  FileValidationError,
  parseSingleSourceContent,
  parseZipArchiveBytes,
  SUPPORTED_EXTENSIONS,
} from '../services/fileParser';
import { getGitHubIntegrationStatus } from '../services/alanVoiceService';
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
    <div className="min-h-screen bg-[#080A0F] text-[#F1F5FC] flex flex-col">
      {/* Top Bar */}
      <header className="bg-[#080A0F] border-b border-[#263247] px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <GitvoxWordmark onClick={() => onNavigate('home')} />
            <span className="text-[#77849A] text-sm" aria-hidden="true">
              /
            </span>
            <span className="text-sm font-medium text-[#A0AEC2] truncate">Start Exploring</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-[#77849A] hidden sm:inline">
              Status: <strong className="text-[#F1F5FC]">{systemStatus}</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('pr')}
              className="px-3.5 py-1.5 text-xs font-medium bg-[#121926] hover:bg-[#192234] text-[#F1F5FC] border border-[#263247] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Sample PR #284
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-[#5EA1FF]">Workspace Initialization</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F5FC]">
            Choose how to load source code into Gitvox
          </h1>
          <p className="mt-2.5 text-sm text-[#A0AEC2] leading-relaxed">
            All uploaded files and archives are parsed statically in browser memory. Gitvox never
            executes uploaded code, never runs scripts, and never installs project dependencies.
          </p>
        </div>

        {/* Validation Error / Unsupported Feedback Banner */}
        {errorBanner && (
          <div
            role="alert"
            className="mt-6 p-4 bg-[#121926] border border-[#FF294F] rounded-lg flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className="w-5 h-5 text-[#FF294F] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-sm font-semibold text-[#FF526F]">{errorBanner.title}</h2>
                <p className="text-xs text-[#F1F5FC] mt-1">{errorBanner.message}</p>
                {errorBanner.remediation && (
                  <p className="text-xs text-[#A0AEC2] mt-1">
                    <strong>How to fix:</strong> {errorBanner.remediation}
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
              className="text-xs text-[#A0AEC2] hover:text-[#F1F5FC] shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Three Primary Entry Options */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Option 1: Upload Source Code */}
          <div className="bg-[#0D111A] border border-[#263247] rounded-lg p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[#77849A]">
                <span className="font-mono text-[#5EA1FF]">01. Single Source File</span>
                <span className="font-mono tabular-nums">Max 2.0 MB</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-[#F1F5FC] flex items-center gap-2">
                <FileCode className="w-5 h-5 text-[#397BFF]" aria-hidden="true" />
                <span>Upload Source Code</span>
              </h2>
              <p className="mt-2 text-xs text-[#A0AEC2] leading-relaxed">
                Inspect an individual source file with syntax highlighting, automatic function
                extraction, and contextual explanations.
              </p>

              <div className="mt-4 pt-4 border-t border-[#263247] text-xs text-[#77849A]">
                <div className="font-medium text-[#A0AEC2] mb-1">Supported extensions:</div>
                <p className="font-mono leading-relaxed">
                  {Object.keys(SUPPORTED_EXTENSIONS).join(', ')}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
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
                className="w-full py-2.5 px-4 text-xs font-semibold bg-[#121926] hover:bg-[#192234] text-[#F1F5FC] border border-[#397BFF] rounded-md transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#5EA1FF]" aria-hidden="true" />
                <span>Select Source File</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateInvalidUpload}
                className="w-full py-1.5 px-3 text-[11px] text-[#77849A] hover:text-[#A0AEC2] text-center transition-colors cursor-pointer"
              >
                Test Unsupported Format Validation (.exe)
              </button>
            </div>
          </div>

          {/* Option 2: Upload a ZIP Project */}
          <div className="bg-[#0D111A] border border-[#263247] rounded-lg p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[#77849A]">
                <span className="font-mono text-[#5EA1FF]">02. Project Archive</span>
                <span className="font-mono tabular-nums">Max 10.0 MB Text</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-[#F1F5FC] flex items-center gap-2">
                <FileArchive className="w-5 h-5 text-[#397BFF]" aria-hidden="true" />
                <span>Upload a ZIP Project</span>
              </h2>
              <p className="mt-2 text-xs text-[#A0AEC2] leading-relaxed">
                Parse a multi-file repository archive in browser memory. Normalizes relative paths,
                blocks path traversal (<code className="text-[#F1F5FC]">../</code>), and filters
                generated directories.
              </p>

              <div className="mt-4 pt-4 border-t border-[#263247] text-xs text-[#77849A]">
                <div className="font-medium text-[#A0AEC2] mb-1">Automatically excluded:</div>
                <p className="font-mono leading-relaxed">
                  {EXCLUDED_DIRECTORIES.slice(0, 6).join(', ')}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
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
                className="w-full py-2.5 px-4 text-xs font-semibold bg-[#121926] hover:bg-[#192234] text-[#F1F5FC] border border-[#397BFF] rounded-md transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#5EA1FF]" aria-hidden="true" />
                <span>Select .ZIP Archive</span>
              </button>

              <button
                type="button"
                onClick={handleTestGeneratedZipUpload}
                className="w-full py-1.5 px-3 text-[11px] text-[#5EA1FF] hover:underline text-center transition-colors cursor-pointer"
              >
                Or Parse Sample In-Memory ZIP (rate-limiter-pkg.zip)
              </button>
            </div>
          </div>

          {/* Option 3: Open Built-in Sample Project */}
          <div className="bg-[#0D111A] border border-[#397BFF] rounded-lg p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[#77849A]">
                <span className="font-mono text-[#39D98A]">03. Instant Demo Ready</span>
                <span className="font-mono tabular-nums">7 Files · PR #284</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-[#F1F5FC] flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-[#39D98A]" aria-hidden="true" />
                <span>Open Built-in Sample Project</span>
              </h2>
              <p className="mt-2 text-xs text-[#A0AEC2] leading-relaxed">
                Explore <strong className="text-[#F1F5FC]">acme-platform/api-server</strong> and its
                companion Pull Request <strong className="text-[#F1F5FC]">#284</strong> ("Add
                token-based authentication middleware") with zero configuration.
              </p>

              <div className="mt-4 pt-4 border-t border-[#263247] text-xs text-[#A0AEC2] space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#39D98A] shrink-0" />
                  <span>7 source files across middleware, services, routes, tests</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#39D98A] shrink-0" />
                  <span>Genuine base vs. proposed diffs (+86 / -24 lines)</span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={handleOpenBuiltInSample}
                className="w-full py-2.5 px-4 text-xs font-semibold bg-[#397BFF] hover:bg-[#5EA1FF] text-[#F1F5FC] rounded-md transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <FolderGit2 className="w-4 h-4" aria-hidden="true" />
                <span>Open Built-in Sample Project</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('pr')}
                className="w-full py-2 px-4 text-xs font-medium bg-[#121926] hover:bg-[#192234] text-[#F1F5FC] border border-[#263247] rounded-md transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <GitPullRequest className="w-3.5 h-3.5 text-[#5EA1FF]" aria-hidden="true" />
                <span>Open Sample Pull Request #284</span>
              </button>
            </div>
          </div>
        </div>

        {/* Honest GitHub Integration Boundary Disclosure */}
        <div className="mt-10 bg-[#0D111A] border border-[#263247] rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-[#77849A] shrink-0 mt-1" aria-hidden="true" />
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-[#F1F5FC]">
                    Direct GitHub Repository & Pull-Request Import
                  </span>
                  <span className="text-[#77849A]" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-[#F5B84B]">{githubStatus.label}</span>
                </div>
                <p className="text-xs text-[#A0AEC2] mt-1 max-w-3xl leading-relaxed">
                  {githubStatus.reason}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-[#77849A]">
                Status: Unavailable integration
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
