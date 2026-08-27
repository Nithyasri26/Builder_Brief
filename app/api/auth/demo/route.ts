import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth/session';
import { DEMO_USER_ID } from '@/data/demo/citizen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Signs the visitor in as the synthetic demo citizen (Lakshmi Devi). */
export async function POST() {
  await createSession(DEMO_USER_ID);
  return NextResponse.json({ ok: true, redirect: '/' });
}
