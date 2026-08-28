import { AppShell } from '@/components/layout/app-shell';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';

// This layout reads the session cookie and loads per-user data from the
// database, so it must never be prerendered at build time. Without this, `next
// build` tries to statically render it, connects to MongoDB during the build,
// and fails on any host where the database is not reachable at build time.
export const dynamic = 'force-dynamic';

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
