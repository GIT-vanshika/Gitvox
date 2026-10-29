/**
 * Gitvox Unified Multi-Grammar Syntax & Diagnostics Engine
 * 
 * Provides instant, zero-latency browser-native AST & lexical diagnostics
 * across all major programming languages:
 * - C-Family / Compiled: C++, C, Rust, Go, Java, C#, PHP, JavaScript, TypeScript
 * - Indentation & Colon Structured: Python
 * - Data & Schemas: JSON
 */

export interface SyntaxDiagnostic {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Detect language identifier from file extension or path
 */
export const detectLanguageFromPath = (filePath?: string): string => {
  if (!filePath) return 'javascript';
  const lower = filePath.toLowerCase();
  
  if (lower.endsWith('.py') || lower.endsWith('.pyw')) return 'python';
  if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx') || lower.endsWith('.hpp') || lower.endsWith('.hxx')) return 'cpp';
  if (lower.endsWith('.c') || lower.endsWith('.h')) return 'c';
  if (lower.endsWith('.rs')) return 'rust';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.cs')) return 'csharp';
  if (lower.endsWith('.php')) return 'php';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs')) return 'javascript';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.sql')) return 'sql';
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'shell';
  
  return 'javascript';
};

/**
 * Validate JSON structure with line and column precision
 */
export const validateJsonSyntax = (code: string): SyntaxDiagnostic[] => {
  const errors: SyntaxDiagnostic[] = [];
  if (!code.trim()) return errors;

  try {
    JSON.parse(code);
  } catch (err: any) {
    let line = 1;
    let col = 1;
    const match = err.message?.match(/position\s+(\d+)/i);
    if (match) {
      const pos = parseInt(match[1], 10);
      const prefix = code.slice(0, pos);
      const lines = prefix.split('\n');
      line = lines.length;
      col = lines[lines.length - 1].length + 1;
    }
    errors.push({
      startLineNumber: line,
      startColumn: col,
      endLineNumber: line,
      endColumn: col + 5,
      message: err.message || 'JSON Syntax Error',
      severity: 'error',
    });
  }
  return errors;
};

/**
 * Validate Python syntax:
 * - Colons after compound statements (def, class, if, elif, else, for, while, try, except, finally, with)
 * - Missing parentheses in function declarations (def foo:)
 * - Python 3 print without parentheses: print "..."
 * - Incomplete assignments and trailing operators (e.g. x = , x = 5 + )
 * - Indentation levels consistency
 * - Triple-quoted strings (""" and ''')
 * - Regular single/double quote strings
 * - Delimiters ({}, (), []) across multiline definitions
 */
