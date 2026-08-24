import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/auth/db';
import { issueCode } from '@/lib/auth/codes';
import { sendVerificationCode } from '@/lib/auth/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Issue a fresh code, invalidating the previous one. Throttled to 1/minute. */
export async function POST(request: Request) {
  let email: string;
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const user = findUserByEmail(email);
  // Report success even when the address is unknown, so this can't be used to
  // enumerate accounts.
  if (!user || user.email_verified === 1) {
    return NextResponse.json({ sent: true, delivery: 'email' });
  }

  const issued = issueCode(user.id);
  if ('error' in issued) {
    return NextResponse.json(
      { error: issued.error, retryAfter: issued.retryAfter },
      { status: 429 }
    );
  }

  const sent = await sendVerificationCode(user.email, user.name, issued.code);
  return NextResponse.json({
    sent: true,
    delivery: sent.delivery,
    deliveryError: sent.error ?? null,
    devCode: sent.devCode ?? null,
  });
}
