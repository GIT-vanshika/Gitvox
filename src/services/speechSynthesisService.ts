/**
 * Speech synthesis service for Gitvox.
 * Provides natural voice selection, text sanitization, sentence chunking,
 * and concise spoken summary extraction for voice chat.
 */

export function getBestNaturalVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Highest priority: Microsoft Online Natural voices (Edge / Windows modern)
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
}

export function cleanSpeechText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_]{1,3}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitIntoSpeechChunks(text: string): string[] {
  const rawPieces = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks: string[] = [];
  let currentChunk = '';

  for (const piece of rawPieces) {
    if (!currentChunk) {
      currentChunk = piece;
    } else if (currentChunk.length + piece.length + 1 < 160) {
      currentChunk += ' ' + piece;
    } else {
      chunks.push(currentChunk);
      currentChunk = piece;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Extracts a concise 1-2 sentence spoken synopsis from a rich markdown explanation.
 * Allows the voice model to speak the key takeaways succinctly while leaving the
 * full, unabridged markdown response in the chat transcript.
 */
export function extractSpokenSummary(title?: string, markdownText?: string): string {
  if (!markdownText) return '';

  // 1. Strip markdown header lines (# Header)
  const withoutHeaders = markdownText
    .replace(/^#{1,6}\s+[^\n]*/gm, '')
    .trim();

  // 2. Split by lines / paragraphs to separate standalone titles from content
  const lines = withoutHeaders
    .split(/\n+/)
    .map((l) => cleanSpeechText(l))
    .filter(Boolean);

  const candidateSentences: string[] = [];

  for (const line of lines) {
    // Skip short title-like lines that lack sentence punctuation
    if (line.length < 20 || !/[.!?]$/.test(line)) {
      continue;
    }

    const sentences = line
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15 && /[.!?]$/.test(s));

    if (sentences.length > 0) {
      candidateSentences.push(...sentences);
      break;
    }
  }

  if (candidateSentences.length === 0) {
    const fallback = cleanSpeechText(markdownText);
    return fallback.slice(0, 180);
  }

  let summary = candidateSentences[0];
  if (candidateSentences.length > 1 && summary.length + candidateSentences[1].length + 1 <= 220) {
    summary += ' ' + candidateSentences[1];
  }

  if (title && title.toLowerCase().includes('summary') && !summary.toLowerCase().startsWith('summary')) {
    return `Summary: ${summary}`;
  }

  return summary;
}
