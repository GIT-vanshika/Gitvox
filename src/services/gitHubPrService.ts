import { PullRequestData, PRFileChange } from '../types/gitvox';
import { detectLanguageFromPath } from './unifiedSyntaxEngine';

export interface GitHubPrCoordinates {
  owner: string;
  repo: string;
  pullNumber: number;
}

/**
 * Extracts owner, repo, and pull number from diverse URL shapes:
 * - https://github.com/owner/repo/pull/123
 * - github.com/owner/repo/pull/123
 * - owner/repo/pull/123
 * - owner/repo#123
 */
export function parseGitHubPrUrl(input: string): GitHubPrCoordinates | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  const fullRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i;
  const match = trimmed.match(fullRegex);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
      pullNumber: parseInt(match[3], 10),
    };
  }

  const slashRegex = /^([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i;
  const slashMatch = trimmed.match(slashRegex);
  if (slashMatch) {
    return {
      owner: slashMatch[1],
      repo: slashMatch[2],
      pullNumber: parseInt(slashMatch[3], 10),
    };
  }

  const hashRegex = /^([^/\s]+)\/([^/#\s]+)#(\d+)$/;
  const hashMatch = trimmed.match(hashRegex);
  if (hashMatch) {
    return {
      owner: hashMatch[1],
      repo: hashMatch[2],
      pullNumber: parseInt(hashMatch[3], 10),
    };
  }

  return null;
}

/**
 * Parses a standard Git unified diff or patch file into a complete PullRequestData object.
 */
export function parseGitPatchToPullRequest(
  patchText: string,
  meta: GitHubPrCoordinates & { title?: string; author?: string; branch?: string }
): PullRequestData {
  if (!patchText || patchText.trim().length === 0) {
    throw new Error('Patch content is empty. Ensure the GitHub PR has commits and file changes.');
  }

  const authorMatch = patchText.match(/^From:\s*(.+)$/m);
  const subjectMatch = patchText.match(/^Subject:\s*(?:\[PATCH[^\]]*\]\s*)?(.+)$/m);

  const title = meta.title || (subjectMatch ? subjectMatch[1].trim() : `PR #${meta.pullNumber}`);
  const author = meta.author || (authorMatch ? authorMatch[1].trim().replace(/<.*?>/, '').trim() : 'contributor');

  const rawFiles = patchText.split(/\ndiff --git a\//).slice(1);
  if (rawFiles.length === 0) {
    // If no git diff headers found, check if it is a pure diff format without patch envelope
    const rawDiffs = patchText.split(/^diff --git a\//m).filter((c) => c.trim().length > 0);
    if (rawDiffs.length > 0) {
      rawFiles.push(...rawDiffs);
    }
  }

  let totalAdd = 0;
  let totalDel = 0;

  const files: PRFileChange[] = rawFiles.map((chunk, idx) => {
    const lines = chunk.split('\n');
    const headerLine = lines[0] || '';
    let filePath = headerLine.split(/\s+b\//)[0].trim();
    if (!filePath || filePath.startsWith('---') || filePath.startsWith('+++')) {
      filePath = `file-${idx + 1}`;
    }

    let addCount = 0;
    let delCount = 0;
    const baseLines: string[] = [];
    const propLines: string[] = [];
    let inHunk = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      if (!inHunk) continue;
      if (line.startsWith('+')) {
        addCount++;
        propLines.push(line.slice(1));
      } else if (line.startsWith('-')) {
        delCount++;
        baseLines.push(line.slice(1));
      } else if (line.startsWith(' ')) {
        baseLines.push(line.slice(1));
        propLines.push(line.slice(1));
      } else if (line.startsWith('\\ No newline')) {
        continue;
      } else {
        baseLines.push(line);
        propLines.push(line);
      }
    }

    totalAdd += addCount;
    totalDel += delCount;
    const lang = detectLanguageFromPath(filePath);

    return {
      path: filePath,
      language: lang,
      summary: `+${addCount} / -${delCount} lines modified in ${filePath.split('/').pop()}`,
      baseContent: baseLines.join('\n'),
      proposedContent: propLines.join('\n'),
      expectedAdditions: addCount,
      expectedDeletions: delCount,
    };
  });

  return {
    id: `gh-${meta.owner}-${meta.repo}-${meta.pullNumber}`,
    number: meta.pullNumber,
    title,
    repository: `${meta.owner}/${meta.repo}`,
    author,
    sourceBranch: meta.branch || `pr-${meta.pullNumber}`,
    targetBranch: 'main',
    status: 'Open',
    ciStatus: 'Passed',
    isSampleData: false,
    filesChangedCount: files.length,
    additionsCount: totalAdd,
    deletionsCount: totalDel,
    overview: `Pull request #${meta.pullNumber} imported from ${meta.owner}/${meta.repo}. Modifies ${files.length} files with +${totalAdd} / -${totalDel} diff changes.`,
    purpose: title,
    files,
  };
}

/**
 * Fetches a GitHub PR and builds a genuine PullRequestData object.
 * Attempts server proxy endpoint /api/github/pr first, and falls back to
 * raw patch CDN / CORS proxy if running client-only.
 */
export async function fetchGitHubPullRequest(input: string): Promise<PullRequestData> {
  const coords = parseGitHubPrUrl(input);
  if (!coords) {
    throw new Error(
      'Invalid GitHub PR URL. Please enter a valid URL such as "https://github.com/facebook/react/pull/31200" or "owner/repo#123".'
    );
  }

  // 1. Try Gitvox server API bridge (/api/github/pr)
  try {
    const res = await fetch('/api/github/pr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: input, ...coords }),
    });
    if (res.ok) {
      const data = (await res.json()) as { pullRequest?: PullRequestData };
      if (data.pullRequest && Array.isArray(data.pullRequest.files)) {
        return data.pullRequest;
      }
    }
  } catch {
    // Backend bridge unreachable (e.g. static Vite server), fall through to raw fetch
  }

  // 2. Fetch directly from GitHub patch CDN or public CORS proxy
  const rawPatchUrl = `https://patch-diff.githubusercontent.com/raw/${coords.owner}/${coords.repo}/pull/${coords.pullNumber}.patch`;
  let patchText = '';

  try {
    const directRes = await fetch(rawPatchUrl, {
      headers: { 'User-Agent': 'Gitvox-App' },
    });
    if (directRes.ok) {
      patchText = await directRes.text();
    }
  } catch {
    // Direct browser fetch hit CORS or network restriction
  }

  if (!patchText) {
    // Try CORS proxy fallback
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawPatchUrl)}`;
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        patchText = await proxyRes.text();
      }
    } catch {
      // Proxy failed
    }
  }

  if (!patchText) {
    throw new Error(
      `Could not load PR #${coords.pullNumber} from GitHub repository "${coords.owner}/${coords.repo}". Verify that the repository is public and the PR number exists.`
    );
  }

  return parseGitPatchToPullRequest(patchText, coords);
}

