import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';
import { toApplicationView } from '@/lib/workflows/engine';
import { ProgressSteps } from '@/components/cards/task-cards';
import { DocumentCard } from '@/components/cards/document-card';
import { Badge, Card, CardBody, PageHeader } from '@/components/ui';
import { formatRelativeDay } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Application' };

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const db = getDatabase();
  const task = await db.getTask(id);
  if (!task || task.userId !== userId) notFound();

  const application = toApplicationView(task);
  const documents = (
    await Promise.all(task.documents.map((documentId) => db.getDocument(documentId)))
  ).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/applications"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All applications
      </Link>

      <PageHeader
        title={application.title}
        description={`${application.serviceLabel} · ${
          application.reference === 'Not submitted'
            ? 'Not sent yet'
            : `Number ${application.reference}`
        }`}
      />

      <div className="space-y-4">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-ink">Progress</h2>
              <Badge tone={application.status === 'CANCELLED' ? 'neutral' : 'info'}>
                {application.statusLabel}
              </Badge>
            </div>
            <ProgressSteps steps={application.progress} />
            <p className="text-xs text-ink-subtle">
              Last update: {formatRelativeDay(application.updatedAt)}
            </p>
            {application.nextActionPrompt ? (
              <Link
                href={`/?ask=${encodeURIComponent(application.nextActionPrompt)}`}
                className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-[15px] font-medium text-white hover:bg-accent-strong"
              >
                {application.nextActionLabel ?? 'Continue'}
              </Link>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-[15px] font-semibold text-ink">Timeline</h2>
            <ol className="space-y-3">
              {application.timeline
                .slice()
                .reverse()
                .map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        event.tone === 'success'
                          ? 'bg-ok'
                          : event.tone === 'warning'
                            ? 'bg-wait'
                            : 'bg-accent'
                      }`}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium text-ink">{event.label}</p>
                      {event.detail ? <p className="text-sm text-ink-muted">{event.detail}</p> : null}
                      <p className="text-xs text-ink-subtle">{formatRelativeDay(event.at)}</p>
                    </div>
                  </li>
                ))}
            </ol>
          </CardBody>
        </Card>

        {documents.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Documents attached
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {documents.map((document) =>
                document ? <DocumentCard key={document.id} document={document} /> : null,
              )}
            </div>
          </section>
        ) : null}

        <p className="text-sm text-ink-subtle">
          This is a practice app. Nothing was sent to a government office, and the reference number
          is a sample one.
        </p>
      </div>
    </div>
  );
}
