import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';

import { findUserByEmail, getDb, normalizeEmail } from '../lib/auth/db';
import { checkPasswordStrength, hashPassword, verifyPassword } from '../lib/auth/password';
import { issueCode, verifyCode } from '../lib/auth/codes';

// Point the store at a scratch file. Safe as a plain statement because the db
// module reads DATABASE_PATH at first use, not at import.
const dir = mkdtempSync(join(tmpdir(), 'canai-auth-'));
process.env.DATABASE_PATH = join(dir, 'test.db');

before(() => getDb());
after(() => rmSync(dir, { recursive: true, force: true }));

const makeUser = (email: string, id = email) => {
  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`
    )
    .run(id, normalizeEmail(email), 'Test User', null, new Date().toISOString());
  return id;
};

test('hashes and verifies a password', async () => {
  const hash = await hashPassword('correct horse 42');

  // Never stores the plaintext, and salts so two hashes of the same password differ.
  assert.ok(!hash.includes('correct horse 42'));
  assert.notEqual(hash, await hashPassword('correct horse 42'));

  assert.equal(await verifyPassword('correct horse 42', hash), true);
  assert.equal(await verifyPassword('wrong password 42', hash), false);
});

test('rejects a malformed hash instead of throwing', async () => {
  assert.equal(await verifyPassword('anything', 'not-a-hash'), false);
  assert.equal(await verifyPassword('anything', ''), false);
});

test('enforces minimum password strength', () => {
  assert.equal(checkPasswordStrength('short1').ok, false);
  assert.equal(checkPasswordStrength('alllettersnodigits').ok, false);
  assert.equal(checkPasswordStrength('12345678').ok, false);
  assert.equal(checkPasswordStrength('goodenough1').ok, true);
});

test('issues a 6-digit code that verifies once', () => {
  const id = makeUser('once@example.com');
  const issued = issueCode(id);
  assert.ok('code' in issued);

  const code = (issued as { code: string }).code;
  assert.match(code, /^\d{6}$/);

  // The plaintext code is never stored.
  const stored = getDb()
    .prepare('SELECT code_hash FROM verification_codes WHERE user_id = ?')
    .get(id) as { code_hash: string };
  assert.notEqual(stored.code_hash, code);

  assert.deepEqual(verifyCode(id, code), { ok: true });
  // Replaying the same code fails — it was consumed.
  assert.equal(verifyCode(id, code).ok, false);
});

test('rejects a wrong code and counts down remaining tries', () => {
  const id = makeUser('wrong@example.com');
  const { code } = issueCode(id) as { code: string };
  const wrong = code === '000000' ? '111111' : '000000';

  const first = verifyCode(id, wrong);
  assert.equal(first.ok, false);
  assert.match((first as { reason: string }).reason, /4 tries left/);

  // The real code still works while attempts remain.
  assert.equal(verifyCode(id, code).ok, true);
});

test('burns the code after five wrong attempts', () => {
  const id = makeUser('bruteforce@example.com');
  const { code } = issueCode(id) as { code: string };
  const wrong = code === '000000' ? '111111' : '000000';

  for (let attempt = 0; attempt < 5; attempt += 1) verifyCode(id, wrong);

  // Even the correct code is dead now — no unlimited guessing at 6 digits.
  const result = verifyCode(id, code);
  assert.equal(result.ok, false);
  assert.match((result as { reason: string }).reason, /Too many attempts/);
});

test('throttles resends, then invalidates the old code on reissue', () => {
  const id = makeUser('resend@example.com');
  const first = issueCode(id) as { code: string };

  // Immediate resend is refused.
  const throttled = issueCode(id);
  assert.ok('error' in throttled);
  assert.ok((throttled as { retryAfter: number }).retryAfter > 0);

  // Backdate the row so a reissue is allowed, then confirm the old code dies.
  getDb()
    .prepare('UPDATE verification_codes SET created_at = ? WHERE user_id = ?')
    .run(new Date(Date.now() - 120_000).toISOString(), id);

  const second = issueCode(id) as { code: string };
  assert.ok('code' in second);
  assert.equal(verifyCode(id, first.code).ok, false);
  assert.equal(verifyCode(id, second.code).ok, true);
});

test('rejects an expired code', () => {
  const id = makeUser('expired@example.com');
  const { code } = issueCode(id) as { code: string };

  getDb()
    .prepare('UPDATE verification_codes SET expires_at = ? WHERE user_id = ?')
    .run(new Date(Date.now() - 1000).toISOString(), id);

  const result = verifyCode(id, code);
  assert.equal(result.ok, false);
  assert.match((result as { reason: string }).reason, /expired/i);
});

test('matches emails case-insensitively', () => {
  makeUser('Mixed.Case@Example.COM', 'mixed');
  assert.ok(findUserByEmail('mixed.case@example.com'));
  assert.ok(findUserByEmail('  MIXED.CASE@EXAMPLE.COM  '));
});
