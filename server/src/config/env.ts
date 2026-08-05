import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

/**
 * A Vercel *preview* deployment — not production. Previews are created without
 * a chance to attach secrets, so a few defaults below relax for them only; the
 * production guards are untouched.
 */
const isVercelPreview = Boolean(process.env.VERCEL) && process.env.VERCEL_ENV !== 'production';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),

  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-in-production'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(6 * 1024 * 1024),
  MAX_PHOTOS_PER_USER: z.coerce.number().int().positive().default(8),

  /** Minimum age to register. The UK age of consent for marriage is 18. */
  MIN_AGE: z.coerce.number().int().default(18),

  /**
   * When true, new photos are auto-approved instead of queued for a moderator.
   * Handy for local development and for previews, where there is no moderator
   * on hand; should stay false in production.
   */
  AUTO_APPROVE_PHOTOS: z
    .string()
    .default(isVercelPreview ? 'true' : 'false')
    .transform((v) => v === 'true'),

  /**
   * When true, accounts skip email verification. Set automatically in tests,
   * and on previews, where there is no mail delivery to confirm through.
   */
  AUTO_VERIFY_EMAIL: z
    .string()
    .default(isVercelPreview ? 'true' : 'false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

const DEV_SECRET = 'dev-only-secret-change-me-in-production';

/**
 * Preview deployments mint a random signing key per instance rather than
 * shipping a real secret in the repository. Sessions therefore last only as
 * long as the instance does — which is exactly how long the preview's
 * scratch database lasts anyway, so the two expire together.
 */
const jwtSecret =
  raw.JWT_SECRET === DEV_SECRET && isVercelPreview
    ? crypto.randomBytes(48).toString('base64url')
    : raw.JWT_SECRET;

export const env = {
  ...raw,
  JWT_SECRET: jwtSecret,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  uploadRoot: path.isAbsolute(raw.UPLOAD_DIR)
    ? raw.UPLOAD_DIR
    : path.join(SERVER_ROOT, raw.UPLOAD_DIR),
};

// `env` is imported by `lib/runtime.ts`, so the upload override is applied here
// rather than there — importing runtime from this module would be a cycle.
if (process.env.VERCEL) {
  (env as { uploadRoot: string }).uploadRoot = '/tmp/uploads';
}

// Real production still has to bring its own secret.
if (env.isProduction && !isVercelPreview && raw.JWT_SECRET === DEV_SECRET) {
  throw new Error('JWT_SECRET must be set to a real secret when NODE_ENV=production');
}
