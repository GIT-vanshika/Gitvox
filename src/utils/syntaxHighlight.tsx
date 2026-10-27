import React from 'react';

/* ---------------------------------------------------------------------------
   Lightweight, dependency-free syntax highlighting for code review surfaces.
   It tokenizes one line at a time and renders React elements, so no HTML is
   injected. JavaScript / TypeScript get full keyword coverage; other supported
   languages fall back to the same generic tokenizer (comments, strings,
   numbers, identifiers).
--------------------------------------------------------------------------- */

const KEYWORDS = new Set([
  // JavaScript
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
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'try',
  'catch',
  'finally',
  'throw',
  'new',
  'delete',
  'in',
  'of',
  'instanceof',
  'typeof',
  'void',
  'yield',
  'async',
  'await',
  'class',
  'extends',
  'super',
  'this',
  'static',
  'get',
  'set',
  // TypeScript
  'interface',
  'type',
  'enum',
  'namespace',
  'module',
  'declare',
  'abstract',
  'implements',
  'public',
  'private',
  'protected',
  'readonly',
  'as',
  'keyof',
  'infer',
  'satisfies',
  'is',
  // Literals
  'true',
  'false',
  'null',
  'undefined',
  // Python / Go / Rust common keywords kept for uploaded files
  'def',
  'elif',
  'lambda',
  'pass',
  'raise',
  'with',
  'yield',
  'fn',
  'pub',
  'mut',
  'impl',
  'trait',
  'struct',
  'match',
  'use',
]);

const BUILTINS = new Set([
  'console',
  'window',
  'document',
  'process',
  'require',
  'module',
  'exports',
  'globalThis',
  'Promise',
  'JSON',
  'Math',
  'Date',
  'Number',
  'String',
  'Boolean',
  'Array',
  'Object',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Error',
  'RegExp',
  'Symbol',
  'Buffer',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'fetch',
  'parseInt',
  'parseFloat',
  'isNaN',
]);

const COMMENT_PREFIX_LANGUAGES = new Set([
  'python',
  'shell',
  'ruby',
  'yaml',
  'toml',
  'makefile',
]);

const BLOCK_COMMENT_LANGUAGES = new Set([
  'javascript',
  'jsx',
  'typescript',
  'tsx',
  'css',
  'java',
  'c',
  'cpp',
  'go',
  'rust',
  'php',
]);

/**
 * Ordered alternation: multi-line-safe strings first, then comments, then
 * numbers, identifiers, punctuation and whitespace. Matching the strings before
 * comments keeps `//` inside a string literal coloured as a string.
 */
const TOKEN_PATTERN = new RegExp(
  [
    '`(?:[^`\\\\]|\\\\.)*`',
    "'(?:[^'\\\\]|\\\\.)*'",
    '"(?:[^"\\\\]|\\\\.)*"',
    '\\/\\/[^\\n]*',
    '\\/\\*[\\s\\S]*?\\*\\/',
    '\\b0[xX][0-9a-fA-F]+\\b',
    '\\b\\d+(?:\\.\\d+)?\\b',
    '[A-Za-z_$][A-Za-z0-9_$]*',
    '[^\\sA-Za-z0-9_$]+',
    '\\s+',
  ].join('|'),
  'g'
);

const isIdentifier = (token: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(token);

function commentLineKind(line: string, language: string): boolean {
  const trimmed = line.trimStart();
  if (!trimmed) return false;
  if (COMMENT_PREFIX_LANGUAGES.has(language) && trimmed.startsWith('#')) return true;
  if (language === 'sql' && trimmed.startsWith('--')) return true;
  if (language === 'html' && trimmed.startsWith('<!--')) return true;
  // Continuation lines inside a block comment.
  if (BLOCK_COMMENT_LANGUAGES.has(language) && (line.startsWith(' *') || line.startsWith(' */'))) {
    return true;
  }
  return false;
}

/**
 * Renders one line of source with language-aware colours. The caller controls
 * whitespace (`white-space: pre`) so indentation is preserved.
 */
export function renderHighlightedLine(
  line: string,
  language: string = 'javascript'
): React.ReactNode {
  if (!line) return '\u00A0';

  const lang = language.toLowerCase();

  if (commentLineKind(line, lang)) {
    return <span className="tok-comment">{line}</span>;
  }

  const tokens = line.match(TOKEN_PATTERN);
  if (!tokens) return line;

  return tokens.map((token, index) => {
    const key = `${index}-${token.slice(0, 6)}`;

    if (token.startsWith('//') || token.startsWith('/*')) {
      return (
        <span key={key} className="tok-comment">
          {token}
        </span>
      );
    }

    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith('`') && token.endsWith('`'))
    ) {
      return (
        <span key={key} className="tok-string">
          {token}
        </span>
      );
    }

    if (/^(0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?)$/.test(token)) {
      return (
        <span key={key} className="tok-number">
          {token}
        </span>
      );
    }

    if (isIdentifier(token)) {
      if (KEYWORDS.has(token)) {
        return (
          <span key={key} className="tok-keyword">
            {token}
          </span>
        );
      }

      if (BUILTINS.has(token)) {
        return (
          <span key={key} className="tok-builtin">
            {token}
          </span>
        );
      }

      // A call or method name: identifier followed by `(`.
      const rest = tokens.slice(index + 1);
      const nextMeaningful = rest.find((candidate) => candidate.trim().length > 0);
      if (nextMeaningful && nextMeaningful.startsWith('(')) {
        return (
          <span key={key} className="tok-function">
            {token}
          </span>
        );
      }

      // PascalCase identifiers read as types, classes or components.
      if (/^[A-Z][A-Za-z0-9_$]*$/.test(token)) {
        return (
          <span key={key} className="tok-type">
            {token}
          </span>
        );
      }
    }

    return <React.Fragment key={key}>{token}</React.Fragment>;
  });
}

export default renderHighlightedLine;
