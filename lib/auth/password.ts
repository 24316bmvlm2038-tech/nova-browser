import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number; maxmem?: number }
) => Promise<Buffer>;

/**
 * scrypt from node:crypto — deliberately no bcrypt/argon2 dependency, since
 * scrypt is a memory-hard KDF that ships with Node and needs no native build.
 * N=2^15 costs ~100ms per hash here, which is the point.
 */
const PARAMS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

/** Stored as `scrypt$N$r$p$salt$hash`, so params can change without breaking old hashes. */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
};

export const verifyPassword = async (
  password: string,
  stored: string
): Promise<boolean> => {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');

  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }

  // Constant-time compare so a wrong password can't be found by timing.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
};

export interface PasswordProblem {
  ok: false;
  reason: string;
}

/**
 * Minimum viable strength. Long passphrases beat short complex ones, so length
 * is the main gate rather than a character-class checklist.
 */
export const checkPasswordStrength = (
  password: string
): { ok: true } | PasswordProblem => {
  if (password.length < 8) {
    return { ok: false, reason: 'Use at least 8 characters.' };
  }
  if (password.length > 200) {
    return { ok: false, reason: 'That password is too long.' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, reason: 'Include at least one letter and one number.' };
  }
  return { ok: true };
};
