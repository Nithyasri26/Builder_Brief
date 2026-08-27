import { AppShell } from '@/components/layout/app-shell';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';

/**
 * Layout for the signed-in application. Everything under (app) is reached only
 * after middleware has confirmed a session, so this can assume a current user
 * and load their sidebar data.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  const db = getDatabase();
  const [conversations, notifications] = await Promise.all([
    db.listConversations(userId),
    db.listNotifications(userId),
  ]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <AppShell
        initialConversations={conversations}
        initialUnread={notifications.filter((notification) => !notification.read).length}
      >
        {children}
      </AppShell>
    </>
  );
}
