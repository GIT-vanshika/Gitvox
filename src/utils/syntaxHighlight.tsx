import React from 'react';

const KEYWORD_SET = new Set([
  'import',
  'from',
  'export',
  'default',
  'function',
  'return',
  'const',
  'let',
  'var',
  'if',
  'else',
  'try',
  'catch',
  'throw',
  'new',
  'async',
  'await',
  'for',
  'while',
  'class',
  'extends',
  'def',
  'pub',
  'fn',
  'true',
  'false',
  'null',
  'undefined',
  'typeof',
]);

/**
 * Lightweight, deterministic syntax highlighter for single code lines.
 * Preserves whitespace and avoids innerHTML/XSS execution risks.
 */
export function renderHighlightedLine(line: string): React.ReactNode {
  if (!line) return '\u00A0';

  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
    return <span className="text-[#77849A] italic">{line}</span>;
  }

  // Tokenize strings, words, numbers, and punctuation safely
  const tokenRegex = /(".*?"|'.*?'|`.*?`|\b[A-Za-z_$][A-Za-z0-9_$]*\b|\b\d+\b|[^\sA-Za-z0-9_$]+|\s+)/g;
  const parts = line.match(tokenRegex);
  if (!parts) return line;

  return parts.map((token, idx) => {
    const key = `${idx}-${token.slice(0, 8)}`;
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('`') && token.endsWith('`'))
    ) {
      return (
        <span key={key} className="text-[#39D98A]">
          {token}
        </span>
      );
    }

    if (KEYWORD_SET.has(token)) {
      return (
        <span key={key} className="text-[#5EA1FF] font-medium">
          {token}
        </span>
      );
    }

    if (/^\d+$/.test(token)) {
      return (
        <span key={key} className="text-[#F5B84B]">
          {token}
        </span>
      );
    }

    if (/^[A-Z][A-Za-z0-9_]*$/.test(token)) {
      return (
        <span key={key} className="text-[#FF526F]">
          {token}
        </span>
      );
    }

    return <React.Fragment key={key}>{token}</React.Fragment>;
  });
}
