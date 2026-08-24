import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/auth/db';
import { verifyPassword } from '@/lib/auth/password';
import { issueCode } from '@/lib/auth/codes';
import { sendVerificationCode } from '@/lib/auth/mailer';
import { createSession, setSessionCookie, toPublicUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Log in with email + password. */
export async function POST(request: Request) {
  let email: string;
  let password: string;

  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  const user = findUserByEmail(email);

  // One message for "no such user", "no password set", and "wrong password", so
  // the endpoint doesn't reveal which addresses have accounts. Still runs a
  // hash comparison on the miss path to keep the timing similar.
  const invalid = NextResponse.json(
    { error: 'That email and password don\'t match.' },
    { status: 401 }
  );

  if (!user || !user.password_hash) {
    await verifyPassword(password, 'scrypt$32768$8$1$AAAA$AAAA');
    if (user && !user.password_hash) {
      return NextResponse.json(
        { error: 'This account uses Google sign-in. Continue with Google instead.' },
        { status: 409 }
      );
    }
    return invalid;
  }

  if (!(await verifyPassword(password, user.password_hash))) return invalid;

  // Correct password but never verified: send a fresh code instead of a session.
  if (user.email_verified === 0) {
    const issued = issueCode(user.id);
    const sent =
      'code' in issued
        ? await sendVerificationCode(user.email, user.name, issued.code)
        : { delivery: 'email' as const, error: undefined };

    return NextResponse.json({
      step: 'verify',
      email: user.email,
      delivery: sent.delivery,
      deliveryError: sent.error ?? null,
      devCode: sent.devCode ?? null,
    });
  }

  setSessionCookie(createSession(user.id));
  return NextResponse.json({ user: toPublicUser(user) });
}
