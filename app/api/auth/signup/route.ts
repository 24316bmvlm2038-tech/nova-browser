import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { findUserByEmail, getDb, normalizeEmail } from '@/lib/auth/db';
import { checkPasswordStrength, hashPassword } from '@/lib/auth/password';
import { issueCode } from '@/lib/auth/codes';
import { sendVerificationCode } from '@/lib/auth/mailer';
import { LEGAL_VERSION } from '@/lib/legal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Create an account from name + email + password, then send a real code. */
export async function POST(request: Request) {
  let name: string;
  let email: string;
  let password: string;
  let acceptedTerms: boolean;

  try {
    const body = await request.json();
    name = typeof body.name === 'string' ? body.name.trim() : '';
    email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    password = typeof body.password === 'string' ? body.password : '';
    acceptedTerms = body.acceptedTerms === true;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (name.length < 2) {
    return NextResponse.json({ error: 'Enter your name.', field: 'name' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: 'Enter a valid email address.', field: 'email' },
      { status: 400 }
    );
  }

  if (!acceptedTerms) {
    return NextResponse.json(
      { error: 'Please accept the Terms and Privacy Policy.', field: 'terms' },
      { status: 400 }
    );
  }

  const strength = checkPasswordStrength(password);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.reason, field: 'password' }, { status: 400 });
  }

  const existing = findUserByEmail(email);
  if (existing) {
    // An unverified account can be resumed rather than blocking the address.
    if (existing.email_verified === 0) {
      const issued = issueCode(existing.id);
      if ('error' in issued) {
        return NextResponse.json({ error: issued.error }, { status: 429 });
      }
      const sent = await sendVerificationCode(existing.email, existing.name, issued.code);
      return NextResponse.json({
        step: 'verify',
        email: existing.email,
        delivery: sent.delivery,
        deliveryError: sent.error ?? null,
      });
    }
    return NextResponse.json(
      { error: 'That email already has an account. Log in instead.', field: 'email' },
      { status: 409 }
    );
  }

  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, email_verified, accepted_terms, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      id,
      email,
      name,
      await hashPassword(password),
      LEGAL_VERSION,
      new Date().toISOString()
    );

  const issued = issueCode(id);
  if ('error' in issued) {
    return NextResponse.json({ error: issued.error }, { status: 429 });
  }

  const sent = await sendVerificationCode(email, name, issued.code);
  return NextResponse.json({
    step: 'verify',
    email,
    delivery: sent.delivery,
    deliveryError: sent.error ?? null,
  });
}
