import { NextResponse } from 'next/server';
import { currentUser, toPublicUser } from '@/lib/auth/session';
import { googleConfigured } from '@/lib/auth/google';
import { mailerStatus } from '@/lib/auth/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Who's signed in, plus which auth methods this install can actually offer —
 * the UI disables the Google button rather than sending users at a broken
 * redirect, and warns when codes will print to the terminal.
 */
export async function GET() {
  const user = currentUser();
  return NextResponse.json({
    user: user ? toPublicUser(user) : null,
    providers: {
      google: googleConfigured(),
      emailDelivery: mailerStatus().configured ? 'email' : 'console',
    },
  });
}
