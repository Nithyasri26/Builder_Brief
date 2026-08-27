import { guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const notifications = await getDatabase().listNotifications(userId);
    return ok({
      notifications,
      unread: notifications.filter((notification) => !notification.read).length,
    });
  });
}
