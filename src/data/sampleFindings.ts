import { ReviewFinding } from '../types/gitvox';

export const SAMPLE_FINDINGS: ReviewFinding[] = [
  {
    id: 'finding-1',
    title: 'Hardcoded fallback signing secret when TOKEN_SECRET is unset',
    severity: 'high',
    filePath: 'src/services/tokenService.js',
    startLine: 5,
    endLine: 5,
    summary:
      'Falls back to a static string ("dev-fallback-secret-key") if process.env.TOKEN_SECRET is missing.',
    explanation:
      'In src/services/tokenService.js on line 5, SIGNING_SECRET defaults to a known string literal when process.env.TOKEN_SECRET is undefined. If an environment misconfiguration occurs in staging or production, an attacker could forge valid v1 HMAC-SHA256 bearer tokens for any user ID and role.',
    evidence: 'const SIGNING_SECRET = process.env.TOKEN_SECRET || \'dev-fallback-secret-key\';',
    uncertainty:
      'Sample Review Finding (Illustrative): Whether process.env.TOKEN_SECRET is enforced at process startup outside this PR diff cannot be verified from the 5 changed files alone.',
    isSampleContent: true,
  },
  {
    id: 'finding-2',
    title: 'Non-constant-time signature comparison in verifyAccessToken',
    severity: 'medium',
    filePath: 'src/services/tokenService.js',
    startLine: 18,
    endLine: 20,
    summary:
      'Uses standard !== string comparison instead of crypto.timingSafeEqual for HMAC verification.',
    explanation:
      'In src/services/tokenService.js (lines 18–20), parts.signature !== expectedSig compares HMAC digests using JavaScript string inequality. Standard string comparison exits on the first mismatched byte, which can expose subtle timing side-channels over high-volume requests.',
    evidence: 'if (parts.signature !== expectedSig) {\n  throw new Error("Invalid token signature");\n}',
    uncertainty:
      'Sample Review Finding (Illustrative): Practical exploitability depends on network jitter and rate limiting configured on upstream gateways.',
    isSampleContent: true,
  },
  {
    id: 'finding-3',
    title: 'Token expiration check occurs after verifyAccessToken only in middleware',
    severity: 'medium',
    filePath: 'src/middleware/auth.js',
    startLine: 12,
    endLine: 16,
    summary:
      'Expiration (payload.exp) is checked in authenticateRequest rather than inside verifyAccessToken.',
    explanation:
      'In src/middleware/auth.js (lines 12–16), authenticateRequest checks payload.exp after calling verifyAccessToken(token). Any future caller that invokes verifyAccessToken() directly from tokenService.js without duplicating the exp check will accept expired tokens.',
    evidence: 'const payload = verifyAccessToken(token);\nif (payload.exp && Date.now() >= payload.exp * 1000) {',
    uncertainty:
      'Sample Review Finding (Illustrative): Currently authenticateRequest is the only caller in the loaded repository.',
    isSampleContent: true,
  },
  {
    id: 'finding-4',
    title: 'Missing test assertion for expired token rejection path',
    severity: 'low',
    filePath: 'tests/auth.test.js',
    startLine: 8,
    endLine: 19,
    summary:
      'runAuthSuite verifies missing headers, valid tokens, and tampered signatures, but not expired tokens.',
    explanation:
      'In tests/auth.test.js (lines 8–19), the updated test suite validates 401 on missing header, 200/next on valid token, and 403 on tampered signature, but does not exercise the payload.exp expiration branch added in src/middleware/auth.js.',
    evidence: 'const tamperedRes = invokeMiddleware({ authorization: `Bearer ${signedToken}x` });',
    uncertainty:
      'Sample Review Finding (Illustrative): Integration tests outside tests/auth.test.js may cover token TTL expiration.',
    isSampleContent: true,
  },
];
