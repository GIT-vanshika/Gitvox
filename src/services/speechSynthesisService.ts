/**
 * Speech Synthesis Service for Gitvox
 * Provides natural neural voice selection and concise spoken summaries for voice interaction.
 */

export const getBestNaturalVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Highest priority: Microsoft Online Natural voices (Edge / Windows modern)
  // e.g. "Microsoft Jenny Online (Natural) - English (United States)", "Microsoft Guy Online (Natural)"
  const naturalVoice = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Online (Natural)'))
  );
  if (naturalVoice) return naturalVoice;

  // 2. Google Neural / Natural voices (Chrome / Android)
  const googleVoice = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Natural'))
  );
  if (googleVoice) return googleVoice;

  // 3. Apple Samantha / Siri / Premium voices (macOS / Safari)
  const premiumVoice = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Premium') || v.name.includes('Enhanced') || v.name.includes('Samantha') || v.name.includes('Siri'))
  );
  if (premiumVoice) return premiumVoice;

  // 4. Any English voice that is NOT the robotic Microsoft David
  const nonDavidVoice = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      !v.name.includes('David') &&
      !v.name.includes('Desktop')
  );
  if (nonDavidVoice) return nonDavidVoice;

  // 5. Any English voice fallback
  const anyEnglish = voices.find((v) => v.lang.startsWith('en'));
  return anyEnglish || voices[0] || null;
};

/**
 * Extracts a concise, punchy conversational summary from a full markdown response.
 * Filters out raw code snippets, tables, markdown syntax, and isolates the core 1-3 sentences.
 */
export function extractSpokenSummary(markdown: string): string {
  if (!markdown) return '';

  // 1. Remove all fenced code blocks
  let text = markdown.replace(/```[\s\S]*?```/g, '');

  // 2. Remove markdown tables (lines starting and ending with |)
  text = text.replace(/^\s*\|.*\|\s*$/gm, '');

  // 3. Split into paragraphs
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // 4. Find the first substantial paragraph that is not purely a heading
  let mainParagraph = '';
  for (const p of paragraphs) {
    const withoutHeading = p.replace(/^#{1,6}\s+.*$/gm, '').trim();
    if (withoutHeading.length > 25) {
      mainParagraph = withoutHeading;
      break;
    }
  }

  if (!mainParagraph) {
    mainParagraph = text.replace(/^#{1,6}\s+.*$/gm, '').trim();
  }

  // 5. Clean markdown syntax
  const cleanProse = mainParagraph
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_]{1,3}/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s*/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 6. Extract first 1 to 2 complete sentences (up to ~260 characters)
  const sentences = cleanProse
    .split(/(?<=[.!?]["'”’]?)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length > 0) {
    let summary = sentences[0];
    if (sentences[1] && summary.length < 150) {
      summary += ' ' + sentences[1];
    }
    if (sentences[2] && summary.length < 90) {
      summary += ' ' + sentences[2];
    }
    return summary;
  }

  // 7. Fallback: safe word-boundary trim
  if (cleanProse.length > 220) {
    const trimmed = cleanProse.slice(0, 220);
    const lastSpace = trimmed.lastIndexOf(' ');
    return (lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed) + '.';
  }

  return cleanProse;
}

// Global active references to prevent Chromium garbage collection bug
let activeUtterances: SpeechSynthesisUtterance[] = [];
let activeHeartbeat: ReturnType<typeof setInterval> | null = null;

export function stopSpeaking(): void {
  if (activeHeartbeat) {
    clearInterval(activeHeartbeat);
    activeHeartbeat = null;
  }
  activeUtterances = [];
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakSpokenText(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    preferredVoice?: SpeechSynthesisVoice | null;
  }
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  stopSpeaking();

  const clean = text.replace(/[*_#`[\]]/g, '').trim();
  if (!clean) return;

  const voice = options?.preferredVoice || getBestNaturalVoice();

  // Break text into sentences to keep each utterance bounded
  const pieces = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (pieces.length === 0) return;

  const utterances = pieces.map((piece, index) => {
    const utterance = new SpeechSynthesisUtterance(piece);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    if (index === 0) {
      utterance.onstart = () => {
        options?.onStart?.();
      };
    }

    const isLast = index === pieces.length - 1;
    if (isLast) {
      utterance.onend = () => {
        if (activeHeartbeat) {
          clearInterval(activeHeartbeat);
          activeHeartbeat = null;
        }
        activeUtterances = [];
        options?.onEnd?.();
      };
    }

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('[speechSynthesisService] utterance error:', e.error);
      }
      if (isLast) {
        if (activeHeartbeat) {
          clearInterval(activeHeartbeat);
          activeHeartbeat = null;
        }
        activeUtterances = [];
        options?.onEnd?.();
      }
    };

    return utterance;
  });

  activeUtterances = utterances;

  // Chromium keep-alive heartbeat
  activeHeartbeat = setInterval(() => {
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.speaking &&
      !window.speechSynthesis.paused
    ) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10000);

  for (const u of utterances) {
    window.speechSynthesis.speak(u);
  }
}
