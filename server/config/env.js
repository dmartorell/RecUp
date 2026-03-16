import 'dotenv/config';

function required(key) {
  const val = process.env[key];
  if (!val) {
    console.error(`[FATAL] Missing required env var: ${key}`);
    process.exit(1);
  }
  return val;
}

function optional(key, fallback) {
  return process.env[key] || fallback;
}

export const config = {
  port: optional('PORT', '3000'),
  jwtSecret: required('JWT_SECRET'),
  anthropicApiKey: optional('ANTHROPIC_API_KEY', ''),
  clickupApiKey: optional('CLICKUP_API_KEY', ''),
  clickupListId: optional('CLICKUP_LIST_ID', ''),
  allowedEmailDomain: optional('ALLOWED_EMAIL_DOMAIN', ''),
  tursoUrl: required('TURSO_DATABASE_URL'),
  tursoAuthToken: optional('TURSO_AUTH_TOKEN', ''),
};
