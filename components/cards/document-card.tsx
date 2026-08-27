'use client';

import * as React from 'react';
import { Download, Eye, FileText, Mail, ShieldCheck } from 'lucide-react';
import type { CitizenDocument } from '@/types/document';
import { Badge, Button, Card, CardBody, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/utils';

const CATEGORY_LABEL: Record<string, string> = {
  identity: 'Identity',
  education: 'Education',
  employment: 'Employment',
  bank: 'Bank',
  family: 'Family',
  government: 'Government',
};

const VERIFICATION_LABEL: Record<string, { label: string; tone: 'ok' | 'wait' | 'info' }> = {
  demo_verified: { label: 'Checked', tone: 'ok' },
  demo_imported: { label: 'From your locker', tone: 'info' },
  unverified: { label: 'Added by you', tone: 'wait' },
};

const PURPOSE_LABEL: Record<string, string> = {
  identity_proof: 'proof of who you are',
  address_proof: 'proof of where you live',
  dob_proof: 'proof of your date of birth',
  income_proof: 'proof of income',
  bank_proof: 'bank details',
  child_birth_proof: 'your child’s birth record',
  education_proof: 'proof of schooling',
  employment_proof: 'proof of work',
  aadhaar_document: 'Aadhaar',
  birth_certificate: 'birth certificate',
};

function purposeLabel(purpose: string): string {
  return PURPOSE_LABEL[purpose] ?? purpose.replace(/_/g, ' ');
}

export function DocumentCard({ document }: { document: CitizenDocument }) {
  const [emailState, setEmailState] = React.useState<'idle' | 'sending' | 'sent'>('idle');
  const verification = VERIFICATION_LABEL[document.verification] ?? VERIFICATION_LABEL.unverified;

  async function sendEmail() {
    setEmailState('sending');
    try {
      await fetch(`/api/documents/${document.id}/email`, { method: 'POST' });
      setEmailState('sent');
    } catch {
      setEmailState('idle');
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold text-ink">{document.name}</h3>
            <p className="truncate text-xs text-ink-subtle">{document.fileName}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral">{CATEGORY_LABEL[document.category] ?? document.category}</Badge>
          <Badge tone={verification.tone}>{verification.label}</Badge>
        </div>

        <p className="text-sm text-ink-muted">
          {document.issuedOn ? `From ${formatDate(document.issuedOn)}. ` : ''}
          {document.sourceLabel}.
        </p>

        <p className="flex items-start gap-1.5 text-xs text-ink-subtle">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Used for: {document.purposes.map(purposeLabel).join(', ')}
        </p>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/documents/${document.id}/file?inline=1`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
          >
            <Eye className="size-4" aria-hidden="true" />
            Open
          </a>
          <a
            href={`/api/documents/${document.id}/file`}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
          >
            <Download className="size-4" aria-hidden="true" />
            Save
          </a>
          <Button
            variant="secondary"
            onClick={sendEmail}
            disabled={emailState !== 'idle'}
            aria-live="polite"
          >
            {emailState === 'sending' ? <Spinner /> : <Mail className="size-4" aria-hidden="true" />}
            {emailState === 'sent' ? 'Sent to your email' : 'Email it to me'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
