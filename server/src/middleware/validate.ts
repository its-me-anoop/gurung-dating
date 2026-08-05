import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validates one part of the request and replaces it with the parsed result, so
 * handlers work with typed, coerced data and never touch the raw input.
 */
export function validate<T extends ZodTypeAny>(schema: T, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        badRequest(
          'Some of the details you sent are not valid.',
          result.error.issues.map((i) => ({
            field: i.path.join('.') || source,
            message: i.message,
          })),
        ),
      );
    }
    // `req.query` is a getter on Express 5-style requests; assigning to a local
    // stash keeps both versions working.
    if (source === 'query') {
      (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    } else {
      req[source] = result.data as never;
    }
    next();
  };
}

/** Reads what `validate(schema, 'query')` stashed. */
export function validatedQuery<T>(req: Request): T {
  return (req as Request & { validatedQuery?: T }).validatedQuery as T;
}

/** Query-string helpers: browsers send everything as strings. */
export const zBoolish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

export const zCsv = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')))
  .transform((v) => v.map((s) => s.trim()).filter(Boolean));

export const zPagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});
