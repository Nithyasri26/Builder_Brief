import Link from 'next/link';
import type { Metadata } from 'next';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';
import { toApplicationView } from '@/lib/workflows/engine';
import { ApplicationCard } from '@/components/cards/task-cards';
import { EmptyState, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Applications' };

export default async function ApplicationsPage() {
  const userId = await getCurrentUserId();
  const tasks = await getDatabase().listTasks(userId);
  const applications = tasks.map(toApplicationView);

  const active = applications.filter(
    (application) => !['SUBMITTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'].includes(application.status),
  );
  const submitted = applications.filter((application) =>
    ['SUBMITTED', 'PROCESSING', 'COMPLETED'].includes(application.status),
  );
  const closed = applications.filter((application) => application.status === 'CANCELLED');

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="My applications"
        description="Everything you have started, in one place."
      />

      {applications.length === 0 ? (
        <EmptyState
          title="Nothing started yet"
          body="When you ask for something, it will be here from start to finish."
          action={
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-[15px] font-medium text-white hover:bg-accent-strong"
            >
              Start a conversation
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          <Section title="Still to finish" items={active} emptyLabel="Nothing waiting on you." />
          <Section title="Sent" items={submitted} emptyLabel="Nothing sent yet." />
          {closed.length > 0 ? <Section title="Stopped" items={closed} emptyLabel="" /> : null}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: ReturnType<typeof toApplicationView>[];
  emptyLabel: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</h2>
      {items.length === 0 ? (
        emptyLabel ? (
          <p className="text-sm text-ink-subtle">{emptyLabel}</p>
        ) : null
      ) : (
        <div className="space-y-3">
          {items.map((application) => (
            <ApplicationCard key={application.taskId} application={application} />
          ))}
        </div>
      )}
    </section>
  );
}
