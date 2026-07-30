import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');
const testDbPath = path.join(serverRoot, 'prisma', 'test.db');

/**
 * Builds a fresh SQLite file for the suite. Running once per suite (rather than
 * per file) keeps it fast; individual tests clean up after themselves.
 */
export async function setup() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `file:${testDbPath}`;

  for (const suffix of ['', '-journal']) {
    fs.rmSync(`${testDbPath}${suffix}`, { force: true });
  }

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: 'pipe',
  });
}

export async function teardown() {
  for (const suffix of ['', '-journal']) {
    fs.rmSync(`${testDbPath}${suffix}`, { force: true });
  }
  fs.rmSync(path.join(serverRoot, 'uploads-test'), { recursive: true, force: true });
}
