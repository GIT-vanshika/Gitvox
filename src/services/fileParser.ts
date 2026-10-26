import { unzipSync } from 'fflate';
import { CodeFunction, LoadedProject, ProjectFile, SystemStatus } from '../types/gitvox';

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB per file
export const MAX_TOTAL_TEXT_BYTES = 10 * 1024 * 1024; // 10 MB total extracted text
export const MAX_ARCHIVE_FILES = 150;

export const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.html': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.sh': 'shell',
  '.sql': 'sql',
};

export const EXCLUDED_DIRECTORIES = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  'coverage',
  '__pycache__',
  '.venv',
  'vendor',
  '.DS_Store',
];

export class FileValidationError extends Error {
  status: SystemStatus;
  remediation: string;

  constructor(message: string, status: SystemStatus = 'Failed', remediation = '') {
    super(message);
    this.name = 'FileValidationError';
    this.status = status;
    this.remediation = remediation;
  }
}

/**
 * Validates and normalizes an archive or file path.
 * Rejects absolute paths and path traversal sequences (../).
 */
export function normalizeAndValidatePath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new FileValidationError('Empty or invalid file path.', 'Failed');
  }

  if (rawPath.includes('\0')) {
    throw new FileValidationError('File path contains unsafe null byte characters.', 'Failed');
  }

  const trimmed = rawPath.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[A-Za-z]:/.test(trimmed)) {
    throw new FileValidationError(
      `Rejected absolute path "${rawPath}". Archive paths must be relative.`,
      'Failed',
      'Repackage the archive using relative paths from the project root.'
    );
  }

  const unified = trimmed.replace(/\\/g, '/');
  const segments = unified.split('/').filter((seg) => seg.length > 0 && seg !== '.');

  if (segments.some((seg) => seg === '..')) {
    throw new FileValidationError(
      `Rejected unsafe path traversal entry "${rawPath}".`,
      'Failed',
      'Remove any "../" path traversal references before uploading.'
    );
  }

  if (segments.length === 0) {
    throw new FileValidationError('Path resolved to an empty target.', 'Failed');
  }

  return segments.join('/');
}

/**
 * Checks whether a normalized path resides inside an excluded directory (e.g. node_modules, .git).
 */
export function isExcludedPath(normalizedPath: string): boolean {
  const segments = normalizedPath.split('/');
  return segments.some(
    (seg) => EXCLUDED_DIRECTORIES.includes(seg) || seg.startsWith('.git')
  );
}

/**
 * Resolves the language identifier from a filename extension, or null if unsupported.
 */
export function getSupportedLanguage(filename: string): string | null {
  const lower = filename.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) return null;
  const ext = lower.slice(dotIdx);
  return SUPPORTED_EXTENSIONS[ext] || null;
}

/**
 * Checks if a byte buffer appears to be binary (contains null bytes or high control char ratio).
 */
export function isLikelyBinary(bytes: Uint8Array): boolean {
  const checkLength = Math.min(bytes.length, 4096);
  if (checkLength === 0) return false;
  let suspiciousCount = 0;
  for (let i = 0; i < checkLength; i++) {
    const byte = bytes[i];
    if (byte === 0) return true; // Null byte indicates binary
    if (byte < 7 || (byte > 14 && byte < 32 && byte !== 27)) {
      suspiciousCount++;
    }
  }
  return suspiciousCount / checkLength > 0.15;
}

/**
 * Extracts function/method declarations with line ranges without executing code.
 */
export function extractFunctionsFromSource(content: string, language: string): CodeFunction[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const functions: CodeFunction[] = [];

  const jsTsRegex =
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)|^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/;
  const pyRegex = /^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*:/;
  const goRegex = /^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)/;
  const rustRegex = /^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/;

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    const lineNum = idx + 1;
    let name: string | null = null;
    let params = '';

    if (['javascript', 'jsx', 'typescript', 'tsx'].includes(language)) {
      const m = jsTsRegex.exec(trimmed);
      if (m) {
        name = m[1] || m[3];
        params = m[2] ?? m[4] ?? '';
      }
    } else if (language === 'python') {
      const m = pyRegex.exec(trimmed);
      if (m) {
        name = m[1];
        params = m[2];
      }
    } else if (language === 'go') {
      const m = goRegex.exec(trimmed);
      if (m) {
        name = m[1];
        params = m[2];
      }
    } else if (language === 'rust') {
      const m = rustRegex.exec(trimmed);
      if (m) {
        name = m[1];
        params = m[2];
      }
    }

    if (name) {
      // Estimate end line by scanning up to 35 lines ahead for closing block or indentation return
      let endLine = Math.min(lines.length, lineNum + 15);
      for (let k = idx + 1; k < Math.min(lines.length, idx + 45); k++) {
        if (/^(}|\s*return\b)/.test(lines[k]) && k > idx + 1) {
          endLine = k + 1;
          if (lines[k].startsWith('}')) break;
        }
      }
      functions.push({
        name,
        startLine: lineNum,
        endLine,
        signature: `${name}(${params})`,
        summary: `Function ${name} declared on line ${lineNum} (lines ${lineNum}–${endLine}).`,
      });
    }
  });

  return functions;
}

