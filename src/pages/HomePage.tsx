import React, { useState } from 'react';
import { AcousticSphere3D } from '../components/AcousticSphere3D';
import { RouteId } from '../types/gitvox';

interface HomePageProps {
  onNavigate: (route: RouteId, targetFilePath?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [voiceTestState, setVoiceTestState] = useState<'idle' | 'listening' | 'success'>('idle');

  const handleTestVoiceCommand = () => {
    if (voiceTestState !== 'idle') return;
    setVoiceTestState('listening');
    setTimeout(() => {
      setVoiceTestState('success');
      setTimeout(() => {
        setVoiceTestState('idle');
      }, 2400);
    }, 1500);
  };

  return (
    <div className="bg-surface text-on-surface font-body-md text-body-md min-h-screen selection:bg-primary/25 selection:text-primary">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-2xl shadow-[0_4px_28px_rgba(0,0,0,0.7)] border-b border-surface-container-high/60">
        <div className="h-20 w-full px-gutter flex items-center justify-between gap-space-md">
          {/* Logo & Version */}
          <div className="flex items-center gap-space-lg">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-space-sm group cursor-pointer text-left bg-transparent border-0 p-0"
              type="button"
            >
              <div className="w-10 h-10 rounded-xl bg-surface-container-high border border-primary/30 flex items-center justify-center relative shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                <span className="material-symbols-outlined text-primary text-[22px]">terminal</span>
                <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-surface flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="font-headline-md text-headline-md tracking-tight font-bold text-on-surface">Gitvox</span>
                  <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-telemetry-tag text-telemetry-tag uppercase tracking-wider border border-primary/20">v2.4</span>
                </div>
                <span className="font-telemetry-tag text-telemetry-tag text-outline">dev-intelligence</span>
              </div>
            </button>
            <div className="hidden xl:flex items-center gap-space-sm pl-space-md">
              <div className="flex items-center gap-space-xs px-2.5 py-1 rounded-full bg-surface-container-low border border-surface-container-high">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#f59e0b]"></span>
                <span className="font-telemetry-tag text-telemetry-tag text-on-surface">Ready in-browser</span>
              </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="hidden lg:flex items-center gap-space-xs p-1 rounded-xl bg-surface-container-lowest/80 backdrop-blur-md border border-surface-container-high/60">
            <button
              onClick={() => onNavigate('home')}
              aria-current="page"
              className="px-3.5 py-1.5 rounded-lg transition-all bg-surface-container-high text-primary font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] cursor-pointer"
              type="button"
            >
              Overview
            </button>
            <button
              onClick={() => onNavigate('project')}
              className="px-3.5 py-1.5 rounded-lg text-on-surface-variant font-body-sm text-body-sm transition-all hover:bg-surface-container hover:text-on-surface cursor-pointer"
              type="button"
            >
              Live Workspace
            </button>
            <button
              onClick={() => onNavigate('pr')}
              className="px-3.5 py-1.5 rounded-lg text-on-surface-variant font-body-sm text-body-sm transition-all hover:bg-surface-container hover:text-on-surface cursor-pointer"
              type="button"
            >
              PR Review Studio
            </button>
            <button
              onClick={() => onNavigate('explore')}
              className="px-3.5 py-1.5 rounded-lg text-on-surface-variant font-body-sm text-body-sm transition-all hover:bg-surface-container hover:text-on-surface cursor-pointer"
              type="button"
            >
              Upload Source
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => onNavigate('project')}
              className="hidden md:inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-sm text-body-sm transition-all border border-surface-container-highest/60 cursor-pointer"
              type="button"
            >
              Open Sample Project
            </button>
            <button
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-fixed text-on-primary font-body-sm text-body-sm font-semibold transition-all shadow-[0_0_18px_rgba(245,158,11,0.35)] cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">upload</span>
              <span>Upload Code</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-surface-container-highest border border-primary/40 flex items-center justify-center ml-1 text-primary">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-80px)]">
        <div className="flex flex-col w-full">
          {/* Top Telemetry Ribbon */}
          <div className="w-full bg-surface-container-lowest border-b border-surface-container-high/60 px-gutter py-2 flex flex-wrap items-center justify-between gap-space-sm text-telemetry-tag font-telemetry-tag">
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#f59e0b]"></span>
                <span className="text-primary font-medium">Local Voice Matrix Active</span>
              </div>
              <span className="hidden md:inline text-outline">• Sub-20ms Audio Pipeline</span>
              <span className="hidden lg:inline text-secondary">• Client-Side Sandboxing</span>
            </div>
            <div className="flex items-center gap-space-sm">
              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant border border-surface-container-high">
                In-Browser Isolation
              </span>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold border border-primary/20">
                100% Privacy Preserved
              </span>
            </div>
          </div>

          {/* Hero Section */}
          <section className="relative w-full px-gutter py-space-xl overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="absolute top-1/4 -right-32 w-[32rem] h-[32rem] bg-secondary/15 rounded-full blur-[160px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto flex flex-col gap-space-xl relative z-10">
              {/* Section Tag & Latency Status */}
              <div className="flex items-center justify-between gap-space-sm">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-primary/20">
                  <span className="material-symbols-outlined text-primary text-[16px]">mic</span>
                  <span className="font-telemetry-tag text-telemetry-tag uppercase text-primary tracking-wider font-semibold">
                    Conversational Dev Environment
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 font-telemetry-tag text-telemetry-tag text-outline">
                  <span>Streaming latency</span>
                  <span className="text-primary font-semibold">~14ms</span>
                </div>
              </div>

              {/* Main Headline */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-end">
                <div className="lg:col-span-8 flex flex-col gap-space-md">
                  <h1 className="font-display-hero text-display-hero tracking-tight text-on-surface">
                    Talk to your codebase.
                    <span className="block bg-gradient-to-r from-primary via-amber-300 to-secondary bg-clip-text text-transparent">
                      Navigate and code hands-free.
                    </span>
                  </h1>
                  <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
                    Query your project structure, inspect code branches, diagnose bugs, and explore edits using natural voice commands in real time.
                  </p>
                </div>
                <div className="lg:col-span-4 flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-xl border border-secondary/20 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-telemetry-tag text-telemetry-tag text-secondary uppercase font-semibold">
                      Zero Remote Storage
                    </span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-telemetry-tag text-telemetry-tag border border-primary/20">
                      Local AST
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Code analysis executes strictly within your local browser sandbox. Your proprietary source files never touch external servers.
                  </p>
                </div>
              </div>

              {/* CTA Row */}
              <div className="flex flex-wrap items-center gap-space-md pt-1">
                <button
                  onClick={() => onNavigate('project')}
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-on-primary font-body-md text-body-md font-semibold shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all hover:bg-primary-fixed hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">folder_open</span>
                  <span>Open Sample Project</span>
                  <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                </button>

                <button
                  onClick={() => onNavigate('explore')}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-md text-body-md font-medium border border-surface-container-highest/60 transition-all hover:border-secondary/40 cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-secondary text-[20px]">upload_file</span>
                  <span>Upload Code (ZIP / Git)</span>
                </button>

                <button
                  onClick={handleTestVoiceCommand}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary font-telemetry-tag text-telemetry-tag uppercase tracking-wider border border-primary/30 transition-all cursor-pointer"
                  type="button"
                >
                  {voiceTestState === 'idle' && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                      <span>Try Voice Command</span>
                      <span className="material-symbols-outlined text-[16px]">mic</span>
                    </>
                  )}
                  {voiceTestState === 'listening' && (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
                      <span>Listening...</span>
                      <span className="material-symbols-outlined text-[16px] text-primary">graphic_eq</span>
                    </>
                  )}
                  {voiceTestState === 'success' && (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                      <span className="text-secondary">Navigated to auth.js:L9</span>
                      <span className="material-symbols-outlined text-[16px] text-secondary">check</span>
                    </>
                  )}
                </button>
              </div>

              {/* Hero Visual: Acoustic Voice Matrix 3D Scene + Sleek HUD */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-stretch mt-space-sm">
                {/* 3D Acoustic Scene Container */}
                <div className="lg:col-span-7 relative rounded-2xl bg-surface-container-lowest border border-primary/20 shadow-2xl overflow-hidden min-h-[420px]">
                  {/* 3D Scene Canvas */}
                  <div className="absolute inset-0 w-full h-full bg-transparent">
                    <AcousticSphere3D />
                  </div>
                </div>

                {/* Voice HUD */}
                <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-surface-container-low border border-surface-container-high/70 p-space-lg shadow-xl relative">
                  <div>
                    <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/50">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></div>
                        <span className="font-telemetry-tag text-telemetry-tag text-on-surface uppercase font-bold tracking-wider">
                          Voice Telemetry
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-telemetry-tag text-telemetry-tag border border-primary/20">
                        Ready
                      </span>
                    </div>

                    {/* Microphone Input Display */}
                    <div className="my-space-md p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-high/50 flex flex-col gap-space-sm">
                      <div className="flex items-center justify-between font-telemetry-tag text-telemetry-tag text-outline">
                        <span className="flex items-center gap-1.5 text-on-surface">
                          <span className="material-symbols-outlined text-[16px] text-primary">graphic_eq</span>
                          Microphone Input
                        </span>
                        <span className="text-secondary font-semibold">Optimal dB</span>
                      </div>
                      <div className="h-10 w-full flex items-center justify-between gap-1.5 px-2">
                        <span className="w-1.5 bg-primary/70 rounded-full h-3"></span>
                        <span className="w-1.5 bg-primary rounded-full h-6 animate-pulse"></span>
                        <span className="w-1.5 bg-secondary rounded-full h-9 animate-pulse" style={{ animationDelay: '100ms' }}></span>
                        <span className="w-1.5 bg-accent-pink rounded-full h-7 animate-pulse" style={{ animationDelay: '200ms' }}></span>
                        <span className="w-1.5 bg-primary rounded-full h-10 animate-pulse" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 bg-secondary rounded-full h-5 animate-pulse" style={{ animationDelay: '80ms' }}></span>
                        <span className="w-1.5 bg-primary rounded-full h-8 animate-pulse" style={{ animationDelay: '250ms' }}></span>
                        <span className="w-1.5 bg-secondary/80 rounded-full h-4 animate-pulse"></span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface-container-high/50 mt-1 border border-surface-container-highest/40">
                        <span className="font-telemetry-tag text-telemetry-tag text-primary uppercase block mb-1 font-semibold">
                          Spoken Query
                        </span>
                        <p className="font-voice-transcript text-voice-transcript text-on-surface">
                          “Show the authentication flow in auth.js and check environment variables”
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Grounding Feedback */}
                  <div className="p-space-md rounded-xl bg-surface-container border border-surface-container-high/70 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-telemetry-tag text-telemetry-tag text-primary uppercase font-semibold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Code Grounded
                      </span>
                      <span className="text-outline font-telemetry-tag text-telemetry-tag">src/auth.js:L9</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Matched target file and highlighted the JWT fallback token condition.
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-surface-container-high/40">
                      <span className="font-telemetry-tag text-telemetry-tag text-secondary">Press &amp; hold Space to speak</span>
                      <button
                        onClick={() => onNavigate('project', 'src/middleware/auth.js')}
                        className="px-3 py-1 rounded bg-primary/20 hover:bg-primary text-primary hover:text-on-primary font-telemetry-tag text-telemetry-tag font-semibold transition-all border border-primary/30 cursor-pointer"
                        type="button"
                      >
                        Run Query
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Highlights Strip */}
          <section className="w-full bg-surface-container-lowest border-y border-surface-container-high/60 py-space-lg px-gutter">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-space-md">
              <div className="flex flex-col p-space-md rounded-xl bg-surface-container-low border border-surface-container-high/50 hover:border-primary/30 transition-all">
                <div className="flex items-center gap-2 text-primary mb-1">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                  <span className="font-telemetry-tag text-telemetry-tag uppercase tracking-wider font-semibold">Privacy First</span>
                </div>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">100% In-Browser Execution</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Local processing ensures your proprietary code is never dispatched to cloud models.
                </p>
              </div>

              <div className="flex flex-col p-space-md rounded-xl bg-surface-container-low border border-surface-container-high/50 hover:border-secondary/30 transition-all">
                <div className="flex items-center gap-2 text-secondary mb-1">
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                  <span className="font-telemetry-tag text-telemetry-tag uppercase tracking-wider font-semibold">Instant Response</span>
                </div>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">Sub-Second Voice Queries</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Navigate functions, pinpoint definitions, and inspect changes without manual searching.
                </p>
              </div>

              <div className="flex flex-col p-space-md rounded-xl bg-surface-container-low border border-surface-container-high/50 hover:border-accent-pink/30 transition-all">
                <div className="flex items-center gap-2 text-accent-pink mb-1">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                  <span className="font-telemetry-tag text-telemetry-tag uppercase tracking-wider font-semibold">Zero Setup</span>
                </div>
                <span className="font-headline-md text-headline-md font-bold text-on-surface">Instant Repository Ingestion</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Drag and drop code files or a ZIP archive to immediately start querying and editing.
                </p>
              </div>
            </div>
          </section>

          {/* Workspace Preview Section: Expansive VS Code-Style Layout */}
          <section className="w-full px-gutter py-space-xl">
            <div className="max-w-7xl mx-auto flex flex-col gap-space-lg">
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
                <div>
                  <div className="flex items-center gap-2 text-primary font-telemetry-tag text-telemetry-tag uppercase tracking-wider mb-1">
                    <span className="material-symbols-outlined text-[16px]">code</span>
                    <span>Live Workspace Preview</span>
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
                    Expansive VS Code-Style Workspace
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    Intuitive file explorer on the left with a full-width center editor for an unobstructed development experience.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-code-block text-code-block border border-surface-container-highest/60 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[16px]">folder</span>
                    acme-core / auth
                  </span>
                </div>
              </div>

              {/* IDE Container */}
              <div className="w-full rounded-2xl bg-surface-container-lowest border border-surface-container-high/70 shadow-2xl overflow-hidden flex flex-col">
                {/* Window Titlebar */}
                <div className="w-full bg-surface-container-low px-4 py-2.5 flex items-center justify-between border-b border-surface-container-high/60">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 mr-3">
                      <span className="w-3 h-3 rounded-full bg-error/70"></span>
                      <span className="w-3 h-3 rounded-full bg-primary/70"></span>
                      <span className="w-3 h-3 rounded-full bg-secondary/70"></span>
                    </div>
                    <span className="font-telemetry-tag text-telemetry-tag text-on-surface font-semibold hidden sm:inline">
                      Workspace // auth.js
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-telemetry-tag text-telemetry-tag text-outline">
                    <span className="px-2 py-0.5 rounded bg-surface-container text-secondary border border-secondary/20">
                      Branch: main
                    </span>
                    <span className="hidden md:inline">JavaScript (ES2024)</span>
                    <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_#f59e0b]"></span>
                  </div>
                </div>

                {/* IDE Body */}
                <div className="grid grid-cols-1 md:grid-cols-12 w-full">
                  {/* Left Sidebar: File Tree */}
                  <div className="md:col-span-3 bg-surface-container-low/90 border-r border-surface-container-high/60 p-3 flex flex-col justify-between min-h-[460px]">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between px-2 py-1 text-outline font-telemetry-tag text-telemetry-tag uppercase tracking-wider font-semibold border-b border-surface-container-high/50 pb-2">
                        <span>Files</span>
                        <span className="material-symbols-outlined text-[16px]">folder_open</span>
                      </div>

                      {/* File Tree Items */}
                      <div className="flex flex-col gap-1 font-code-block text-code-block mt-1">
                        <div className="flex items-center gap-2 px-2 py-1 text-on-surface-variant hover:text-on-surface cursor-pointer rounded hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[16px] text-outline">arrow_drop_down</span>
                          <span className="material-symbols-outlined text-[16px] text-secondary">folder</span>
                          <span>src</span>
                        </div>
                        <div className="pl-4 flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 px-2 py-1 text-on-surface-variant hover:text-on-surface cursor-pointer rounded hover:bg-surface-container">
                            <span className="material-symbols-outlined text-[16px] text-outline">arrow_drop_down</span>
                            <span className="material-symbols-outlined text-[16px] text-secondary">folder</span>
                            <span>middleware</span>
                          </div>
                          <div className="pl-4 flex flex-col gap-0.5">
                            <button
                              onClick={() => onNavigate('project', 'src/middleware/auth.js')}
                              className="w-full text-left flex items-center gap-2 px-2 py-1.5 bg-surface-container-highest text-primary font-semibold rounded cursor-pointer border border-primary/30"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[16px] text-primary">javascript</span>
                              <span>auth.js</span>
                              <span className="ml-auto w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_#f59e0b]"></span>
                            </button>
                            <button
                              onClick={() => onNavigate('project', 'src/middleware/rateLimiter.js')}
                              className="w-full text-left flex items-center gap-2 px-2 py-1 text-on-surface-variant hover:text-on-surface cursor-pointer rounded hover:bg-surface-container border-0 bg-transparent"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[16px] text-primary">javascript</span>
                              <span>rateLimiter.js</span>
                            </button>
                          </div>
                          <button
                            onClick={() => onNavigate('project', 'src/server.js')}
                            className="w-full text-left flex items-center gap-2 px-2 py-1 text-on-surface-variant hover:text-on-surface cursor-pointer rounded hover:bg-surface-container border-0 bg-transparent"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[16px] text-primary">javascript</span>
                            <span>server.js</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1 text-on-surface-variant hover:text-on-surface cursor-pointer rounded hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[16px] text-outline">arrow_right</span>
                          <span className="material-symbols-outlined text-[16px] text-secondary">folder</span>
                          <span>tests</span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1 text-on-surface-variant hover:text-on-surface cursor-pointer rounded hover:bg-surface-container">
                          <span className="material-symbols-outlined text-[16px] text-secondary">data_object</span>
                          <span>package.json</span>
                        </div>
                      </div>
                    </div>

                    {/* Voice Status inside sidebar */}
                    <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">mic</span>
                        <span className="font-telemetry-tag text-telemetry-tag text-on-surface">Voice Ready</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_#f59e0b]"></span>
                    </div>
                  </div>

                  {/* Center Expansive Code Editor */}
                  <div className="md:col-span-9 flex flex-col bg-surface-container-lowest">
                    {/* Editor Tab Bar */}
                    <div className="bg-surface-container-low/60 px-4 py-2 flex items-center justify-between border-b border-surface-container-high/60">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1 rounded bg-surface-container-highest text-primary font-code-block text-code-block font-semibold border border-primary/20">
                          <span className="material-symbols-outlined text-[15px] text-primary">javascript</span>
                          <span>auth.js</span>
                          <span className="material-symbols-outlined text-[14px] text-outline cursor-pointer hover:text-on-surface">close</span>
                        </div>
                        <button
                          onClick={() => onNavigate('project', 'src/server.js')}
                          className="flex items-center gap-2 px-3 py-1 rounded hover:bg-surface-container text-on-surface-variant font-code-block text-code-block cursor-pointer border-0 bg-transparent"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[15px] text-primary">javascript</span>
                          <span>server.js</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2 font-telemetry-tag text-telemetry-tag text-outline">
                        <span>Ln 9, Col 1</span>
                        <span className="text-primary">• Clean AST Invariant</span>
                      </div>
                    </div>

                    {/* Code Lines with Highlight on Line 9 */}
                    <div
                      onClick={() => onNavigate('project', 'src/middleware/auth.js')}
                      className="p-4 font-code-block text-code-block overflow-x-auto leading-relaxed cursor-pointer"
                      title="Click to launch live workspace editor"
                    >
                      <div className="flex items-center gap-4 py-0.5 text-outline opacity-60">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag">1</span>
                        <span className="text-on-surface-variant"><span className="text-secondary font-semibold">import</span> jwt <span className="text-secondary font-semibold">from</span> 'jsonwebtoken';</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5 text-outline opacity-60">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag">2</span>
                        <span className="text-on-surface-variant"><span className="text-secondary font-semibold">import</span> &#123; AppError &#125; <span className="text-secondary font-semibold">from</span> '../errors/AppError.js';</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5 text-outline opacity-60">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag">3</span>
                        <span className="text-on-surface-variant"><span className="text-secondary font-semibold">import</span> &#123; logger &#125; <span className="text-secondary font-semibold">from</span> '../utils/telemetry.js';</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5 text-outline opacity-60">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag">4</span>
                        <span></span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag text-outline">5</span>
                        <span className="text-on-surface"><span className="text-secondary font-semibold">export const</span> <span className="text-primary font-semibold">authenticateRequest</span> = <span className="text-secondary">(req, res, next)</span> =&gt; &#123;</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag text-outline">6</span>
                        <span className="text-on-surface pl-4"><span className="text-secondary font-semibold">const</span> authHeader = req.headers['authorization'];</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag text-outline">7</span>
                        <span className="text-on-surface pl-4"><span className="text-secondary font-semibold">const</span> token = authHeader &amp;&amp; authHeader.split(' ')[1];</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag text-outline">8</span>
                        <span></span>
                      </div>

                      {/* Highlighted Focus Line 9 */}
                      <div className="flex items-center gap-4 py-1.5 bg-primary/10 border-l-2 border-primary text-on-surface rounded-r">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag text-primary font-bold">9</span>
                        <span className="text-primary pl-4"><span className="text-secondary font-semibold">const</span> secret = process.env.TOKEN_SECRET;</span>
                        <span className="ml-auto pr-3 font-telemetry-tag text-telemetry-tag text-primary bg-primary/20 px-2 py-0.5 rounded border border-primary/30">
                          Voice Highlight
                        </span>
                      </div>
                      <div className="flex items-center gap-4 py-1 bg-primary/5 text-on-surface">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag text-primary">10</span>
                        <span className="text-on-surface pl-4"><span className="text-secondary font-semibold">if</span> (!secret) &#123;</span>
                      </div>
                      <div className="flex items-center gap-4 py-1 bg-primary/5 text-on-surface">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag text-primary">11</span>
                        <span className="text-on-surface pl-8"><span className="text-secondary font-semibold">throw new</span> AppError('TOKEN_SECRET_UNSET', 500, 'Fatal auth secret failure');</span>
                      </div>
                      <div className="flex items-center gap-4 py-1 bg-primary/5 text-on-surface">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag text-primary">12</span>
                        <span className="text-on-surface pl-4">&#125;</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag text-outline">13</span>
                        <span className="text-on-surface pl-4"><span className="text-secondary font-semibold">const</span> verified = jwt.verify(token, secret, &#123; algorithms: ['HS256'] &#125;);</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5 text-outline opacity-60">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag">14</span>
                        <span className="text-on-surface-variant pl-4">req.user = verified;</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5 text-outline opacity-60">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag">15</span>
                        <span className="text-on-surface-variant pl-4">next();</span>
                      </div>
                      <div className="flex items-center gap-4 py-0.5 text-outline opacity-60">
                        <span className="w-8 text-right select-none font-telemetry-tag text-telemetry-tag">16</span>
                        <span className="text-on-surface-variant">&#125;;</span>
                      </div>
                    </div>

                    {/* Editor Status Footer */}
                    <div className="mt-auto bg-surface-container-low px-4 py-2 flex items-center justify-between border-t border-surface-container-high/60 text-on-surface-variant font-telemetry-tag text-telemetry-tag">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-primary">
                          <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_#f59e0b]"></span>
                          Syntactic AST Ready
                        </span>
                        <span className="hidden sm:inline">UTF-8</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Speak to modify or jump to function</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3-Step Workflow */}
          <section className="w-full px-gutter py-space-xl bg-surface-container-lowest/80 border-t border-surface-container-high/60">
            <div className="max-w-7xl mx-auto flex flex-col gap-space-lg">
              <div className="flex flex-col gap-1 max-w-xl">
                <div className="flex items-center gap-2 text-primary font-telemetry-tag text-telemetry-tag uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  <span>How it works</span>
                </div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
                  3-Step Voice Workflow
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Simple, intuitive coding ergonomics without technical friction.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                {/* Step 1 */}
                <div className="rounded-xl bg-surface-container-low p-space-md border border-surface-container-high/50 flex flex-col justify-between gap-space-md hover:border-primary/40 transition-all">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-telemetry-tag text-telemetry-tag px-2.5 py-0.5 rounded bg-primary/10 text-primary font-bold border border-primary/20">
                        01 • INGEST
                      </span>
                      <span className="material-symbols-outlined text-outline text-[20px]">upload_file</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                      Import Code
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      Drop your repository ZIP or folder directly into the browser. Files are analyzed completely in memory.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-surface-container-high/40 font-telemetry-tag text-telemetry-tag text-outline">
                    <span>Local Memory • Fast Ingestion</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="rounded-xl bg-surface-container-low p-space-md border border-surface-container-high/50 flex flex-col justify-between gap-space-md hover:border-secondary/40 transition-all">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-telemetry-tag text-telemetry-tag px-2.5 py-0.5 rounded bg-secondary/15 text-secondary-fixed font-bold border border-secondary/20">
                        02 • ASK
                      </span>
                      <span className="material-symbols-outlined text-outline text-[20px]">mic</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                      Speak Naturally
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      Ask questions about logic, find where functions are defined, or speak commands to inspect code sections hands-free.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-surface-container-high/40 font-telemetry-tag text-telemetry-tag text-outline">
                    <span>Instant Natural Language Query</span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="rounded-xl bg-surface-container-low p-space-md border border-surface-container-high/50 flex flex-col justify-between gap-space-md hover:border-accent-pink/40 transition-all">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-telemetry-tag text-telemetry-tag px-2.5 py-0.5 rounded bg-accent-pink/15 text-accent-pink font-bold border border-accent-pink/20">
                        03 • REFINE
                      </span>
                      <span className="material-symbols-outlined text-outline text-[20px]">done_all</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                      Review &amp; Edit
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      See the exact lines highlighted and apply quick fixes or suggestions directly within your active workspace.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-surface-container-high/40 font-telemetry-tag text-telemetry-tag text-outline">
                    <span>Clean Line-Level Resolution</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Call to Action */}
          <section className="w-full px-gutter py-space-xl">
            <div className="max-w-7xl mx-auto rounded-2xl bg-surface-container p-space-lg border border-surface-container-high shadow-xl flex flex-col lg:flex-row items-center justify-between gap-space-lg">
              <div className="flex flex-col gap-space-xs max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#f59e0b]"></span>
                  <span className="font-telemetry-tag text-telemetry-tag text-primary uppercase font-bold tracking-wider">
                    Ready to begin?
                  </span>
                </div>
                <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
                  Experience conversational code exploration
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Start exploring your project hands-free. No installation or account required.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-space-md">
                <button
                  onClick={() => onNavigate('project')}
                  className="px-6 py-3.5 rounded-xl bg-primary text-on-primary font-body-md text-body-md font-semibold hover:bg-primary-fixed shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all cursor-pointer"
                  type="button"
                >
                  Open Sample Project
                </button>
                <button
                  onClick={() => onNavigate('explore')}
                  className="px-6 py-3.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-md text-body-md font-medium border border-surface-container-highest/60 transition-all hover:border-secondary/40 cursor-pointer"
                  type="button"
                >
                  Upload Code
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Telemetry Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-surface-container-high/60">
        <div className="w-full px-gutter py-space-md flex flex-col md:flex-row items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md font-telemetry-tag text-telemetry-tag text-outline">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_#f59e0b]"></span>
              <span className="text-on-surface">Gitvox Web Engine</span>
            </div>
            <span>•</span>
            <span>Latency: ~14ms</span>
            <span>•</span>
            <span>Privacy Guaranteed</span>
          </div>
          <div className="flex items-center gap-space-md">
            <span className="font-telemetry-tag text-telemetry-tag text-on-surface-variant">
              © 2025 Gitvox. Modern Conversational Dev.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
