import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, afterEach, before } from 'node:test';

import { getDb, findUserByEmail } from '../lib/auth/db';
import { hashPassword } from '../lib/auth/password';
import {
  buildAuthUrl,
  exchangeCode,
  googleConfigured,
  upsertGoogleUser,
  type GoogleProfile,
} from '../lib/auth/google';

const dir = mkdtempSync(join(tmpdir(), 'canai-google-'));
process.env.DATABASE_PATH = join(dir, 'test.db');
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.APP_URL = 'http://localhost:3000';

before(() => getDb());

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  // Clear the tables rather than the file — the connection is cached, so a
  // deleted file leaves the open handle pointing at the same rows.
  getDb().exec('DELETE FROM users');
});
after(() => rmSync(dir, { recursive: true, force: true }));

const profile = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
  sub: '110000000000000000001',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  picture: 'https://lh3.googleusercontent.com/a/pic',
  emailVerified: true,
  ...over,
});

test('reports itself configured once the client id and secret are set', () => {
  assert.equal(googleConfigured(), true);
});

test('builds an authorization URL Google will accept', () => {
  const { url, state, verifier } = buildAuthUrl();
  const parsed = new URL(url);
  const params = parsed.searchParams;

  assert.equal(parsed.origin + parsed.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(params.get('client_id'), process.env.GOOGLE_CLIENT_ID);
  assert.equal(params.get('response_type'), 'code');
  assert.equal(
    params.get('redirect_uri'),
    'http://localhost:3000/api/auth/google/callback'
  );
  assert.equal(params.get('scope'), 'openid email profile');
  assert.equal(params.get('prompt'), 'select_account');

  // PKCE: only the S256 challenge goes up front; the verifier stays with us.
  assert.equal(params.get('code_challenge_method'), 'S256');
  assert.equal(
    params.get('code_challenge'),
    createHash('sha256').update(verifier).digest('base64url')
  );
  assert.notEqual(params.get('code_challenge'), verifier);

  // State and verifier must be unguessable and fresh each time.
  assert.ok(state.length >= 16);
  assert.notEqual(buildAuthUrl().state, state);
});

/** Stand in for Google's token and userinfo endpoints. */
const mockGoogle = (
  options: { tokenStatus?: number; token?: unknown; profileStatus?: number; profile?: unknown } = {}
) => {
  const seen: { body: URLSearchParams | null; auth: string | null } = { body: null, auth: null };

  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('oauth2.googleapis.com/token')) {
      seen.body = new URLSearchParams(init.body as string);
      return new Response(
        JSON.stringify(options.token ?? { access_token: 'ya29.mock-access-token' }),
        { status: options.tokenStatus ?? 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
      seen.auth = init.headers?.Authorization ?? null;
      return new Response(
        JSON.stringify(
          options.profile ?? {
            sub: '110000000000000000001',
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            picture: 'https://lh3.googleusercontent.com/a/pic',
            email_verified: true,
          }
        ),
        { status: options.profileStatus ?? 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`unexpected fetch to ${url}`);
  }) as typeof fetch;

  return seen;
};

test('exchanges the code, sending the PKCE verifier and the client secret', async () => {
  const seen = mockGoogle();
  const result = await exchangeCode('4/mock-auth-code', 'the-verifier');

  // What Google receives must be a complete, correct token request.
  assert.equal(seen.body?.get('code'), '4/mock-auth-code');
  assert.equal(seen.body?.get('code_verifier'), 'the-verifier');
  assert.equal(seen.body?.get('client_id'), process.env.GOOGLE_CLIENT_ID);
  assert.equal(seen.body?.get('client_secret'), process.env.GOOGLE_CLIENT_SECRET);
  assert.equal(seen.body?.get('grant_type'), 'authorization_code');
  assert.equal(
    seen.body?.get('redirect_uri'),
    'http://localhost:3000/api/auth/google/callback'
  );

  // The profile call must carry the token it just received.
  assert.equal(seen.auth, 'Bearer ya29.mock-access-token');

  assert.deepEqual(result, {
    sub: '110000000000000000001',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    picture: 'https://lh3.googleusercontent.com/a/pic',
    emailVerified: true,
  });
});

test('surfaces a rejected code instead of continuing', async () => {
  mockGoogle({ tokenStatus: 400, token: { error: 'invalid_grant' } });
  await assert.rejects(
    () => exchangeCode('bad-code', 'v'),
    /Google token exchange failed \(400\)/
  );
});

test('rejects a token response with no access token', async () => {
  mockGoogle({ token: { scope: 'openid' } });
  await assert.rejects(() => exchangeCode('c', 'v'), /did not return an access token/);
});

test('rejects a Google account with no email', async () => {
  mockGoogle({ profile: { sub: '1', name: 'No Email' } });
  await assert.rejects(() => exchangeCode('c', 'v'), /no email address/);
});

test('creates an account on first Google sign-in', () => {
  const user = upsertGoogleUser(profile());

  assert.equal(user.email, 'ada@example.com');
  assert.equal(user.google_id, '110000000000000000001');
  // Google already verified the address, so we don't send our own code.
  assert.equal(user.email_verified, 1);
  assert.equal(user.password_hash, null);
  assert.ok(user.accepted_terms);
});

test('returns the same account on a second sign-in, not a duplicate', () => {
  const first = upsertGoogleUser(profile());
  const second = upsertGoogleUser(profile({ name: 'Ada L.' }));

  assert.equal(second.id, first.id);
  assert.equal(
    (getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n,
    1
  );
});

test('links Google to an existing password account rather than duplicating it', async () => {
  // Someone signs up with a password first.
  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, email_verified, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`
    )
    .run('local-1', 'ada@example.com', 'Ada', await hashPassword('analytical1'), new Date().toISOString());

  const linked = upsertGoogleUser(profile());

  assert.equal(linked.id, 'local-1', 'should reuse the existing row');
  assert.equal(linked.google_id, '110000000000000000001');
  // Signing in via Google proves the address, and the password still works.
  assert.equal(linked.email_verified, 1);
  assert.ok(linked.password_hash);
  assert.equal(
    (getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n,
    1
  );
  assert.ok(findUserByEmail('ADA@EXAMPLE.COM'));
});

test('matches the account even when Google returns a differently-cased email', () => {
  const created = upsertGoogleUser(profile());
  const again = upsertGoogleUser(profile({ sub: 'different-sub', email: 'ADA@Example.com' }));

  // Same address, so it links onto the existing row rather than making a second.
  assert.equal(again.id, created.id);
});
