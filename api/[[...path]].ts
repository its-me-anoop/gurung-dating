/**
 * Vercel serverless entry point.
 *
 * An Express app is itself a `(req, res)` handler, so it can be exported
 * directly. The optional catch-all filename matters: it claims every path under
 * /api and, unlike a rewrite into `api/index`, leaves `req.url` as the client
 * sent it — which is what Express needs to route on.
 *
 * Vercel resolves filesystem routes before `rewrites`, so /api/* lands here
 * while every other path falls through to the SPA fallback in vercel.json.
 *
 * The app is built once at module scope, so a warm invocation reuses the same
 * Prisma client and the same /tmp copy of the database.
 */
import { createApp } from '../server/src/app.js';

export default createApp();
