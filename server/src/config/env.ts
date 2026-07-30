import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

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
   * Handy for local development; should stay false in production.
   */
  AUTO_APPROVE_PHOTOS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /**
   * When true, accounts skip email verification. Set automatically in tests.
   */
  AUTO_VERIFY_EMAIL: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  uploadRoot: path.isAbsolute(raw.UPLOAD_DIR)
    ? raw.UPLOAD_DIR
    : path.join(SERVER_ROOT, raw.UPLOAD_DIR),
};

if (env.isProduction && raw.JWT_SECRET === 'dev-only-secret-change-me-in-production') {
  throw new Error('JWT_SECRET must be set to a real secret when NODE_ENV=production');
}
