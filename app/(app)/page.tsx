import Link from 'next/link';
import { ArrowRight, Bell, FolderOpen } from 'lucide-react';
import { ChatView } from '@/components/chat/chat-view';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';
import { toApplicationView } from '@/lib/workflows/engine';
import { Badge, Card, CardBody } from '@/components/ui';
import { formatRelativeDay, greeting } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Home is the conversation. The dashboard underneath is deliberately
 * secondary — it exists so an unfinished task is never lost, not so the
 * citizen has to navigate a portal.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ask?: string; new?: string }>;
}) {
  const params = await searchParams;
  const userId = await getCurrentUserId();
  const db = getDatabase();

  const [profile, tasks, documents, notifications] = await Promise.all([
    db.getProfile(userId),
    db.listTasks(userId),
    db.listDocuments(userId),
    db.listNotifications(userId),
  ]);

  const applications = tasks.map(toApplicationView);
  const resumable = applications.filter((application) =>
    ['WAITING_FOR_USER', 'WAITING_FOR_CONFIRMATION', 'WAITING_FOR_DOCUMENT', 'IN_PROGRESS'].includes(
      application.status,
    ),
  );
  const recent = applications.slice(0, 3);
  const unread = notifications.filter((notification) => !notification.read);
  const firstName = profile.name.split(' ')[0];

  return (
    <ChatView
      conversationId={null}
      initialMessages={[]}
      initialPrompt={params.ask}
      greetingName={`${greeting()}, ${firstName}`}
      showHero
      dashboard={
        <div className="space-y-6">
          {resumable.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Continue where you left off
              </h2>
              <div className="space-y-2">
                {resumable.slice(0, 2).map((application) => (
                  <Card key={application.taskId}>
                    <CardBody className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[160px] flex-1">
                        <h3 className="text-[15px] font-semibold text-ink">{application.title}</h3>
                        <p className="text-xs text-ink-subtle">
                          {application.statusLabel} · updated {formatRelativeDay(application.updatedAt)}
                        </p>
                      </div>
                      <Badge tone="wait">In progress</Badge>
                      <Link
                        href={`/?ask=${encodeURIComponent(
                          application.nextActionPrompt ?? `Continue my ${application.title.toLowerCase()}`,
                        )}`}
                        className="inline-flex h-10 items-center gap-1 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-strong"
                      >
                        Continue
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-3">
            <SummaryTile
              href="/applications"
              label="Applications"
              value={`${applications.length}`}
              hint={applications.length === 0 ? 'Nothing started yet' : 'In progress or submitted'}
            />
            <SummaryTile
              href="/documents"
              label="Papers"
              value={`${documents.length}`}
              hint="Ready to reuse"
              icon={<FolderOpen className="size-4" aria-hidden="true" />}
            />
            <SummaryTile
              href="/notifications"
              label="Updates"
              value={`${unread.length}`}
              hint={unread.length > 0 ? 'Need your attention' : 'All caught up'}
              icon={<Bell className="size-4" aria-hidden="true" />}
            />
          </section>

          {recent.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Recent applications
                </h2>
                <Link href="/applications" className="text-xs font-medium text-accent hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {recent.map((application) => (
                  <Link
                    key={application.taskId}
                    href={`/applications/${application.taskId}`}
                    className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 hover:border-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {application.title}
                      </span>
                      <span className="block text-xs text-ink-subtle">
                        {application.statusLabel} · {formatRelativeDay(application.updatedAt)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      }
    />
  );
}

function SummaryTile({
  href,
  label,
  value,
  hint,
  icon,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 transition-colors hover:border-accent"
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        {icon}
        {label}
      </span>
      <span className="mt-1 block text-2xl font-semibold text-ink">{value}</span>
      <span className="block text-xs text-ink-subtle">{hint}</span>
    </Link>
  );
}
