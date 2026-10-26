import React, { useState } from 'react';
import { Mic, MicOff, Send, Terminal, Volume2, X } from 'lucide-react';
import {
  getAlanIntegrationConfig,
  requestMicrophonePermissionCheck,
} from '../../services/alanVoiceService';
import { SUPPORTED_VOICE_AND_TEXT_COMMANDS } from '../../services/commandRouter';
import { CommandResult } from '../../types/gitvox';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand: (commandText: string) => CommandResult;
  lastCommandResult: CommandResult | null;
}

export const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
  lastCommandResult,
}) => {
  const [inputCommand, setInputCommand] = useState('');
  const [micCheckMessage, setMicCheckMessage] = useState<string | null>(null);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  const [isCheckingMic, setIsCheckingMic] = useState(false);

  const alanConfig = getAlanIntegrationConfig();

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;
    onExecuteCommand(inputCommand);
    setInputCommand('');
  };

  const handlePresetClick = (preset: string) => {
    onExecuteCommand(preset);
  };

  const handleCheckMic = async () => {
    setIsCheckingMic(true);
    const res = await requestMicrophonePermissionCheck();
    setMicPermissionGranted(res.granted);
    setMicCheckMessage(res.message);
    setIsCheckingMic(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-command-dialog-title"
    >
      <div className="w-full max-w-2xl bg-[#0D111A] border border-[#263247] rounded-lg p-6 text-[#F1F5FC]">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#263247]">
          <div>
            <h2
              id="voice-command-dialog-title"
              className="text-lg font-semibold text-[#F1F5FC] flex items-center gap-2"
            >
              <Volume2 className="w-5 h-5 text-[#397BFF]" aria-hidden="true" />
              <span>Voice & Command Router</span>
            </h2>
            <p className="text-xs text-[#A0AEC2] mt-1">
              Alan AI voice intents and typed commands share the same deterministic action router.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Voice Command Router"
            className="p-1.5 text-[#A0AEC2] hover:text-[#F1F5FC] rounded-md border border-transparent hover:border-[#263247] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Honest Alan AI Integration Boundary Status */}
        <div className="mt-4 p-3.5 bg-[#121926] border border-[#263247] rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            {alanConfig.sdkKeyConfigured ? (
              <Mic className="w-4 h-4 text-[#39D98A] shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <MicOff className="w-4 h-4 text-[#F5B84B] shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="text-xs">
              <div className="font-medium text-[#F1F5FC]">{alanConfig.statusLabel}</div>
              <p className="text-[#A0AEC2] mt-0.5">
                {alanConfig.sdkKeyConfigured
                  ? 'Live Alan AI voice streaming is configured.'
                  : 'Real microphone streaming requires VITE_ALAN_SDK_KEY. Use the text command input or intent buttons below to execute any voice command immediately.'}
              </p>
              {micCheckMessage && (
                <p
                  className={`mt-1.5 font-mono text-[11px] ${
                    micPermissionGranted ? 'text-[#39D98A]' : 'text-[#FF526F]'
                  }`}
                >
                  {micCheckMessage}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckMic}
            disabled={isCheckingMic}
            className="px-3 py-1.5 text-xs font-medium bg-[#080A0F] hover:bg-[#121926] text-[#F1F5FC] border border-[#263247] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isCheckingMic ? 'Checking Audio...' : 'Test Mic Permission'}
          </button>
        </div>

        {/* Text Command Fallback Form */}
        <form onSubmit={handleFormSubmit} className="mt-4">
          <label
            htmlFor="voice-command-input"
            className="block text-xs font-medium text-[#A0AEC2] mb-1.5"
          >
            Execute Voice / Text Command
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Terminal
                className="w-4 h-4 text-[#77849A] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="voice-command-input"
                type="text"
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                placeholder='e.g., "Show the authentication middleware" or "Check these changes for potential bugs"'
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#080A0F] border border-[#263247] rounded-md text-[#F1F5FC] placeholder-[#77849A] focus:border-[#5EA1FF] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-[#397BFF] hover:bg-[#5EA1FF] text-[#F1F5FC] rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Run Command</span>
            </button>
          </div>
        </form>

        {/* Supported Voice Intents */}
        <div className="mt-4">
          <div className="text-xs font-medium text-[#A0AEC2] mb-2">
            Supported Alan AI & Router Intents (Click to Execute)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUPPORTED_VOICE_AND_TEXT_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => handlePresetClick(cmd)}
                className="text-left px-3 py-2 text-xs font-mono bg-[#080A0F] hover:bg-[#121926] text-[#F1F5FC] border border-[#263247] hover:border-[#397BFF] rounded-md transition-colors truncate cursor-pointer"
              >
                "{cmd}"
              </button>
            ))}
          </div>
        </div>

        {/* Last Command Output Feedback */}
        {lastCommandResult && (
          <div className="mt-4 p-3.5 bg-[#080A0F] border border-[#263247] rounded-md">
            <div className="flex items-center justify-between gap-2 text-xs text-[#A0AEC2]">
              <span className="font-semibold text-[#F1F5FC]">
                {lastCommandResult.responseTitle}
              </span>
              <span className="font-mono">
                Intent: {lastCommandResult.intent} ·{' '}
                {lastCommandResult.recognized ? 'Matched' : 'Fallback'}
              </span>
            </div>
            <p className="text-xs text-[#A0AEC2] mt-1.5 leading-relaxed">
              {lastCommandResult.responseMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
