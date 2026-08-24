import { createHash, randomBytes } from 'node:crypto';

/**
 * Real Google OAuth 2.0 authorization-code flow with PKCE. Needs a client from
 * the Google Cloud console; without one the sign-in button is disabled rather
 * than failing at the redirect.
 */
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/** One-shot cookies for the OAuth round trip. */
export const STATE_COOKIE = 'canai_oauth_state';
export const VERIFIER_COOKIE = 'canai_oauth_verifier';

export const googleConfigured = (): boolean =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const redirectUri = (): string =>
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

export interface OAuthStart {
  url: string;
  state: string;
  verifier: string;
}

/**
 * PKCE: we send only the SHA-256 of a random verifier up front, then the
 * verifier itself at token exchange, so an intercepted code is unusable.
 */
export const buildAuthUrl = (): OAuthStart => {
  const state = randomBytes(16).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    // Always show the picker rather than silently reusing one Google session.
    prompt: 'select_account',
  });

  return { url: `${AUTH_ENDPOINT}?${params}`, state, verifier };
};

import { randomUUID } from 'node:crypto';
import { findUserByEmail, findUserByGoogleId, getDb, normalizeEmail, type UserRow } from './db';
import { LEGAL_VERSION } from '../legal';

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

export const exchangeCode = async (
  code: string,
  verifier: string
): Promise<GoogleProfile> => {
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => '');
    throw new Error(
      `Google token exchange failed (${tokenResponse.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`
    );
  }

  const { access_token: accessToken } = await tokenResponse.json();
  if (!accessToken) throw new Error('Google did not return an access token');

  const profileResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileResponse.ok) {
    throw new Error(`Could not read your Google profile (${profileResponse.status})`);
  }

  const profile = await profileResponse.json();
  if (!profile.email) throw new Error('Google account has no email address');

  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name || profile.email.split('@')[0],
    picture: profile.picture,
    // Google has already verified this address, so we don't re-verify it.
    emailVerified: profile.email_verified !== false,
  };
};


/**
 * Turn a verified Google profile into a local user.
 *
 * Three cases, and the middle one is the one that matters: someone who signed
 * up with a password and later clicks "Continue with Google" is the same
 * person, so the accounts are linked rather than duplicated or refused.
 */
export const upsertGoogleUser = (profile: GoogleProfile): UserRow => {
  const db = getDb();
  const email = normalizeEmail(profile.email);
  const now = new Date().toISOString();

  const byGoogle = findUserByGoogleId(profile.sub);
  if (byGoogle) return byGoogle;

  const byEmail = findUserByEmail(email);
  if (byEmail) {
    db.prepare(
      `UPDATE users SET google_id = ?, avatar_url = COALESCE(?, avatar_url),
       email_verified = 1 WHERE id = ?`
    ).run(profile.sub, profile.picture ?? null, byEmail.id);

    return {
      ...byEmail,
      google_id: profile.sub,
      avatar_url: profile.picture ?? byEmail.avatar_url,
      email_verified: 1,
    };
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, name, google_id, avatar_url, email_verified, accepted_terms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    email,
    profile.name,
    profile.sub,
    profile.picture ?? null,
    profile.emailVerified ? 1 : 0,
    LEGAL_VERSION,
    now
  );

  return {
    id,
    email,
    name: profile.name,
    password_hash: null,
    google_id: profile.sub,
    avatar_url: profile.picture ?? null,
    email_verified: profile.emailVerified ? 1 : 0,
    accepted_terms: LEGAL_VERSION,
    created_at: now,
  };
};
