'use client';

import { ArrowRight, Clock, ExternalLink, Landmark, Mail, Train } from 'lucide-react';
import type { PassbookSummary, SourceRef, EmailReceipt, ChatAction } from '@/types/chat';
import type { TrainOption } from '@/types/train';
import type { DigiLockerDocument } from '@/types/document';
import { Badge, Button, Card, CardBody } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

export function SourceLine({ source }: { source?: SourceRef }) {
  if (!source) return null;
  return (
    <p className="text-xs text-ink-subtle">
      Source:{' '}
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          {source.name}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      ) : (
        source.name
      )}
      {source.lastVerified ? ` · checked ${source.lastVerified}` : ''}
    </p>
  );
}

export function PassbookCard({
  passbook,
  source,
}: {
  passbook: PassbookSummary;
  source?: SourceRef;
}) {
  const rows = [
    { label: 'Employee contribution', value: formatCurrency(passbook.employeeContribution) },
    { label: 'Employer contribution', value: formatCurrency(passbook.employerContribution) },
    { label: 'Interest', value: formatCurrency(passbook.interest) },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-accent-soft px-4 py-3 sm:px-5">
        <span className="grid size-10 place-items-center rounded-lg bg-accent text-white">
          <Landmark className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-ink">Your provident fund</h3>
          <p className="truncate text-xs text-ink-muted">{passbook.employer}</p>
        </div>

      </div>
      <CardBody className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">UAN</dt>
            <dd className="font-medium text-ink">{passbook.uan}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">Account</dt>
            <dd className="break-all font-medium text-ink">{passbook.memberId}</dd>
          </div>
        </dl>

        <div className="rounded-lg border border-line">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-line px-3 py-2.5 text-sm last:border-b-0"
            >
              <span className="text-ink-muted">{row.label}</span>
              <span className="font-semibold text-ink">{row.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-ok-soft px-3 py-3">
            <span className="text-sm font-semibold text-ok">Money you have</span>
            <span className="text-lg font-bold text-ok">{formatCurrency(passbook.balance)}</span>
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <Clock className="size-3.5" aria-hidden="true" />
          Statement updated {passbook.lastUpdated}
        </p>
        <SourceLine source={source} />
      </CardBody>
    </Card>
  );
}

export function TrainList({
  options,
  summary,
  taskId,
  onAction,
}: {
  options: TrainOption[];
  summary: string;
  taskId: string;
  onAction?: (action: ChatAction) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{summary}</p>
      {options.map((train) => (
        <Card key={train.id}>
          <CardBody className="flex flex-wrap items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <Train className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-[180px] flex-1">
              <h3 className="text-[15px] font-semibold text-ink">
                {train.number} {train.name}
              </h3>
              <p className="text-sm text-ink-muted">
                {train.from} → {train.to} · {train.travelClass}
              </p>
              <p className="text-sm text-ink-muted">
                {train.departure} → {train.arrival} · {train.duration}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-ink">{formatCurrency(train.fare)}</p>
              <p className="text-xs text-ink-subtle">{train.availability}</p>
            </div>
            {onAction ? (
              <Button
                size="sm"
                onClick={() =>
                  onAction({
                    kind: 'action',
                    label: 'Select',
                    action: 'SELECT_TRAIN',
                    payload: { taskId, trainId: train.id },
                  })
                }
              >
                Select
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export function DigiLockerList({
  documents,
  onAction,
}: {
  documents: DigiLockerDocument[];
  onAction?: (action: ChatAction) => void;
}) {
  return (
    <div className="space-y-2">
      {documents.map((document) => (
        <Card key={document.id}>
          <CardBody className="flex flex-wrap items-center gap-3">
            <div className="min-w-[160px] flex-1">
              <h3 className="text-[15px] font-semibold text-ink">{document.name}</h3>
              <p className="text-xs text-ink-muted">
                Issued by {document.issuer} · {formatDate(document.issuedOn)}
              </p>
              <p className="text-xs text-ink-subtle">In your online locker</p>
            </div>
            {document.imported ? (
              <Badge tone="ok">Already saved</Badge>
            ) : onAction ? (
              <Button
                size="sm"
                onClick={() =>
                  onAction({
                    kind: 'action',
                    label: 'Save it',
                    action: 'IMPORT_DIGILOCKER',
                    payload: { digiLockerId: document.id },
                  })
                }
              >
                Save it
              </Button>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export function EmailReceiptCard({ receipt }: { receipt: EmailReceipt }) {
  return (
    <Card className="border-ok/30 bg-ok-soft">
      <CardBody className="space-y-2">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ok">
          <Mail className="size-4" aria-hidden="true" />
          Email sent
        </h3>
        <dl className="space-y-1 text-sm text-ink-muted">
          <div className="flex gap-2">
            <dt className="w-20 text-ink-subtle">To</dt>
            <dd className="break-all">{receipt.to}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 text-ink-subtle">Subject</dt>
            <dd>{receipt.subject}</dd>
          </div>
          {receipt.attachment ? (
            <div className="flex gap-2">
              <dt className="w-20 text-ink-subtle">Attachment</dt>
              <dd className="break-all">{receipt.attachment}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="w-20 text-ink-subtle">Status</dt>
            <dd>Sent</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
