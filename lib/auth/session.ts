import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { findUserById, getDb, pruneExpired, type UserRow } from './db';

export const SESSION_COOKIE = 'canai_session';
const SESSION_DAYS = 30;

/**
 * Sessions are random 256-bit tokens. Only their SHA-256 is stored, so a stolen
 * database file doesn't hand over usable sessions. The token itself lives in an
 * httpOnly cookie the browser JS can never read.
 */
const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const createSession = (userId: string): string => {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);

  getDb()
    .prepare(
      'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    )
    .run(hashToken(token), userId, now.toISOString(), expires.toISOString());

  return token;
};

export const setSessionCookie = (token: string): void => {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // The app runs on http://localhost, where a Secure cookie would be dropped.
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
};

export const clearSessionCookie = (): void => {
  cookies().set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
};

export const destroySession = (token: string): void => {
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(hashToken(token));
};

/** The signed-in user, or null. Expired sessions are pruned as a side effect. */
export const currentUser = (): UserRow | null => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  pruneExpired();

  const row = getDb()
    .prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?')
    .get(hashToken(token), new Date().toISOString()) as { user_id: string } | undefined;

  if (!row) return null;
  return findUserById(row.user_id) ?? null;
};

/** Shape sent to the browser — never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  linkedGoogle: boolean;
  createdAt: string;
}

export const toPublicUser = (user: UserRow): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatar_url,
  emailVerified: user.email_verified === 1,
  hasPassword: Boolean(user.password_hash),
  linkedGoogle: Boolean(user.google_id),
  createdAt: user.created_at,
});
