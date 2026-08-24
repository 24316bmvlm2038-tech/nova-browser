import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { getDb } from './db';

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
/** Resends are throttled so the endpoint can't be used to spam an inbox. */
const RESEND_COOLDOWN_SECONDS = 60;

export type CodePurpose = 'verify_email';

const hashCode = (code: string): string =>
  createHash('sha256').update(code).digest('hex');

/**
 * A real 6-digit code from a CSPRNG — randomInt, not Math.random, so the code
 * can't be predicted from previous ones. Only its hash is stored.
 */
export const issueCode = (
  userId: string,
  purpose: CodePurpose = 'verify_email'
): { code: string } | { error: string; retryAfter: number } => {
  const db = getDb();

  const recent = db
    .prepare(
      `SELECT created_at FROM verification_codes
       WHERE user_id = ? AND purpose = ? AND consumed = 0
       ORDER BY id DESC LIMIT 1`
    )
    .get(userId, purpose) as { created_at: string } | undefined;

  if (recent) {
    const age = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
    if (age < RESEND_COOLDOWN_SECONDS) {
      return {
        error: 'A code was just sent. Check your inbox.',
        retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - age),
      };
    }
  }

  // Any earlier code stops working the moment a new one is issued.
  db.prepare(
    'UPDATE verification_codes SET consumed = 1 WHERE user_id = ? AND purpose = ?'
  ).run(userId, purpose);

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();

  db.prepare(
    `INSERT INTO verification_codes (user_id, code_hash, purpose, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    userId,
    hashCode(code),
    purpose,
    new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString(),
    now.toISOString()
  );

  return { code };
};

export type CodeResult =
  | { ok: true }
  | { ok: false; reason: string };

export const verifyCode = (
  userId: string,
  code: string,
  purpose: CodePurpose = 'verify_email'
): CodeResult => {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT id, code_hash, attempts, expires_at FROM verification_codes
       WHERE user_id = ? AND purpose = ? AND consumed = 0
       ORDER BY id DESC LIMIT 1`
    )
    .get(userId, purpose) as
    | { id: number; code_hash: string; attempts: number; expires_at: string }
    | undefined;

  if (!row) {
    return { ok: false, reason: 'No code is pending. Request a new one.' };
  }
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, reason: 'That code expired. Request a new one.' };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    // Burn the code rather than allow unlimited guessing at 6 digits.
    db.prepare('UPDATE verification_codes SET consumed = 1 WHERE id = ?').run(row.id);
    return { ok: false, reason: 'Too many attempts. Request a new code.' };
  }

  db.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').run(
    row.id
  );

  const supplied = Buffer.from(hashCode(code.trim()));
  const expected = Buffer.from(row.code_hash);
  const matches =
    supplied.length === expected.length && timingSafeEqual(supplied, expected);

  if (!matches) {
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return {
      ok: false,
      reason:
        left > 0
          ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.`
          : 'Too many attempts. Request a new code.',
    };
  }

  db.prepare('UPDATE verification_codes SET consumed = 1 WHERE id = ?').run(row.id);
  return { ok: true };
};