/**
 * Validates and parses a single text-based source file into a LoadedProject.
 */
export function parseSingleSourceContent(
  filename: string,
  contentBytes: Uint8Array
): LoadedProject {
  const cleanPath = normalizeAndValidatePath(filename);
  const baseName = cleanPath.split('/').pop() || cleanPath;
  const language = getSupportedLanguage(baseName);

  if (!language) {
    throw new FileValidationError(
      `Unsupported file format for "${baseName}".`,
      'Unsupported',
      `Upload a supported source file (${Object.keys(SUPPORTED_EXTENSIONS).join(', ')}) or a ZIP archive.`
    );
  }

  if (contentBytes.byteLength === 0) {
    throw new FileValidationError(
      `File "${baseName}" is empty (0 bytes).`,
      'Failed',
      'Select a source file that contains code or text.'
    );
  }

  if (contentBytes.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new FileValidationError(
      `File "${baseName}" (${(contentBytes.byteLength / (1024 * 1024)).toFixed(2)} MB) exceeds the 2.00 MB per-file application limit.`,
      'Failed',
      'Reduce the file size below 2 MB or split generated bundles before uploading.'
    );
  }

  if (isLikelyBinary(contentBytes)) {
    throw new FileValidationError(
      `Rejected binary content in "${baseName}". Gitvox only parses text-based source files.`,
      'Unsupported',
      'Choose a UTF-8 text source file instead of a compiled binary.'
    );
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const textContent = decoder.decode(contentBytes);
  const functions = extractFunctionsFromSource(textContent, language);

  const projectFile: ProjectFile = {
    path: cleanPath,
    name: baseName,
    folder: cleanPath.includes('/') ? cleanPath.slice(0, cleanPath.lastIndexOf('/')) : '',
    language,
    sizeBytes: contentBytes.byteLength,
    content: textContent,
    functions,
  };

  return {
    id: `proj-single-${Date.now()}`,
    name: baseName,
    sourceType: 'single-file',
    description: `Uploaded single ${language} source file (${(contentBytes.byteLength / 1024).toFixed(1)} KB).`,
    files: [projectFile],
    totalSizeBytes: contentBytes.byteLength,
    excludedPaths: [],
    loadedAt: 'Local File Upload (In-Memory)',
    isCompleteScope: true,
    scopeNotice: `Single file loaded in browser memory (1 file, ${contentBytes.byteLength} bytes). Code was parsed statically and never executed.`,
  };
}

/**
 * Validates and parses a ZIP archive byte buffer in memory using fflate.
 */
export function parseZipArchiveBytes(
  archiveName: string,
  zipBytes: Uint8Array
): LoadedProject {
  if (zipBytes.byteLength === 0) {
    throw new FileValidationError(
      `Archive "${archiveName}" is empty.`,
      'Failed',
      'Provide a valid non-empty .zip archive.'
    );
  }

  if (zipBytes.byteLength > MAX_TOTAL_TEXT_BYTES) {
    throw new FileValidationError(
      `Archive "${archiveName}" exceeds the 10 MB total archive limit.`,
      'Failed',
      'Exclude build artifacts, media assets, or node_modules before creating the ZIP archive.'
    );
  }

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(zipBytes);
  } catch {
    throw new FileValidationError(
      `Malformed or corrupted ZIP archive "${archiveName}".`,
      'Failed',
      'Verify that the file is a standard ZIP archive and try again.'
    );
  }

  const entryPaths = Object.keys(unzipped);
  if (entryPaths.length === 0) {
    throw new FileValidationError(
      `ZIP archive "${archiveName}" contains no entries.`,
      'Failed',
      'Include at least one supported text source file in the archive.'
    );
  }

  const parsedFiles: ProjectFile[] = [];
  const excludedPaths: string[] = [];
  let totalSizeBytes = 0;
  const decoder = new TextDecoder('utf-8', { fatal: false });

  // Strip common top-level wrapper folder if all entries share one root directory
  const normalizedEntries = entryPaths
    .filter((p) => !p.endsWith('/'))
    .map((rawPath) => normalizeAndValidatePath(rawPath));

  const firstSegments = new Set(
    normalizedEntries.map((p) => (p.includes('/') ? p.split('/')[0] : ''))
  );
  const stripRootPrefix =
    firstSegments.size === 1 && !firstSegments.has('')
      ? `${Array.from(firstSegments)[0]}/`
      : '';

  for (const rawPath of entryPaths) {
    if (rawPath.endsWith('/')) continue; // Directory placeholder

    const validPath = normalizeAndValidatePath(rawPath);
    const relativePath =
      stripRootPrefix && validPath.startsWith(stripRootPrefix)
        ? validPath.slice(stripRootPrefix.length)
        : validPath;

    if (!relativePath) continue;

    if (isExcludedPath(relativePath)) {
      excludedPaths.push(relativePath);
      continue;
    }

    const baseName = relativePath.split('/').pop() || relativePath;
    const language = getSupportedLanguage(baseName);
    const fileBytes = unzipped[rawPath];

    if (!language) {
      excludedPaths.push(`${relativePath} (unsupported extension)`);
      continue;
    }

    if (fileBytes.byteLength > MAX_FILE_SIZE_BYTES) {
      throw new FileValidationError(
        `Archive entry "${relativePath}" exceeds the 2 MB per-file limit.`,
        'Failed',
        'Remove large generated bundles or data dumps from the ZIP archive.'
      );
    }

    if (isLikelyBinary(fileBytes)) {
      throw new FileValidationError(
        `Archive entry "${relativePath}" contains binary data despite its source extension.`,
        'Unsupported',
        'Remove binary files from source extensions before uploading.'
      );
    }

    totalSizeBytes += fileBytes.byteLength;
    if (totalSizeBytes > MAX_TOTAL_TEXT_BYTES) {
      throw new FileValidationError(
        `Decompressed text exceeds the 10 MB application limit while reading "${relativePath}".`,
        'Failed',
        'Reduce the archive size by excluding vendor directories, test fixtures, or generated documentation.'
      );
    }

    if (parsedFiles.length >= MAX_ARCHIVE_FILES) {
      throw new FileValidationError(
        `Archive exceeds the maximum limit of ${MAX_ARCHIVE_FILES} supported source files.`,
        'Failed',
        `Upload a focused subdirectory or package with ${MAX_ARCHIVE_FILES} source files or fewer.`
      );
    }

    const textContent = decoder.decode(fileBytes);
    const functions = extractFunctionsFromSource(textContent, language);

    parsedFiles.push({
      path: relativePath,
      name: baseName,
      folder: relativePath.includes('/')
        ? relativePath.slice(0, relativePath.lastIndexOf('/'))
        : '',
      language,
      sizeBytes: fileBytes.byteLength,
      content: textContent,
      functions,
    });
  }

  if (parsedFiles.length === 0) {
    throw new FileValidationError(
      `No supported text-based source files were found in "${archiveName}".`,
      'Unsupported',
      `Include source files (${Object.keys(SUPPORTED_EXTENSIONS).slice(0, 8).join(', ')}, etc.) outside excluded directories.`
    );
  }

  parsedFiles.sort((a, b) => a.path.localeCompare(b.path));
  const cleanTitle = archiveName.replace(/\.zip$/i, '');

  return {
    id: `proj-zip-${Date.now()}`,
    name: cleanTitle,
    sourceType: 'zip-archive',
    description: `Parsed ZIP archive containing ${parsedFiles.length} source file${
      parsedFiles.length === 1 ? '' : 's'
    } (${(totalSizeBytes / 1024).toFixed(1)} KB total).`,
    files: parsedFiles,
    totalSizeBytes,
    excludedPaths,
    loadedAt: 'Local ZIP Upload (In-Memory)',
    isCompleteScope: excludedPaths.length === 0,
    scopeNotice:
      excludedPaths.length > 0
        ? `Loaded ${parsedFiles.length} supported source files (${(totalSizeBytes / 1024).toFixed(
            1
          )} KB). Excluded ${excludedPaths.length} dependency/non-source entries.`
        : `All ${parsedFiles.length} archive files loaded in memory (${(
            totalSizeBytes / 1024
          ).toFixed(1)} KB).`,
  };
}
