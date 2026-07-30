import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Some of the details you sent are not valid.',
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  // Multer surfaces upload problems as errors with a `code` field.
  const maybeMulter = err as { code?: string; message?: string };
  if (maybeMulter?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: `That image is too large. The limit is ${Math.round(env.MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`,
      },
    });
    return;
  }

  // Prisma unique-constraint violations that slipped past an explicit check.
  const maybePrisma = err as { code?: string; meta?: { target?: string[] } };
  if (maybePrisma?.code === 'P2002') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'That already exists.', details: maybePrisma.meta },
    });
    return;
  }

  if (!env.isTest) {
    // eslint-disable-next-line no-console
    console.error('[unhandled]', err);
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong on our side. Please try again.',
      ...(env.isProduction ? {} : { debug: String((err as Error)?.stack ?? err) }),
    },
  });
}

/** Wraps an async handler so rejected promises reach the error middleware. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => unknown>(
  fn: T,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
