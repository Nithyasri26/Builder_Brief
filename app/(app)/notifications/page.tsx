import type { Metadata } from 'next';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';
import { NotificationList } from '@/components/notifications/notification-list';
import { Card, CardBody, PageHeader } from '@/components/ui';
import { settleBackgroundWork } from '@/lib/workflows/background';
import { formatRelativeDay } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const userId = await getCurrentUserId();
  // Opening this page is also a good moment to pick up anything the simulated
  // offices have finished.
  await settleBackgroundWork(userId);
  const db = getDatabase();
  const [notifications, emails] = await Promise.all([
    db.listNotifications(userId),
    db.listEmails(userId),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Updates" description="What changed, and what still needs you." />
      <NotificationList notifications={notifications} />

      {emails.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Emails we sent you
          </h2>
          <div className="space-y-3">
            {emails.map((email) => (
              <Card key={email.id}>
                <CardBody className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-ink">{email.subject}</h3>
                    <p className="text-xs text-ink-subtle">{formatRelativeDay(email.createdAt)}</p>
                  </div>
                  <p className="text-xs text-ink-subtle">To {email.to}</p>
                  <p className="whitespace-pre-line text-sm text-ink-muted">{email.body}</p>
                  {email.attachment ? (
                    <p className="text-xs text-ink-subtle">Attached: {email.attachment}</p>
                  ) : null}
                </CardBody>
              </Card>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-subtle">
            This is a practice app, so these are kept here instead of being sent to a real inbox.
          </p>
        </section>
      ) : null}
    </div>
  );
}
