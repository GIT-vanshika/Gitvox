import { LoadedProject } from '../types/gitvox';
import { SAMPLE_PULL_REQUEST } from './samplePullRequest';

export const SAMPLE_PROJECT: LoadedProject = {
  id: 'proj-acme-api-server',
  name: 'acme-platform/api-server',
  sourceType: 'sample',
  description:
    'Built-in sample Express API service demonstrating token-based authentication middleware, HMAC-SHA256 token issuance, scoped route protection, and audit logging.',
  totalSizeBytes: 5420,
  excludedPaths: ['node_modules/', 'dist/', '.git/'],
  loadedAt: 'Built-in Sample Repository',
  isCompleteScope: true,
  scopeNotice:
    'Sample workspace loaded in memory (7 source files, 5.4 KB). All files are within analysis bounds.',
  files: [
    {
      path: 'src/middleware/auth.js',
      name: 'auth.js',
      folder: 'src/middleware',
      language: 'javascript',
      sizeBytes: 1124,
      content: SAMPLE_PULL_REQUEST.files[0].proposedContent,
      functions: [
        {
          name: 'authenticateRequest',
          startLine: 5,
          endLine: 27,
          signature: 'authenticateRequest(req, res, next)',
          summary:
            'Extracts Bearer token from Authorization header, verifies HMAC signature via tokenService, checks exp timestamp, and populates req.user.',
        },
        {
          name: 'requireScope',
          startLine: 29,
          endLine: 36,
          signature: 'requireScope(requiredScope)',
          summary:
            'Higher-order Express middleware factory that verifies req.user.scopes contains the required permission string.',
        },
      ],
    },
    {
      path: 'src/services/tokenService.js',
      name: 'tokenService.js',
      folder: 'src/services',
      language: 'javascript',
      sizeBytes: 1048,
      content: SAMPLE_PULL_REQUEST.files[1].proposedContent,
      functions: [
        {
          name: 'issueAccessToken',
          startLine: 7,
          endLine: 13,
          signature: 'issueAccessToken({ sub, role, scopes })',
          summary:
            'Creates a base64url-encoded JSON payload with iat and exp claims and signs it with HMAC-SHA256 prefixed by v1.',
        },
        {
          name: 'verifyAccessToken',
          startLine: 15,
          endLine: 23,
          signature: 'verifyAccessToken(token)',
          summary:
            'Validates 3-part v1 token structure, recomputes HMAC-SHA256 signature, and parses the JSON claims.',
        },
        {
          name: 'getTokenTtl',
          startLine: 25,
          endLine: 27,
          signature: 'getTokenTtl()',
          summary: 'Returns the configured token time-to-live in seconds (3600s).',
        },
      ],
    },
    {
      path: 'src/routes/userRoutes.js',
      name: 'userRoutes.js',
      folder: 'src/routes',
      language: 'javascript',
      sizeBytes: 792,
      content: SAMPLE_PULL_REQUEST.files[2].proposedContent,
      functions: [
        {
          name: 'GET /profile',
          startLine: 7,
          endLine: 13,
          signature: "router.get('/profile', authenticateRequest, ...)",
          summary:
            'Returns the authenticated user ID, role, and granted scopes from req.user.',
        },
        {
          name: 'POST /token/refresh',
          startLine: 15,
          endLine: 22,
          signature: "router.post('/token/refresh', authenticateRequest, requireScope('auth:refresh'), ...)",
          summary:
            'Issues a fresh access token when the caller holds the auth:refresh scope.',
        },
      ],
    },
    {
      path: 'src/utils/validateToken.js',
      name: 'validateToken.js',
      folder: 'src/utils',
      language: 'javascript',
      sizeBytes: 634,
      content: SAMPLE_PULL_REQUEST.files[3].proposedContent,
      functions: [
        {
          name: 'extractBearerToken',
          startLine: 1,
          endLine: 7,
          signature: 'extractBearerToken(headerValue)',
          summary:
            'Parses an HTTP Authorization header and extracts the raw token following the Bearer scheme.',
        },
        {
          name: 'validateTokenStructure',
          startLine: 9,
          endLine: 18,
          signature: 'validateTokenStructure(rawToken)',
          summary:
            'Splits a raw token string on dots and ensures it contains 3 segments starting with version prefix v1.',
        },
      ],
    },
    {
      path: 'src/utils/auditLogger.js',
      name: 'auditLogger.js',
      folder: 'src/utils',
      language: 'javascript',
      sizeBytes: 495,
      content: [
        'export function logSecurityEvent(eventType, metadata = {}) {',
        '  const entry = {',
        '    timestamp: new Date().toISOString(),',
        '    eventType,',
        '    ...metadata,',
        '  };',
        '  if (process.env.NODE_ENV !== "test") {',
        '    console.warn("[SECURITY_AUDIT]", JSON.stringify(entry));',
        '  }',
        '  return entry;',
        '}',
      ].join('\n'),
      functions: [
        {
          name: 'logSecurityEvent',
          startLine: 1,
          endLine: 11,
          signature: 'logSecurityEvent(eventType, metadata)',
          summary:
            'Constructs a structured ISO-timestamped security audit event and logs it outside test environments.',
        },
      ],
    },
    {
      path: 'tests/auth.test.js',
      name: 'auth.test.js',
      folder: 'tests',
      language: 'javascript',
      sizeBytes: 765,
      content: SAMPLE_PULL_REQUEST.files[4].proposedContent,
      functions: [
        {
          name: 'runAuthSuite',
          startLine: 5,
          endLine: 19,
          signature: 'runAuthSuite()',
          summary:
            'Executes unit assertions covering missing headers, valid signed tokens, and tampered signature rejection.',
        },
      ],
    },
    {
      path: 'README.md',
      name: 'README.md',
      folder: '',
      language: 'markdown',
      sizeBytes: 562,
      content: [
        '# acme-platform/api-server',
        '',
        'Internal REST API gateway responsible for session validation, scoped token issuance, and user profile routing.',
        '',
        '## Architecture',
        '- `src/middleware/auth.js`: Request authentication and scope guards.',
        '- `src/services/tokenService.js`: HMAC-SHA256 v1 token signing and verification.',
        '- `src/routes/userRoutes.js`: Protected profile and token refresh endpoints.',
        '- `src/utils/validateToken.js`: Header extraction and structural validation.',
        '- `src/utils/auditLogger.js`: Structured security audit logging.',
      ].join('\n'),
      functions: [],
    },
  ],
};