export const validatePythonSyntax = (code: string): SyntaxDiagnostic[] => {
  const errors: SyntaxDiagnostic[] = [];
  if (!code.trim()) return errors;

  const lines = code.split('\n');
  const indentStack: number[] = [0];
  const bracketStack: Array<{ char: string; line: number; col: number }> = [];
  
  let inDocstring: '"""' | "'''" | null = null;
  let docstringStartLine = 1;
  let expectIndentNextLine = false;

  for (let l = 0; l < lines.length; l++) {
    const rawLine = lines[l];
    const lineNum = l + 1;

    // Handle multiline docstrings
    if (inDocstring) {
      const closeIdx = rawLine.indexOf(inDocstring);
      if (closeIdx !== -1) {
        inDocstring = null;
      }
      continue;
    }

    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue; // Skip comments and empty lines
    }

    // Calculate line indentation
    let indent = 0;
    while (indent < rawLine.length && (rawLine[indent] === ' ' || rawLine[indent] === '\t')) {
      indent += rawLine[indent] === '\t' ? 4 : 1;
    }

    // Strip comments not inside strings
    let cleanCode = '';
    let inStr: string | null = null;
    let isEscaped = false;

    for (let c = indent; c < rawLine.length; c++) {
      const ch = rawLine[c];
      const nextTwo = rawLine.slice(c, c + 3);

      // Check for triple quotes
      if (!inStr && (nextTwo === '"""' || nextTwo === "'''")) {
        const remaining = rawLine.slice(c + 3);
        const closingInSameLine = remaining.indexOf(nextTwo);
        if (closingInSameLine !== -1) {
          c += 3 + closingInSameLine + 2;
          continue;
        } else {
          inDocstring = nextTwo as '"""' | "'''";
          docstringStartLine = lineNum;
          break;
        }
      }

      if (inStr) {
        if (isEscaped) {
          isEscaped = false;
        } else if (ch === '\\') {
          isEscaped = true;
        } else if (ch === inStr) {
          inStr = null;
        }
        continue;
      }

      if (ch === "'" || ch === '"') {
        inStr = ch;
        continue;
      }

      if (ch === '#') {
        break; // Start of comment
      }

      cleanCode += ch;

      // Track brackets
      if (ch === '(' || ch === '[' || ch === '{') {
        bracketStack.push({ char: ch, line: lineNum, col: c + 1 });
      } else if (ch === ')' || ch === ']' || ch === '}') {
        const expected = ch === ')' ? '(' : ch === ']' ? '[' : '{';
        if (bracketStack.length === 0) {
          errors.push({
            startLineNumber: lineNum,
            startColumn: c + 1,
            endLineNumber: lineNum,
            endColumn: c + 4,
            message: `SyntaxError: unmatched closing '${ch}'`,
            severity: 'error',
          });
          return errors;
        }
        const top = bracketStack.pop()!;
        if (top.char !== expected) {
          errors.push({
            startLineNumber: lineNum,
            startColumn: c + 1,
            endLineNumber: lineNum,
            endColumn: c + 4,
            message: `SyntaxError: closing '${ch}' does not match opening '${top.char}' on line ${top.line}`,
            severity: 'error',
          });
          return errors;
        }
      }
    }

    if (inStr) {
      const startC = Math.max(1, rawLine.lastIndexOf(inStr) + 1);
      errors.push({
        startLineNumber: lineNum,
        startColumn: startC,
        endLineNumber: lineNum,
        endColumn: rawLine.length + 1,
        message: 'SyntaxError: unterminated string literal',
        severity: 'error',
      });
      return errors;
    }

    const cleanTrimmed = cleanCode.trim();
    if (!cleanTrimmed) continue;

    // Check Python 3 print without parens: print "hello" or print 123
    if (/^print\s+["'0-9a-zA-Z_]/.test(cleanTrimmed) && !cleanTrimmed.startsWith('print(')) {
      errors.push({
        startLineNumber: lineNum,
        startColumn: indent + 1,
        endLineNumber: lineNum,
        endColumn: indent + 6,
        message: "SyntaxError: Missing parentheses in call to 'print'",
        severity: 'error',
      });
      return errors;
    }

    // Only validate indentations and statement terminators when outside of brackets
    if (bracketStack.length === 0) {
      const currentIndentLevel = indentStack[indentStack.length - 1];

      if (expectIndentNextLine) {
        if (indent <= currentIndentLevel) {
          errors.push({
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: Math.max(4, indent + 2),
            message: 'IndentationError: expected an indented block',
            severity: 'error',
          });
          return errors;
        }
        indentStack.push(indent);
        expectIndentNextLine = false;
      } else if (indent > currentIndentLevel) {
        errors.push({
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: Math.max(4, indent + 2),
          message: 'IndentationError: unexpected indent',
          severity: 'error',
        });
        return errors;
      } else if (indent < currentIndentLevel) {
        while (indentStack.length > 0 && indentStack[indentStack.length - 1] > indent) {
          indentStack.pop();
        }
        if (indentStack[indentStack.length - 1] !== indent) {
          errors.push({
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: Math.max(4, indent + 2),
            message: 'IndentationError: unindent does not match any outer indentation level',
            severity: 'error',
          });
          return errors;
        }
      }

      // Check function def without parens: e.g. "def foo:"
      if (/^(async\s+)?def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(cleanTrimmed)) {
        errors.push({
          startLineNumber: lineNum,
          startColumn: indent + 1,
          endLineNumber: lineNum,
          endColumn: rawLine.length + 1,
          message: "SyntaxError: expected '(' in function definition",
          severity: 'error',
        });
        return errors;
      }

      // Check compound statement colon requirement
      const COMPOUND_KEYWORDS = [
        'def', 'class', 'if', 'elif', 'else', 'for', 'while',
        'try', 'except', 'finally', 'with', 'async def', 'async for', 'async with'
      ];

      for (const kw of COMPOUND_KEYWORDS) {
        const isMatch = cleanTrimmed === kw || cleanTrimmed.startsWith(kw + ' ') || cleanTrimmed.startsWith(kw + '(');
        if (isMatch) {
          if (!cleanTrimmed.endsWith(':')) {
            errors.push({
              startLineNumber: lineNum,
              startColumn: Math.max(1, rawLine.length - 1),
              endLineNumber: lineNum,
              endColumn: rawLine.length + 3,
              message: `SyntaxError: expected ':' at end of '${kw}' statement`,
              severity: 'error',
            });
            return errors;
          }
          expectIndentNextLine = true;
          break;
        }
      }

      // Check incomplete trailing assignments: e.g. "x =" or "total +=" without RHS
      if (/(=|\+=|-=|\*=|\/=|==|!=|<=|>=)$/.test(cleanTrimmed) && !cleanTrimmed.endsWith('==') && !cleanTrimmed.endsWith('!=')) {
        errors.push({
          startLineNumber: lineNum,
          startColumn: Math.max(1, rawLine.length - 2),
          endLineNumber: lineNum,
          endColumn: rawLine.length + 2,
          message: "SyntaxError: incomplete assignment or expression",
          severity: 'error',
        });
        return errors;
      }
    }
  }

  if (inDocstring) {
    errors.push({
      startLineNumber: docstringStartLine,
      startColumn: 1,
      endLineNumber: lines.length,
      endColumn: lines[lines.length - 1].length + 4,
      message: `SyntaxError: EOF while scanning triple-quoted string literal (${inDocstring})`,
      severity: 'error',
    });
    return errors;
  }

  if (bracketStack.length > 0) {
    const unclosed = bracketStack.pop()!;
    errors.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 4,
      message: `SyntaxError: unclosed delimiter '${unclosed.char}'`,
      severity: 'error',
    });
  }

  return errors;
};

