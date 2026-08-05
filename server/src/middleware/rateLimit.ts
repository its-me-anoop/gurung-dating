import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const disabled = env.isTest;

function make(options: { windowMs: number; max: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: disabled ? 100_000 : options.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: options.message } });
    },
  });
}

/** Broad ceiling for the whole API. */
export const generalLimiter = make({
  windowMs: 60_000,
  max: 300,
  message: 'Too many requests. Please slow down for a moment.',
});

/** Sign-in and registration: slow enough to make credential stuffing painful. */
export const authLimiter = make({
  windowMs: 15 * 60_000,
  max: 20,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

/** Messaging and interests: enough for real use, not enough to spray the site. */
export const contactLimiter = make({
  windowMs: 60 * 60_000,
  max: 120,
  message: 'You have sent a lot of messages in a short time. Please take a break.',
});

export const uploadLimiter = make({
  windowMs: 60 * 60_000,
  max: 40,
  message: 'Too many uploads. Please try again later.',
});
