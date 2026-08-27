import { NextResponse } from 'next/server';
import { z } from 'zod';
import { userStore } from '@/lib/auth/user-store';
import { startOtpChallenge } from '@/lib/auth/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ identifier: z.string().trim().min(3, 'Enter your mobile number or email.') });

/** Step 1 of password reset: send a code to the email on the account. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Enter your mobile or email.' }, { status: 400 });
  }

  const account = await userStore().findAccount(parsed.data.identifier);
  if (!account) {
    return NextResponse.json(
      { error: 'We could not find an account with those details. Please register first.' },
      { status: 404 },
    );
  }

  const challenge = await startOtpChallenge({
    purpose: 'reset',
    email: account.email,
    accountId: account.id,
  });

  return NextResponse.json(challenge);
}
