import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');

// Every test process needs these before `src/config/env.ts` is first imported.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${path.join(serverRoot, 'prisma', 'test.db')}`;
process.env.JWT_SECRET = 'test-secret-value-not-used-anywhere-else';
process.env.UPLOAD_DIR = path.join(serverRoot, 'uploads-test');
process.env.AUTO_APPROVE_PHOTOS = 'true';
process.env.AUTO_VERIFY_EMAIL = 'true';
