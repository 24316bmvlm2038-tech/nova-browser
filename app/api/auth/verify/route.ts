import { NextResponse } from 'next/server';
import { findUserByEmail, getDb } from '@/lib/auth/db';
import { verifyCode } from '@/lib/auth/codes';
import { createSession, setSessionCookie, toPublicUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Check the emailed code and, on success, sign the user in. */
export async function POST(request: Request) {
  let email: string;
  let code: string;

  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email : '';
    code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (code.length !== 6) {
    return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
  }

  const user = findUserByEmail(email);
  // Same message whether the account is missing or the code is wrong, so this
  // endpoint can't be used to discover which addresses have accounts.
  if (!user) {
    return NextResponse.json(
      { error: 'That code isn\'t right. Request a new one.' },
      { status: 400 }
    );
  }

  const result = verifyCode(user.id, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  getDb().prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(user.id);

  setSessionCookie(createSession(user.id));
  return NextResponse.json({
    user: toPublicUser({ ...user, email_verified: 1 }),
  });
}
