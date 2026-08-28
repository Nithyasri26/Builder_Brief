import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database/mongo-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY diagnostic endpoint. Returns the real database error so a deploy
 * problem can be seen directly. Remove after debugging.
 */
export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    const ping = await db.command({ ping: 1 });
    return NextResponse.json({ ok: true, ping, ms: Date.now() - started });
  } catch (error) {
    const e = error as Error & { code?: unknown; cause?: unknown };
    return NextResponse.json(
      {
        ok: false,
        ms: Date.now() - started,
        name: e?.name,
        message: e?.message,
        code: e?.code,
        cause: e?.cause ? String(e.cause) : undefined,
        hasMongoUri: Boolean(process.env.MONGODB_URI),
        uriScheme: (process.env.MONGODB_URI ?? '').split('://')[0] || null,
        onVercel: Boolean(process.env.VERCEL),
      },
      { status: 200 },
    );
  }
}
