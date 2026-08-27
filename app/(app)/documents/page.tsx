import type { Metadata } from 'next';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';
import { DocumentCard } from '@/components/cards/document-card';
import { UploadForm } from '@/components/documents/upload-form';
import { DigiLockerPanel } from '@/components/documents/digilocker-panel';
import { Badge, Card, CardBody, PageHeader } from '@/components/ui';
import type { DocumentCategory } from '@/types/document';
import { settleBackgroundWork } from '@/lib/workflows/background';
import { documentDefinition } from '@/data/demo/document-catalogue';
import { formatRelativeDay } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Documents' };

const ORDER: { key: DocumentCategory; label: string }[] = [
  { key: 'identity', label: 'Identity' },
  { key: 'education', label: 'Education' },
  { key: 'employment', label: 'Employment' },
  { key: 'bank', label: 'Bank' },
  { key: 'family', label: 'Family' },
  { key: 'government', label: 'Government' },
];

export default async function DocumentsPage() {
  const userId = await getCurrentUserId();
  await settleBackgroundWork(userId);
  const db = getDatabase();
  const [documents, digiLocker, tasks] = await Promise.all([
    db.listDocuments(userId),
    db.listDigiLockerDocuments(userId),
    db.listTasks(userId),
  ]);

  // Papers still being sorted out belong here too, so the citizen can see
  // where each one has got to without hunting for it.
  const inFlight = tasks.filter(
    (task) => task.serviceType === 'DOCUMENT' && ['PROCESSING', 'WAITING_FOR_USER'].includes(task.status),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="My papers"
        description="Your papers stay here, so no service asks you for the same thing twice."
      />

      <div className="space-y-8">
        {inFlight.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Being sorted out
            </h2>
            <div className="space-y-3">
              {inFlight.map((task) => {
                const definition = documentDefinition(String(task.data.documentKey ?? ''));
                const processing = task.status === 'PROCESSING';
                return (
                  <Card key={task.id}>
                    <CardBody className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[150px] flex-1">
                        <h3 className="text-[15px] font-semibold text-ink">{definition.label}</h3>
                        <p className="text-xs text-ink-subtle">
                          {processing ? `With ${definition.issuedBy}` : 'Waiting for you'} ·{' '}
                          {formatRelativeDay(task.updatedAt)}
                        </p>
                        {task.applicationId ? (
                          <p className="text-xs text-ink-subtle">Number: {task.applicationId}</p>
                        ) : null}
                      </div>
                      <Badge tone={processing ? 'info' : 'wait'}>
                        {processing ? 'Being sorted' : 'Needs you'}
                      </Badge>
                      {!processing ? (
                        <a
                          href={`/?ask=${encodeURIComponent(`Continue my ${definition.label.toLowerCase()}`)}`}
                          className="inline-flex h-11 items-center rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
                        >
                          Carry on
                        </a>
                      ) : null}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}

        {ORDER.map((category) => {
          const items = documents.filter((document) => document.category === category.key);
          if (items.length === 0) return null;
          return (
            <section key={category.key}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {category.label}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </div>
            </section>
          );
        })}

        <section className="grid gap-4 lg:grid-cols-2">
          <DigiLockerPanel documents={digiLocker} />
          <UploadForm />
        </section>

        <p className="text-sm text-ink-subtle">
          This is a practice app, so these are sample papers. Get your real ones from the office that
          issued them, or from your own DigiLocker account.
        </p>
      </div>
    </div>
  );
}
