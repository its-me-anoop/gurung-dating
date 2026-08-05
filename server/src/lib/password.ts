import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// Cheaper rounds under test keep the suite fast; production gets the real cost.
const ROUNDS = env.isTest ? 4 : 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Password rules, kept deliberately modest: length does more for safety than
 * character-class gymnastics, and awkward rules push people towards reuse.
 */
export function describePasswordRules(): string {
  return 'At least 10 characters, including a letter and a number.';
}

export function isAcceptablePassword(plain: string): boolean {
  return plain.length >= 10 && /[a-zA-Z]/.test(plain) && /[0-9]/.test(plain);
}
