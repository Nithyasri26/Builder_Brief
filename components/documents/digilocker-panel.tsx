'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Link2 } from 'lucide-react';
import type { DigiLockerDocument } from '@/types/document';
import { Button, Card, CardBody, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/utils';

/**
 * The simulated document locker. This prototype never touches a real
 * DigiLocker account; the About page says so plainly.
 */
export function DigiLockerPanel({ documents }: { documents: DigiLockerDocument[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function importDocument(documentId: string) {
    setBusyId(documentId);
    setError(null);
    try {
      const response = await fetch('/api/digilocker/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      if (!response.ok) throw new Error('That paper could not be saved just now.');
      window.dispatchEvent(new CustomEvent('ns:data-changed'));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Link2 className="size-4 text-accent" aria-hidden="true" />
            Your online locker
          </h2>
        </div>
        <p className="text-sm text-ink-muted">
          Papers already issued to you can be saved here in one tap, instead of uploading them.
        </p>

        <ul className="divide-y divide-line rounded-lg border border-line">
          {documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <div className="min-w-[150px] flex-1">
                <p className="text-sm font-medium text-ink">{document.name}</p>
                <p className="text-xs text-ink-subtle">
                  {document.issuer} · {formatDate(document.issuedOn)}
                </p>
              </div>
              {document.imported ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-ok">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Saved
                </span>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => importDocument(document.id)}
                  disabled={busyId !== null}
                >
                  {busyId === document.id ? <Spinner /> : null}
                  Save it
                </Button>
              )}
            </li>
          ))}
        </ul>

        {error ? (
          <p role="alert" className="rounded-lg bg-stop-soft px-3 py-2 text-sm text-stop">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
