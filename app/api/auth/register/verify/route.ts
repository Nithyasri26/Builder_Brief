import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtpChallenge } from '@/lib/auth/otp';
import { userStore } from '@/lib/auth/user-store';
import { createSession } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database';
import { profileFromDraft } from '@/lib/auth/blank-profile';
import { id as newId, nowIso } from '@/lib/utils';
import type { UserAccount } from '@/types/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  challengeId: z.string(),
  mobileCode: z.string().optional(),
  emailCode: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter the codes we sent you.' }, { status: 400 });
  }

  const result = await verifyOtpChallenge(parsed.data.challengeId, {
    mobile: parsed.data.mobileCode,
    email: parsed.data.emailCode,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const draft = result.challenge.draft;
  if (!draft) {
    return NextResponse.json({ error: 'This registration could not be completed. Please start again.' }, { status: 400 });
  }

  // Guard against a race that created the account between start and verify.
  const clash = (await userStore().findAccount(draft.mobile)) ?? (await userStore().findAccount(draft.email));
  if (clash) {
    await userStore().deleteChallenge(parsed.data.challengeId);
    return NextResponse.json({ error: 'An account already exists. Please log in instead.' }, { status: 409 });
  }

  const userId = newId('user');
  const account: UserAccount = {
    id: userId,
    mobile: draft.mobile,
    email: draft.email,
    passwordHash: draft.passwordHash,
    createdAt: nowIso(),
    verifiedVia: draft.verifiedVia,
    status: 'active',
  };

  await userStore().createAccount(account);
  await getDatabase().updateProfile(userId, profileFromDraft(userId, draft));
  await userStore().deleteChallenge(parsed.data.challengeId);
  await createSession(userId);

  return NextResponse.json({ ok: true, redirect: '/' });
}
