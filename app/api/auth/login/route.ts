import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/api';
import { userStore } from '@/lib/auth/user-store';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  identifier: z.string().trim().min(3, 'Enter your mobile number or email.'),
  password: z.string().min(1, 'Enter your password.'),
});

export async function POST(request: Request) {
  return guard(async () => {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Enter your details.' },
        { status: 400 },
      );
    }

    const account = await userStore().findAccount(parsed.data.identifier);
    // The same message whether the account is missing or the password is wrong,
    // so we never reveal which mobiles/emails are registered.
    if (!account || !verifyPassword(parsed.data.password, account.passwordHash)) {
      return NextResponse.json(
        { error: 'Those details do not match. Please check and try again.' },
        { status: 401 },
      );
    }

    await createSession(account.id);
    return NextResponse.json({ ok: true, redirect: '/' });
  });
}
