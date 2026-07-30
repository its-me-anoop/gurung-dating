import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/tokens.js';

export interface AuthedUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  // The refresh cookie is httpOnly; the access token may also arrive as a
  // cookie when the SPA is served from the same origin.
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.accessToken;
  return cookie ?? null;
}

/**
 * Populates `req.user` when a valid access token is present. Does not reject —
 * use `requireAuth` for that. Lets public endpoints tailor their response for
 * signed-in visitors.
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return next();

  try {
    const claims = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, role: true, status: true },
    });
    if (user) req.user = user;
  } catch {
    // An expired or malformed token simply means "not signed in" here; the
    // client is expected to hit /auth/refresh and retry.
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.status === 'SUSPENDED') {
    return next(forbidden('Your account is suspended. Please contact support.'));
  }
  if (req.user.status === 'DEACTIVATED') {
    return next(forbidden('Your account is deactivated. Reactivate it from your settings.'));
  }
  next();
}

/** Auth plus a verified email — required before contacting other members. */
export function requireActive(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (req.user!.status === 'PENDING_VERIFICATION') {
      return next(forbidden('Please confirm your email address first.'));
    }
    next();
  });
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (err?: unknown) => {
      if (err) return next(err);
      if (!roles.includes(req.user!.role)) return next(forbidden());
      next();
    });
  };
}

/**
 * Records activity at most once a minute per user, so a busy session does not
 * turn every request into a write.
 */
const lastTouch = new Map<string, number>();
const TOUCH_INTERVAL_MS = 60_000;

export function touchActivity(req: Request, _res: Response, next: NextFunction) {
  const id = req.user?.id;
  if (!id) return next();
  const now = Date.now();
  const previous = lastTouch.get(id) ?? 0;
  if (now - previous > TOUCH_INTERVAL_MS) {
    lastTouch.set(id, now);
    prisma.user
      .update({ where: { id }, data: { lastActiveAt: new Date() } })
      .catch(() => undefined);
  }
  next();
}
