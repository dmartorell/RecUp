// ClickUp
export const CLICKUP_CUSTOM_FIELD_IDS = {
  reporter: 'c9fb2e87-b7a9-4646-9292-d74225f4e2d3',
  assetId: '3aedd038-ce17-4325-9dfb-10ba2a85d89d',
  dispositivo: 'b07abf0c-7bae-405d-a107-31af17c98867',
  versionApp: '660974a4-2eef-4dd3-bbbd-0c50eaea0216',
  captura: '567894b1-a0bf-4ae5-926d-5e0a4d55a982',
};
export const CLICKUP_CACHE_TTL = 10 * 60 * 1000;

// Claude / Summarize
export const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
export const CLAUDE_MAX_TOKENS = 1024;
export const CLAUDE_TEMPERATURE = 0.3;
export const SUMMARIZE_TIMEOUT_MS = 30_000;

// Auth
export const JWT_EXPIRES_IN = '30d';

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 10;

// Multer
export const MULTER_MAX_FILE_SIZE = 100 * 1024 * 1024;
export const MULTER_MAX_FILES = 5;
