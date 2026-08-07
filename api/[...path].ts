/**
 * Vercel serverless entry point.
 *
 * An Express app is itself a `(req, res)` handler, so it can be exported
 * directly. The catch-all filename matters: it claims every path under /api
 * and, unlike a rewrite into `api/index`, leaves `req.url` as the client sent
 * it — which is what Express needs to route on.
 *
 * Single brackets, not double. `[[...path]]` is the Next.js router's optional
 * catch-all; standalone Vercel Functions only expand the single-bracket form,
 * so the double-bracket version deploys without ever claiming a route and
 * every /api request falls through to the SPA fallback instead.
 *
 * That fallback is also written to exclude /api explicitly, so this keeps
 * working regardless of how filesystem routes and rewrites are ordered.
 *
 * The app is built once at module scope, so a warm invocation reuses the same
 * Prisma client and the same /tmp copy of the database.
 */
import { createApp } from '../server/src/app.js';

export default createApp();
