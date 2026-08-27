'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Menu, X } from 'lucide-react';
import type { Conversation } from '@/types/chat';
import { Sidebar } from './sidebar';

/**
 * App frame: a permanent sidebar on desktop, a drawer on mobile.
 * Conversation history and the unread count refresh whenever a workflow
 * changes something, so the sidebar never goes stale mid-demo.
 */
export function AppShell({
  initialConversations,
  initialUnread,
  children,
}: {
  initialConversations: Conversation[];
  initialUnread: number;
  children: React.ReactNode;
}) {
  const [conversations, setConversations] = React.useState(initialConversations);
  const [unread, setUnread] = React.useState(initialUnread);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = React.useCallback(async () => {
    try {
      const [conversationsRes, notificationsRes] = await Promise.all([
        fetch('/api/conversations', { cache: 'no-store' }),
        fetch('/api/notifications', { cache: 'no-store' }),
      ]);
      if (conversationsRes.ok) {
        const data = (await conversationsRes.json()) as { conversations: Conversation[] };
        setConversations(data.conversations);
      }
      if (notificationsRes.ok) {
        const data = (await notificationsRes.json()) as { unread: number };
        setUnread(data.unread);
      }
    } catch {
      // A stale sidebar is not worth interrupting the citizen for.
    }
  }, []);

  React.useEffect(() => {
    const handler = () => {
      void refresh();
      router.refresh();
    };
    window.addEventListener('ns:data-changed', handler);
    return () => window.removeEventListener('ns:data-changed', handler);
  }, [refresh, router]);

  React.useEffect(() => {
    setDrawerOpen(false);
    void refresh();
  }, [pathname, refresh]);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="hidden w-[280px] shrink-0 border-r border-line lg:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar conversations={conversations} unread={unread} />
        </div>
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-[86%] max-w-[320px] shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-ink-muted hover:bg-canvas"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <Sidebar
              conversations={conversations}
              unread={unread}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/95 px-3 py-2.5 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="grid size-11 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-accent text-xs font-bold text-white">
              NS
            </span>
            <span className="text-[15px] font-semibold text-ink">NammaSahaay</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/notifications"
              aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
              className="relative grid size-11 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
            >
              <Bell className="size-6" aria-hidden="true" />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 size-2 rounded-full bg-stop" />
              ) : null}
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
