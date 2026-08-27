import { guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const db = getDatabase();
    let id: string | undefined;
    try {
      const body = (await request.json()) as { id?: string };
      id = body.id;
    } catch {
      id = undefined;
    }
    if (id) await db.markNotificationRead(id);
    else await db.markAllNotificationsRead(userId);
    return ok({ done: true });
  });
}
