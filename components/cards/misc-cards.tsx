'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  CircleAlert,
  Download,
  FileDown,
  Info,
  Lightbulb,
  Mail,
  Minus,
} from 'lucide-react';
import type { CitizenNotification } from '@/types/notification';
import type { DownloadFile } from '@/types/document';
import type { SourceRef } from '@/types/chat';
import { Badge, Button, Card, CardBody, Spinner } from '@/components/ui';
import { formatRelativeDay } from '@/lib/utils';
import { SourceLine } from './service-cards';
import * as React from 'react';

const NOTICE_STYLES = {
  info: { wrap: 'border-info/25 bg-info-soft text-info', Icon: Info },
  success: { wrap: 'border-ok/25 bg-ok-soft text-ok', Icon: Check },
  warning: { wrap: 'border-wait/30 bg-wait-soft text-wait', Icon: AlertTriangle },
  danger: { wrap: 'border-stop/25 bg-stop-soft text-stop', Icon: CircleAlert },
} as const;

export function NoticeCard({
  tone,
  title,
  body,
  source,
}: {
  tone: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  body: string;
  source?: SourceRef;
}) {
  const style = NOTICE_STYLES[tone];
  const Icon = style.Icon;
  return (
    <div className={`rounded-[var(--radius-card)] border px-4 py-3 ${style.wrap}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          {body.split('\n').map((line) => (
            <p key={line} className="text-sm leading-relaxed">
              {line}
            </p>
          ))}
          {source ? (
            <div className="mt-1.5">
              <SourceLine source={source} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ChecklistCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; state: 'done' | 'pending' | 'missing' }[];
}) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-start gap-2 text-sm">
              {item.state === 'done' ? (
                <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
              ) : item.state === 'missing' ? (
                <Minus className="mt-0.5 size-4 shrink-0 text-wait" aria-hidden="true" />
              ) : (
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              )}
              <span className="text-ink-muted">{item.label}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export function ExplainCard({
  term,
  meaning,
  example,
}: {
  term: string;
  meaning: string;
  example?: string;
}) {
  return (
    <Card className="border-accent/25 bg-accent-soft">
      <CardBody className="space-y-1.5">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-accent">
          <BookOpen className="size-4" aria-hidden="true" />
          {term}
        </h3>
        <p className="text-sm text-ink-muted">{meaning}</p>
        {example ? <p className="text-sm text-ink-subtle">{example}</p> : null}
      </CardBody>
    </Card>
  );
}

export function WhyCard({ title, reasons }: { title: string; reasons: string[] }) {
  return (
    <Card>
      <CardBody className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
        <ul className="space-y-1">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-sm text-ink-muted">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export function NotificationItem({
  notification,
  onRead,
}: {
  notification: CitizenNotification;
  onRead?: (id: string) => void;
}) {
  return (
    <Card className={notification.read ? undefined : 'border-accent/30'}>
      <CardBody className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Bell className="size-4 text-ink-subtle" aria-hidden="true" />
            {notification.title}
          </h3>
          <div className="flex items-center gap-2">
            {!notification.read ? <Badge tone="info">New</Badge> : null}
            {notification.tone === 'action_required' ? (
              <Badge tone="wait">Needs you</Badge>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-ink-muted">{notification.body}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-subtle">{formatRelativeDay(notification.createdAt)}</p>
          <div className="flex gap-2">
            {notification.actionPrompt ? (
              <Link
                href={`/?ask=${encodeURIComponent(notification.actionPrompt)}`}
                className="inline-flex h-11 items-center rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
              >
                {notification.actionLabel ?? 'Open'}
              </Link>
            ) : null}
            {!notification.read && onRead ? (
              <Button variant="ghost" onClick={() => onRead(notification.id)}>
                Mark as read
              </Button>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function DownloadRow({ file }: { file: DownloadFile }) {
  const [emailState, setEmailState] = React.useState<'idle' | 'sending' | 'sent'>('idle');

  async function sendEmail() {
    setEmailState('sending');
    try {
      await fetch(`/api/downloads/${file.id}/email`, { method: 'POST' });
      setEmailState('sent');
    } catch {
      setEmailState('idle');
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <FileDown className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-[180px] flex-1">
          <h3 className="text-[15px] font-semibold text-ink">{file.title}</h3>
          <p className="break-all text-xs text-ink-subtle">{file.fileName}</p>
          <p className="text-xs text-ink-subtle">Created {formatRelativeDay(file.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/downloads/${file.id}/file?inline=1`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-11 items-center rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
          >
            Open
          </a>
          <a
            href={`/api/downloads/${file.id}/file`}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
          >
            <Download className="size-4" aria-hidden="true" />
            Save
          </a>
          <Button variant="secondary" onClick={sendEmail} disabled={emailState !== 'idle'}>
            {emailState === 'sending' ? <Spinner /> : <Mail className="size-4" aria-hidden="true" />}
            {emailState === 'sent' ? 'Sent to your email' : 'Email it to me'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
