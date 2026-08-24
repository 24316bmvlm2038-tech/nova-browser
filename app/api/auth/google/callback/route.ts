import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { findUserByEmail, findUserByGoogleId, getDb, normalizeEmail } from '@/lib/auth/db';
import {
  STATE_COOKIE,
  VERIFIER_COOKIE,
  exchangeCode,
  googleConfigured,
} from '@/lib/auth/google';
import { createSession, setSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const appUrl = () => process.env.APP_URL || 'http://localhost:3000';

/** Send the user back to the app with a readable reason rather than raw JSON. */
const fail = (reason: string) =>
  NextResponse.redirect(`${appUrl()}/?auth_error=${encodeURIComponent(reason)}`);

export async function GET(request: Request) {
  if (!googleConfigured()) return fail('Google sign-in is not configured.');

  const url = new URL(request.url);
  const store = cookies();

  const denied = url.searchParams.get('error');
  if (denied) {
    return fail(denied === 'access_denied' ? 'Google sign-in was cancelled.' : denied);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = store.get(STATE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;

  // Clear the one-shot cookies whatever happens next.
  store.set(STATE_COOKIE, '', { path: '/', maxAge: 0 });
  store.set(VERIFIER_COOKIE, '', { path: '/', maxAge: 0 });

  if (!code || !verifier) return fail('Google sign-in did not complete.');
  // State mismatch means the callback wasn't started by this browser — CSRF.
  if (!state || !expectedState || state !== expectedState) {
    return fail('Sign-in expired. Please try again.');
  }

  let profile;
  try {
    profile = await exchangeCode(code, verifier);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Google sign-in failed.');
  }

  const db = getDb();
  const email = normalizeEmail(profile.email);
  const now = new Date().toISOString();

  let user = findUserByGoogleId(profile.sub);

  if (!user) {
    const byEmail = findUserByEmail(email);
    if (byEmail) {
      // Same person arriving via Google on an existing email account: link the
      // two rather than creating a duplicate or refusing the sign-in.
      db.prepare(
        `UPDATE users SET google_id = ?, avatar_url = COALESCE(?, avatar_url),
         email_verified = 1 WHERE id = ?`
      ).run(profile.sub, profile.picture ?? null, byEmail.id);
      user = { ...byEmail, google_id: profile.sub, email_verified: 1 };
    } else {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO users (id, email, name, google_id, avatar_url, email_verified, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        email,
        profile.name,
        profile.sub,
        profile.picture ?? null,
        profile.emailVerified ? 1 : 0,
        now
      );
      user = {
        id,
        email,
        name: profile.name,
        password_hash: null,
        google_id: profile.sub,
        avatar_url: profile.picture ?? null,
        email_verified: profile.emailVerified ? 1 : 0,
        created_at: now,
      };
    }
  }

  setSessionCookie(createSession(user.id));
  return NextResponse.redirect(appUrl());
}
