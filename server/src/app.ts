import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { runtime } from './lib/runtime.js';
import { attachUser, touchActivity } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { discoveryRouter } from './routes/discovery.js';
import { interestRouter } from './routes/interests.js';
import { messageRouter } from './routes/messages.js';
import { notificationRouter } from './routes/notifications.js';
import { photoRouter } from './routes/photos.js';
import { profileRouter } from './routes/profiles.js';
import { referenceRouter } from './routes/reference.js';
import { safetyRouter } from './routes/safety.js';

export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy in production, so `req.ip` and the secure-cookie
  // check both need the forwarded headers.
  app.set('trust proxy', env.isProduction ? 1 : false);

  app.use(
    helmet({
      // Images are served from this origin to a separate SPA origin in dev.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  // The delegate form is used so the request's own host can be consulted: when
  // the SPA is served from the same deployment as the API (as it is on Vercel,
  // where the hostname is only known at runtime), the origin is trivially
  // allowed without having to enumerate every preview URL.
  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      const sameOrigin =
        origin !== undefined && req.headers.host !== undefined
          ? origin === `https://${req.headers.host}` || origin === `http://${req.headers.host}`
          : false;

      // Same-origin and server-to-server calls arrive without an Origin header.
      const allowed = !origin || sameOrigin || env.corsOrigins.includes(origin);
      callback(allowed ? null : new Error(`Origin ${origin} is not allowed`), {
        origin: allowed,
        credentials: true,
      });
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  app.use(generalLimiter);
  app.use(attachUser);
  app.use(touchActivity);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'tamu-sansar-api',
      // `ephemeral` means this instance is running against a scratch copy of the
      // seeded database that resets on cold start — see lib/runtime.ts.
      storage: runtime.storage,
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/reference', referenceRouter);
  app.use('/api/profiles', profileRouter);
  app.use('/api/discovery', discoveryRouter);
  app.use('/api/interests', interestRouter);
  app.use('/api/photos', photoRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', messageRouter);
  app.use('/api', safetyRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
