import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  destroySession,
} from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  // Delete the row too, so the token is dead even if the cookie was copied.
  if (token) destroySession(token);
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