/**
 * Validate C-Family & Modern Compiled Languages:
 * Covers: C++, C, Rust, Go, Java, C#, PHP, JavaScript, TypeScript
 */
export const validateCFamilySyntax = (code: string, language: string): SyntaxDiagnostic[] => {
  const errors: SyntaxDiagnostic[] = [];
  if (!code.trim()) return errors;

  const stack: Array<{ char: string; line: number; col: number }> = [];
  const lines = code.split('\n');
  let inBlockComment = false;
  let inTemplateLiteral = false;
  let blockCommentStartLine = 1;

  for (let l = 0; l < lines.length; l++) {
    const lineStr = lines[l];
    const lineNum = l + 1;
    const trimmedLine = lineStr.trim();
    let inString: string | null = null;
    let isEscaped = false;

    // Check misspelled common keywords in JS/TS
    if (language === 'javascript' || language === 'typescript') {
      const typoMatches = [
        { typo: /\bconts\b/, correct: 'const' },
        { typo: /\bfuntion\b/, correct: 'function' },
        { typo: /\bretrun\b/, correct: 'return' },
        { typo: /\bimprot\b/, correct: 'import' },
        { typo: /\bexprot\b/, correct: 'export' },
      ];
      for (const t of typoMatches) {
        const m = lineStr.match(t.typo);
        if (m && m.index !== undefined) {
          errors.push({
            startLineNumber: lineNum,
            startColumn: m.index + 1,
            endLineNumber: lineNum,
            endColumn: m.index + 1 + m[0].length,
            message: `SyntaxError: Unknown keyword '${m[0]}' (did you mean '${t.correct}'?)`,
            severity: 'error',
          });
          return errors;
        }
      }

      // Check empty assignment: e.g. "const a = ;" or "let x = ;"
      const emptyAssign = lineStr.match(/(const|let|var)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*;/);
      if (emptyAssign && emptyAssign.index !== undefined) {
        const col = lineStr.indexOf('=', emptyAssign.index);
        errors.push({
          startLineNumber: lineNum,
          startColumn: col + 1,
          endLineNumber: lineNum,
          endColumn: col + 3,
          message: "SyntaxError: Unexpected ';' in assignment",
          severity: 'error',
        });
        return errors;
      }
    }

    // Check empty assignment in C++ / Java / Rust: e.g. "int x = ;"
    if (language === 'cpp' || language === 'c' || language === 'java' || language === 'csharp') {
      const emptyTypedAssign = lineStr.match(/[a-zA-Z_][a-zA-Z0-9_]*\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*;/);
      if (emptyTypedAssign && emptyTypedAssign.index !== undefined) {
        const col = lineStr.indexOf('=', emptyTypedAssign.index);
        errors.push({
          startLineNumber: lineNum,
          startColumn: col + 1,
          endLineNumber: lineNum,
          endColumn: col + 3,
          message: "SyntaxError: Expected expression after '='",
          severity: 'error',
        });
        return errors;
      }
    }

    for (let c = 0; c < lineStr.length; c++) {
      const char = lineStr[c];
      const nextChar = lineStr[c + 1];

      // Handle block comment
      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          c++;
        }
        continue;
      }

      if (!inString && !inTemplateLiteral && char === '/' && nextChar === '*') {
        inBlockComment = true;
        blockCommentStartLine = lineNum;
        c++;
        continue;
      }

      // Handle single-line comment
      if (!inString && !inTemplateLiteral && char === '/' && nextChar === '/') {
        break; // Rest of line is comment
      }

      // Handle template literals (JS / TS)
      if ((language === 'javascript' || language === 'typescript') && char === '`' && !isEscaped) {
        inTemplateLiteral = !inTemplateLiteral;
        continue;
      }

      if (inTemplateLiteral) {
        if (char === '\\') {
          isEscaped = !isEscaped;
        } else {
          isEscaped = false;
        }
        continue;
      }

      // Handle regular strings
      if (inString) {
        if (isEscaped) {
          isEscaped = false;
        } else if (char === '\\') {
          isEscaped = true;
        } else if (char === inString) {
          inString = null;
        }
        continue;
      }

      // Rust / C++ char literals vs strings
      if (char === "'" || char === '"') {
        if (char === "'" && (language === 'rust' || language === 'cpp' || language === 'c')) {
          if (nextChar && lineStr[c + 2] === "'") {
            c += 2;
            continue;
          }
          if (nextChar === '\\' && lineStr[c + 3] === "'") {
            c += 3;
            continue;
          }
          if (language === 'rust' && /[a-zA-Z_]/.test(nextChar)) {
            continue;
          }
        }

        inString = char;
        continue;
      }

      // Track opening and closing delimiters
      if (char === '{' || char === '(' || char === '[') {
        stack.push({ char, line: lineNum, col: c + 1 });
      } else if (char === '}' || char === ')' || char === ']') {
        const expected = char === '}' ? '{' : char === ')' ? '(' : '[';
        if (stack.length === 0) {
          errors.push({
            startLineNumber: lineNum,
            startColumn: c + 1,
            endLineNumber: lineNum,
            endColumn: c + 4,
            message: `SyntaxError: unexpected closing '${char}' without opening delimiter`,
            severity: 'error',
          });
          return errors;
        }
        const top = stack.pop()!;
        if (top.char !== expected) {
          errors.push({
            startLineNumber: lineNum,
            startColumn: c + 1,
            endLineNumber: lineNum,
            endColumn: c + 4,
            message: `SyntaxError: mismatched delimiter: expected '${top.char === '{' ? '}' : top.char === '(' ? ')' : ']'}' but found '${char}'`,
            severity: 'error',
          });
          return errors;
        }
      }
    }

    // Check for unterminated string on current line
    if (inString) {
      const startC = Math.max(1, lineStr.lastIndexOf(inString) + 1);
      errors.push({
        startLineNumber: lineNum,
        startColumn: startC,
        endLineNumber: lineNum,
        endColumn: lineStr.length + 2,
        message: 'SyntaxError: unterminated string literal',
        severity: 'error',
      });
      return errors;
    }
  }

  if (inTemplateLiteral) {
    errors.push({
      startLineNumber: lines.length,
      startColumn: 1,
      endLineNumber: lines.length,
      endColumn: lines[lines.length - 1].length + 4,
      message: 'SyntaxError: unterminated template literal (`)',
      severity: 'error',
    });
    return errors;
  }

  if (inBlockComment) {
    errors.push({
      startLineNumber: blockCommentStartLine,
      startColumn: 1,
      endLineNumber: lines.length,
      endColumn: lines[lines.length - 1].length + 4,
      message: 'SyntaxError: unclosed block comment (/* ... */)',
      severity: 'error',
    });
    return errors;
  }

  if (stack.length > 0) {
    const unclosed = stack.pop()!;
    errors.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 4,
      message: `SyntaxError: unclosed delimiter '${unclosed.char}'`,
      severity: 'error',
    });
  }

  return errors;
};

/**
 * Master Universal Syntax Validator
 * Dispatches code to appropriate grammar evaluator based on file extension or language
 */
export const validateUniversalSyntax = (
  code: string,
  filePathOrLang: string
): SyntaxDiagnostic[] => {
  if (!code || !code.trim()) return [];

  const language = filePathOrLang.includes('.')
    ? detectLanguageFromPath(filePathOrLang)
    : filePathOrLang.toLowerCase();

  switch (language) {
    case 'python':
      return validatePythonSyntax(code);
    case 'json':
      return validateJsonSyntax(code);
    case 'cpp':
    case 'c':
    case 'rust':
    case 'go':
    case 'java':
    case 'csharp':
    case 'php':
    case 'typescript':
    case 'javascript':
    default:
      return validateCFamilySyntax(code, language);
  }
};
