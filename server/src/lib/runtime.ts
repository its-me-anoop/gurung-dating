import fs from 'node:fs';
import path from 'node:path';
import { SERVER_ROOT } from '../config/env.js';

/**
 * Serverless bootstrap.
 *
 * On Vercel the deployment filesystem is read-only and every instance is
 * short-lived, so a SQLite file shipped with the build cannot be written to.
 * The demo copies it into /tmp on cold start and points Prisma there, which
 * makes the whole site work — sign in, search, interests, messaging — against
 * a per-instance scratch copy.
 *
 * The trade-off is deliberate and only appropriate for a preview: writes live
 * as long as the instance does, concurrent instances do not share them, and a
 * cold start resets everything to the seeded state. A real deployment points
 * DATABASE_URL at a hosted Postgres instead, which is a datasource change in
 * schema.prisma and nothing more — no application code depends on SQLite.
 */

const isServerless = Boolean(process.env.VERCEL);

/** Where a writable copy of the database lives on a serverless instance. */
const SCRATCH_DB = '/tmp/tamu-sansar.db';

/**
 * Returns the datasource URL Prisma should use, preparing a writable copy of
 * the seeded database first when running serverless.
 */
export function resolveDatabaseUrl(configuredUrl: string): string {
  if (!isServerless) return configuredUrl;

  if (!fs.existsSync(SCRATCH_DB)) {
    const bundled = findBundledDatabase();
    if (bundled) {
      fs.copyFileSync(bundled, SCRATCH_DB);
    } else {
      // Without the seeded file Prisma would fail on the first query with a
      // confusing "table does not exist". Say what actually went wrong.
      throw new Error(
        'No seeded database was bundled with this deployment. The build step ' +
          'should run `prisma db push` and the seed before `vite build`.',
      );
    }
  }

  return `file:${SCRATCH_DB}`;
}

/** Locates the read-only database shipped in the deployment bundle. */
function findBundledDatabase(): string | null {
  const candidates = [
    path.join(SERVER_ROOT, 'prisma', 'preview.db'),
    path.join(process.cwd(), 'server', 'prisma', 'preview.db'),
    path.join(process.cwd(), 'prisma', 'preview.db'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

export const runtime = {
  isServerless,
  /** Shown on /api/health so it is obvious which mode a deployment is in. */
  storage: isServerless ? ('ephemeral' as const) : ('persistent' as const),
};
