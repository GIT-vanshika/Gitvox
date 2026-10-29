import React, { useRef, useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
import {
  FileValidationError,
  parseSingleSourceContent,
  parseZipArchiveBytes,
  SUPPORTED_EXTENSIONS,
} from '../services/fileParser';
import { SAMPLE_PROJECT } from '../data/sampleProject';
import { LoadedProject, RouteId, SystemStatus } from '../types/gitvox';

interface StartExploringPageProps {
  systemStatus: SystemStatus;
  onSetStatus: (status: SystemStatus) => void;
  onProjectLoaded: (project: LoadedProject) => void;
  onNavigate: (route: RouteId) => void;
}

export const StartExploringPage: React.FC<StartExploringPageProps> = ({
  systemStatus: _systemStatus,
  onSetStatus,
  onProjectLoaded,
  onNavigate,
}) => {
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);
  const zipFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [errorBanner, setErrorBanner] = useState<{
    title: string;
    message: string;
    remediation?: string;
  } | null>(null);

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
        });
      } else {
        onSetStatus('Failed');
        setErrorBanner({
          title: 'Upload Failed',
          message: err instanceof Error ? err.message : 'Unable to parse selected file.',
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
        });
      } else {
        onSetStatus('Failed');
        setErrorBanner({
          title: 'ZIP Parsing Error',
          message: err instanceof Error ? err.message : 'Unable to extract ZIP archive.',
        });
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setErrorBanner(null);
    onSetStatus('Uploading');

    try {
      const arrayBuffer = await file.arrayBuffer();
      onSetStatus('Parsing');
      if (file.name.toLowerCase().endsWith('.zip')) {
        const loaded = parseZipArchiveBytes(file.name, new Uint8Array(arrayBuffer));
        onSetStatus('Ready');
        onProjectLoaded(loaded);
      } else {
        const loaded = parseSingleSourceContent(file.name, new Uint8Array(arrayBuffer));
        onSetStatus('Ready');
        onProjectLoaded(loaded);
      }
    } catch (err) {
      if (err instanceof FileValidationError) {
        onSetStatus(err.status);
        setErrorBanner({
          title: `File Rejected (${err.status})`,
          message: err.message,
          remediation: err.remediation,
        });
      } else {
        onSetStatus('Failed');
        setErrorBanner({
          title: 'Ingestion Error',
          message: err instanceof Error ? err.message : 'Unable to parse dropped file.',
        });
      }
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
      });
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body-md text-body-md min-h-screen flex flex-col select-none">
      {/* Hidden file inputs */}
      <input
        ref={singleFileInputRef}
        type="file"
        accept={Object.keys(SUPPORTED_EXTENSIONS).join(',')}
        onChange={handleSingleFileChange}
        className="hidden"
      />
      <input
        ref={zipFileInputRef}
        type="file"
        accept=".zip"
        onChange={handleZipFileChange}
        className="hidden"
      />

      {/* Top Application Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.35)] border-b border-surface-container-high/60">
        <div className="h-16 w-full px-space-lg flex items-center justify-between gap-space-md">
          {/* Brand & Main Navigation */}
          <div className="flex items-center gap-space-xl">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-space-sm cursor-pointer group text-left"
              type="button"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center border border-surface-container-highest group-hover:border-primary/50 transition-colors">
                <span className="material-symbols-outlined text-amber-400 text-[18px]">terminal</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">Gitvox</span>
                <span className="font-telemetry-tag text-telemetry-tag px-space-xs py-0.5 rounded bg-surface-container-highest text-tertiary uppercase">
                  v2.4
                </span>
              </div>
            </button>

            <nav className="hidden lg:flex items-center gap-space-xs">
              <button
                onClick={() => onNavigate('home')}
                className="px-space-md py-1.5 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body-sm text-body-sm cursor-pointer"
                type="button"
              >
                Overview
              </button>
              <button
                onClick={() => onNavigate('project')}
                className="px-space-md py-1.5 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body-sm text-body-sm cursor-pointer"
                type="button"
              >
                Live Workspace
              </button>
              <button
                onClick={() => onNavigate('pr')}
                className="px-space-md py-1.5 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors font-body-sm text-body-sm cursor-pointer"
                type="button"
              >
                PR Review
              </button>
              <button
                onClick={() => onNavigate('explore')}
                aria-current="page"
                className="px-space-md py-1.5 transition-colors bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold rounded cursor-pointer"
                type="button"
              >
                Upload Source
              </button>
            </nav>
          </div>

          {/* Header Action Items */}
          <div className="flex items-center gap-space-md">
            <div className="hidden sm:flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container-lowest border border-surface-container-high">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="font-telemetry-tag text-telemetry-tag text-primary uppercase">
                IDLE / READY
              </span>
            </div>

            <div className="flex items-center gap-space-sm">
              <button
                onClick={handleOpenBuiltInSample}
                className="hidden md:inline-flex items-center px-space-md py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-body-sm transition-colors cursor-pointer border border-surface-container-high/60"
                type="button"
              >
                Open Sample Project
              </button>
              <button
                onClick={() => singleFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-space-md py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-body-sm text-body-sm font-semibold shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                <span>Upload Code</span>
              </button>
            </div>

            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold shadow-sm">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="w-full pt-16 bg-surface flex-1">
        <div className="flex flex-col w-full relative overflow-hidden px-space-lg py-space-xl">
          {/* Ambient Acoustic Field: Amber & Violet Luminescence */}
          <div className="absolute -top-32 left-1/4 w-[620px] h-[340px] bg-gradient-to-br from-violet-500/10 via-amber-500/5 to-transparent blur-[140px] pointer-events-none rounded-full"></div>
          <div className="absolute top-1/3 -right-24 w-[540px] h-[400px] bg-gradient-to-bl from-primary/10 via-violet-500/10 to-transparent blur-[160px] pointer-events-none rounded-full"></div>

          <div className="max-w-7xl w-full mx-auto flex flex-col gap-space-xl relative z-10">
            {/* Error Banner Toast (if validation failed) */}
            {errorBanner && (
              <div className="p-space-md rounded-xl bg-error/15 border border-error/40 text-error flex items-start justify-between gap-space-md shadow-md animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-error mt-0.5">error</span>
                  <div>
                    <h3 className="font-semibold text-[13px] uppercase font-telemetry-tag">{errorBanner.title}</h3>
                    <p className="text-[13px] text-on-surface mt-0.5">{errorBanner.message}</p>
                    {errorBanner.remediation && (
                      <p className="text-[12px] text-on-surface-variant mt-1">{errorBanner.remediation}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="p-1 hover:text-on-surface text-outline transition-colors cursor-pointer"
                  title="Dismiss"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* Top Section & Visual Header Area */}
            <div className="flex flex-col gap-space-sm max-w-3xl">
              <h1 className="font-headline-lg text-headline-lg md:text-[34px] md:leading-[42px] font-bold text-on-surface tracking-tight">
                Choose how to load source code into Gitvox
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                All uploaded files and archives are parsed statically in browser memory. Gitvox never executes uploaded code, never runs scripts, and never installs project dependencies.
              </p>
            </div>

            {/* Acoustic Waveform Stream Divider */}
            <div className="w-full h-8 flex items-center justify-between gap-1 overflow-hidden px-space-xs opacity-60">
              <div className="h-[2px] flex-1 bg-surface-container-high"></div>
              <div className="flex items-center gap-1 px-space-sm">
                <span className="w-1 h-3 rounded-full bg-tertiary/40"></span>
                <span className="w-1 h-5 rounded-full bg-tertiary/70"></span>
                <span className="w-1 h-2 rounded-full bg-tertiary/30"></span>
                <span className="w-1 h-7 rounded-full bg-secondary"></span>
                <span className="w-1 h-4 rounded-full bg-tertiary/80"></span>
                <span className="w-1 h-2 rounded-full bg-tertiary/40"></span>
                <span className="w-1 h-6 rounded-full bg-primary"></span>
                <span className="w-1 h-3 rounded-full bg-tertiary/40"></span>
              </div>
              <div className="h-[2px] flex-1 bg-surface-container-high"></div>
            </div>

            {/* Primary Source Ingestion Grid (3 Main Cards) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-stretch">
              {/* Card 01: Single Source File */}
              <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low border border-surface-container-high/60 shadow-md relative overflow-hidden transition-all duration-300 hover:border-primary/40">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-surface-container-high via-outline to-surface-container-high opacity-60"></div>
                <div className="flex flex-col gap-space-md">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface border border-surface-container-high/60">
                      <span className="material-symbols-outlined text-[22px] text-primary">draft</span>
                    </div>
                    <div className="flex items-center gap-space-xs px-2 py-0.5 rounded-full bg-surface-container-high">
                      <span className="font-telemetry-tag text-[10px] text-outline">CARD // 01</span>
                      <span className="font-telemetry-tag text-[10px] text-on-surface-variant font-bold">MAX 2.0 MB</span>
                    </div>
                  </div>
                  <div>
                    <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Single source file</h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                      Upload individual code file with syntax highlighting, automatic AST function extraction, and real-time voice diff annotation.
                    </p>
                  </div>

                  {/* Code Mockup Visual / Format List */}
                  <div className="p-space-md rounded-lg bg-surface-container-lowest border border-surface-container-high/60 shadow-inner flex flex-col gap-space-sm">
                    <span className="text-primary font-code-block text-[11px] font-semibold">AST-V8 ACTIVE</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="px-2 py-0.5 rounded bg-surface-container-high font-code-block text-[11px] text-tertiary">.ts</span>
                      <span className="px-2 py-0.5 rounded bg-surface-container-high font-code-block text-[11px] text-tertiary">.js</span>
                      <span className="px-2 py-0.5 rounded bg-surface-container-high font-code-block text-[11px] text-primary">.py</span>
                      <span className="px-2 py-0.5 rounded bg-surface-container-high font-code-block text-[11px] text-secondary">.go</span>
                      <span className="px-2 py-0.5 rounded bg-surface-container-high font-code-block text-[11px] text-tertiary">.rs</span>
                      <span className="px-2 py-0.5 rounded bg-surface-container-high font-code-block text-[11px] text-on-surface-variant">.json</span>
                      <span className="px-2 py-0.5 rounded bg-surface-container-high font-code-block text-[11px] text-on-surface-variant">.md</span>
                    </div>
                  </div>

                  {/* Functional Features Checklist */}
                  <div className="flex flex-col gap-2 pt-1 font-body-sm text-body-sm text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                      <span>Zero-latency AST token extraction</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                      <span>Contextual audio dictation anchors</span>
                    </div>
                  </div>
                </div>

                <div className="pt-space-lg flex flex-col gap-space-sm">
                  <button
                    type="button"
                    onClick={() => singleFileInputRef.current?.click()}
                    className="w-full py-2.5 px-space-md rounded-xl bg-surface-container-high text-on-surface font-body-sm text-body-sm font-semibold hover:bg-surface-container-highest hover:text-primary transition-all shadow-sm flex items-center justify-center gap-space-sm cursor-pointer border border-surface-container-highest/60"
                  >
                    <span className="material-symbols-outlined text-[18px] text-tertiary">file_open</span>
                    <span>Select source file</span>
                  </button>
                  <div className="text-center font-telemetry-tag text-[10px] text-outline tracking-wider">
                    RAW PARSER // UTF-8 DECODED
                  </div>
                </div>
              </div>

              {/* Card 02: Project Archive (.ZIP) */}
              <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low border border-surface-container-high/60 shadow-md relative overflow-hidden transition-all duration-300 hover:border-secondary/40">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary/40 via-secondary to-secondary/40 opacity-60"></div>
                <div className="flex flex-col gap-space-md">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface border border-surface-container-high/60">
                      <span className="material-symbols-outlined text-[22px] text-secondary">folder_zip</span>
                    </div>
                    <div className="flex items-center gap-space-xs px-2 py-0.5 rounded-full bg-surface-container-high">
                      <span className="font-telemetry-tag text-[10px] text-outline">CARD // 02</span>
                      <span className="font-telemetry-tag text-[10px] text-secondary font-bold">MAX 10.0 MB</span>
                    </div>
                  </div>
                  <div>
                    <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Project archive</h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                      Upload a ZIP project. Parse multi-file repository archive in browser memory. Normalizes relative paths, blocks traversal, and filters artifact trees.
                    </p>
                  </div>

                  {/* Drag and Drop Canvas Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => zipFileInputRef.current?.click()}
                    className={`p-space-lg rounded-xl border border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-space-xs ${
                      isDragOver
                        ? 'bg-secondary/15 border-secondary'
                        : 'bg-surface-container-lowest/80 border-surface-container-high hover:border-secondary/50 hover:bg-surface-container-lowest'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-1">
                      <span className="material-symbols-outlined text-[24px] text-secondary">cloud_upload</span>
                    </div>
                    <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                      Drop .ZIP file or bundle
                    </span>
                    <span className="font-telemetry-tag text-[10px] text-outline">
                      EXCLUDES NODE_MODULES &amp; .GIT AUTOMATICALLY
                    </span>
                  </div>

                  {/* Sanitizer Guarantee Badges */}
                  <div className="grid grid-cols-2 gap-2 pt-1 font-telemetry-tag text-[10px] text-on-surface-variant">
                    <div className="p-2 rounded bg-surface-container border border-surface-container-high/40 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                      <span>PATH SANITIZED</span>
                    </div>
                    <div className="p-2 rounded bg-surface-container border border-surface-container-high/40 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      <span>BINARY STRIPPED</span>
                    </div>
                  </div>
                </div>

                <div className="pt-space-lg flex flex-col gap-space-sm">
                  <button
                    type="button"
                    onClick={() => zipFileInputRef.current?.click()}
                    className="w-full py-2.5 px-space-md rounded-xl bg-surface-container-high text-on-surface font-body-sm text-body-sm font-semibold hover:bg-surface-container-highest hover:text-secondary transition-all shadow-sm flex items-center justify-center gap-space-sm cursor-pointer border border-surface-container-highest/60"
                  >
                    <span className="material-symbols-outlined text-[18px] text-secondary">inventory_2</span>
                    <span>Select .ZIP archive</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTestGeneratedZipUpload}
                    className="text-center font-telemetry-tag text-telemetry-tag text-secondary hover:text-secondary-fixed transition-colors underline underline-offset-4 pt-1 cursor-pointer"
                  >
                    Or parse sample in-memory ZIP (rate-limiter-pkg.zip)
                  </button>
                </div>
              </div>

              {/* Card 03: Highlighted Instant Demo Ready */}
              <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container border border-primary/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-tertiary via-primary to-secondary"></div>
                <div className="absolute -right-12 -top-12 w-40 h-40 bg-violet-500/15 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex flex-col gap-space-md relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-tertiary/20 flex items-center justify-center text-tertiary shadow-[0_0_16px_rgba(176,144,255,0.3)]">
                      <span className="material-symbols-outlined text-[22px]">bolt</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/20 border border-tertiary/30">
                      <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                      <span className="font-telemetry-tag text-telemetry-tag text-tertiary font-bold tracking-wider uppercase">
                        INSTANT DEMO READY
                      </span>
                    </div>
                  </div>
                  <div>
                    <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Open built-in sample project</h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                      Explore <code className="font-code-block text-[12px] text-primary px-1 py-0.5 rounded bg-surface-container-lowest">acme-platform/api-server</code> with rich authentication middleware and pre-indexed AST nodes.
                    </p>
                  </div>

                  {/* Project Tree Snapshot & Visual Breakdown */}
                  <div className="p-space-md rounded-xl bg-surface-container-lowest/90 border border-surface-container-high/60 shadow-inner flex flex-col gap-space-sm">
                    <div className="flex items-center justify-between pb-1">
                      <span className="font-telemetry-tag text-telemetry-tag text-tertiary uppercase">
                        PRE-LOADED MANIFEST
                      </span>
                      <span className="font-telemetry-tag text-telemetry-tag text-on-surface-variant font-bold">
                        3 FILES // 18.5 KB
                      </span>
                    </div>
                    <div className="w-full flex items-center gap-space-sm py-1">
                      <div className="flex-1 bg-surface-container-high h-2 rounded-full overflow-hidden flex">
                        <div className="bg-primary w-[45%]" title="Auth Middleware (45%)"></div>
                        <div className="bg-tertiary w-[35%]" title="Token Service (35%)"></div>
                        <div className="bg-secondary w-[20%]" title="User Routes (20%)"></div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 font-code-block text-[12px] text-on-surface-variant pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-primary">data_object</span>
                          src/middleware/auth.js
                        </span>
                        <span className="font-telemetry-tag text-[10px] text-primary uppercase">DIFF ATTACHED</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-tertiary">functions</span>
                          src/services/tokenService.js
                        </span>
                        <span className="font-telemetry-tag text-[10px] text-outline">STABLE</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-secondary">alt_route</span>
                          src/routes/userRoutes.js
                        </span>
                        <span className="font-telemetry-tag text-[10px] text-outline">3 HOOKS</span>
                      </div>
                    </div>
                  </div>

                  {/* Feature Bullets */}
                  <div className="flex flex-col gap-2 pt-1 font-body-sm text-body-sm text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-tertiary">verified</span>
                      <span>Production authentication &amp; token pipeline</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-tertiary">bolt</span>
                      <span className="font-medium text-on-surface">Zero configuration required</span>
                    </div>
                  </div>
                </div>

                <div className="pt-space-lg flex flex-col gap-space-sm relative z-10">
                  <button
                    type="button"
                    onClick={handleOpenBuiltInSample}
                    className="w-full py-3 px-space-md rounded-xl bg-primary hover:bg-primary-fixed text-on-primary font-body-md text-body-md font-bold transition-all shadow-[0_0_24px_rgba(245,158,11,0.35)] flex items-center justify-center gap-space-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                    <span>Open built-in sample project</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('pr')}
                    className="w-full py-2 px-space-md rounded-lg bg-surface-container-high text-on-surface font-body-sm text-body-sm font-medium hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-space-xs cursor-pointer border border-surface-container-high/60"
                  >
                    <span className="material-symbols-outlined text-[16px] text-tertiary">fork_right</span>
                    <span>Open sample pull request #284</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Architectural Guarantees & Privacy Pipeline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
              <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high/60 flex items-start gap-space-md">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5 border border-surface-container-high/60">
                  <span className="material-symbols-outlined text-[18px]">memory</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md font-semibold text-on-surface">Browser-Local Parsing</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Fast static tokenizers compile without streaming codebase bytes to any external compute nodes.
                  </span>
                </div>
              </div>
              <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high/60 flex items-start gap-space-md">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-tertiary shrink-0 mt-0.5 border border-surface-container-high/60">
                  <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md font-semibold text-on-surface">Zero Data Retention</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Closing this browser tab completely purges volatile memory structures. No residue or tracking cookies stored.
                  </span>
                </div>
              </div>
              <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high/60 flex items-start gap-space-md">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-secondary shrink-0 mt-0.5 border border-surface-container-high/60">
                  <span className="material-symbols-outlined text-[18px]">spatial_audio_off</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md font-semibold text-on-surface">Voice Context Binding</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Microphone speech is converted into lexical tokens anchored precisely to file line spans via dynamic voice index cards.
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Integration Card: Direct GitHub Repository Import */}
            <div className="w-full p-space-lg rounded-xl bg-surface-container-low border border-surface-container-high/60 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg relative overflow-hidden">
              <div className="flex items-start md:items-center gap-space-md relative z-10">
                <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface shrink-0 border border-surface-container-high/60 shadow-inner">
                  <span className="material-symbols-outlined text-[26px] text-tertiary">hub</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-space-sm flex-wrap">
                    <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Direct GitHub repository import</h3>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-outline font-telemetry-tag text-telemetry-tag uppercase font-semibold">
                      PLANNED / COMING SOON
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
                    Connect personal access tokens or OAuth to read public and private repositories directly into the sandboxed AST analyzer.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-space-md shrink-0 w-full md:w-auto justify-end relative z-10">
                <button
                  type="button"
                  disabled
                  className="px-space-md py-2.5 rounded-xl bg-surface-container-high text-outline font-body-sm text-body-sm font-medium cursor-not-allowed opacity-75 flex items-center gap-2 border border-surface-container-high"
                >
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>Connect GitHub (v2.5)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-surface-container-high/60 py-space-md">
        <div className="max-w-7xl mx-auto px-space-lg flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
          <span>© 2026 GITVOX INTEL</span>
        </div>
      </footer>
    </div>
  );
};
