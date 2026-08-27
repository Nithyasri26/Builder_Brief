'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CitizenNotification } from '@/types/notification';
import { NotificationItem } from '@/components/cards/misc-cards';
import { Button, EmptyState } from '@/components/ui';

export function NotificationList({ notifications }: { notifications: CitizenNotification[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(notifications);

  React.useEffect(() => setItems(notifications), [notifications]);

  async function markRead(id?: string) {
    setItems((current) =>
      current.map((item) => (!id || item.id === id ? { ...item, read: true } : item)),
    );
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : {}),
    });
    window.dispatchEvent(new CustomEvent('ns:data-changed'));
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing to show yet"
        body="When something needs your attention — a confirmation, a status change, a ready document — it will appear here."
        action={
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-[15px] font-medium text-white hover:bg-accent-strong"
          >
            Back to the conversation
          </Link>
        }
      />
    );
  }

  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="space-y-3">
      {unread > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-muted">
            {unread === 1 ? '1 update needs your attention' : `${unread} updates need your attention`}
          </p>
          <Button variant="secondary" onClick={() => markRead()}>
            Mark all as read
          </Button>
        </div>
      ) : null}
      {items.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRead={(id) => void markRead(id)}
        />
      ))}
    </div>
  );
}
