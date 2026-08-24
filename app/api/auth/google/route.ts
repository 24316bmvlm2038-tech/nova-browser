import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  STATE_COOKIE,
  VERIFIER_COOKIE,
  buildAuthUrl,
  googleConfigured,
} from '@/lib/auth/google';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Start the Google flow: stash state + PKCE verifier, then redirect to Google. */
export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json(
      {
        error:
          'Google sign-in is not set up. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local.',
      },
      { status: 503 }
    );
  }

  const { url, state, verifier } = buildAuthUrl();
  const options = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600,
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
  };

  cookies().set(STATE_COOKIE, state, options);
  cookies().set(VERIFIER_COOKIE, verifier, options);

  return NextResponse.redirect(url);
}
