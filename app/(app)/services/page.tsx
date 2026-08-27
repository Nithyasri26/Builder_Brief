import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { allServices } from '@/lib/services/registry';
import { Card, CardBody, PageHeader } from '@/components/ui';
import { formatRelativeDay } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connected services' };

/**
 * Citizen-facing connection page — not an admin console. It answers one
 * question: which services can the assistant reach on my behalf, and where
 * does the real service live?
 */
export default async function ServicesPage() {
  const connections = await Promise.all(
    allServices().map(async (service) => ({
      id: service.id,
      name: service.name,
      officialSource: service.officialSource,
      connection: await service.checkConnection(),
    })),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Connected services"
        description="What I can reach for you, and where the real service lives."
      />

      <div className="space-y-3">
        {connections.map((entry) => {
          const connected = entry.connection.status === 'connected';
          return (
            <Card key={entry.id}>
              <CardBody className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[15px] font-semibold text-ink">{entry.name}</h2>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span
                      className={`size-2 rounded-full ${connected ? 'bg-ok' : 'bg-wait'}`}
                      aria-hidden="true"
                    />
                    <span className={connected ? 'text-ok' : 'text-wait'}>
                      {connected ? 'Connected' : 'Not working now'}
                    </span>
                  </span>
                </div>
                <p className="text-sm text-ink-muted">{entry.connection.message}</p>
                <p className="text-xs text-ink-subtle">
                  Last checked: {formatRelativeDay(entry.connection.checkedAt)}
                </p>
                <a
                  href={entry.officialSource.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                >
                  {entry.officialSource.name}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold text-ink">How this works</h2>
        <p className="text-sm text-ink-muted">
          This is a practice app. Nothing you do here reaches a real government office, no account of
          yours is linked, and no OTP is ever used.
        </p>
        <p className="text-sm text-ink-muted">
          Each service above is a separate connector. When a real, approved connection is added
          later, these screens and conversations stay exactly the same.
        </p>
      </div>
    </div>
  );
}
