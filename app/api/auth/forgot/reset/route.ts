import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtpChallenge } from '@/lib/auth/otp';
import { userStore } from '@/lib/auth/user-store';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  challengeId: z.string(),
  emailCode: z.string().optional(),
  code: z.string().optional(),
  newPassword: z.string(),
});

/** Step 2 of password reset: verify the code and set a new password. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter the code and a new password.' }, { status: 400 });
  }

  const pwdProblem = passwordProblem(parsed.data.newPassword);
  if (pwdProblem) {
    return NextResponse.json({ error: pwdProblem }, { status: 400 });
  }

  const code = parsed.data.emailCode ?? parsed.data.code;
  const result = await verifyOtpChallenge(parsed.data.challengeId, { email: code });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const accountId = result.challenge.accountId;
  const account = accountId ? await userStore().getAccount(accountId) : null;
  if (!account) {
    return NextResponse.json({ error: 'This reset could not be completed. Please try again.' }, { status: 400 });
  }

  await userStore().updateAccount(account.id, { passwordHash: hashPassword(parsed.data.newPassword) });
  await userStore().deleteChallenge(parsed.data.challengeId);
  await createSession(account.id);

  return NextResponse.json({ ok: true, redirect: '/' });
}
