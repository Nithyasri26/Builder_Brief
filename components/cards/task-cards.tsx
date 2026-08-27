'use client';

import Link from 'next/link';
import { AlertTriangle, Check, ChevronRight, Circle, Loader2 } from 'lucide-react';
import type { ApplicationView, CitizenTask, TaskStatus } from '@/types/task';
import type { ChatAction } from '@/types/chat';
import { Badge, Button, Card, CardBody } from '@/components/ui';
import { cn, formatRelativeDay } from '@/lib/utils';

const STATUS_TONE: Record<TaskStatus, 'ok' | 'wait' | 'info' | 'stop' | 'neutral'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  WAITING_FOR_USER: 'wait',
  WAITING_FOR_DOCUMENT: 'wait',
  WAITING_FOR_CONFIRMATION: 'wait',
  SUBMITTED: 'ok',
  PROCESSING: 'info',
  COMPLETED: 'ok',
  CANCELLED: 'neutral',
};

export interface StepView {
  id: string;
  label: string;
  state: 'done' | 'current' | 'pending';
}

export function ProgressSteps({ steps }: { steps: StepView[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-2 text-sm">
          {step.state === 'done' ? (
            <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
          ) : step.state === 'current' ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 text-wait" aria-hidden="true" />
          ) : (
            <Circle className="mt-0.5 size-4 shrink-0 text-line-strong" aria-hidden="true" />
          )}
          <span
            className={cn(
              step.state === 'done'
                ? 'text-ink-muted'
                : step.state === 'current'
                  ? 'font-semibold text-ink'
                  : 'text-ink-subtle',
            )}
          >
            {step.label}
            {step.state === 'current' ? <span className="sr-only"> (current step)</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TaskProgressCard({
  task,
  steps,
  onAction,
}: {
  task: CitizenTask;
  steps: StepView[];
  onAction?: (action: ChatAction) => void;
}) {
  const paused = task.status === 'WAITING_FOR_USER' || task.status === 'WAITING_FOR_DOCUMENT';
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-ink">{task.title}</h3>
          <Badge tone={STATUS_TONE[task.status]}>{statusLabel(task.status)}</Badge>
        </div>
        <ProgressSteps steps={steps} />
        {task.applicationId ? (
          <p className="text-xs text-ink-subtle">Reference: {task.applicationId}</p>
        ) : null}
        {paused && task.nextActionPrompt && onAction ? (
          <Button
            variant="secondary"
            onClick={() =>
              onAction({
                kind: 'action',
                label: 'Continue',
                action: 'CONTINUE_TASK',
                payload: { taskId: task.id },
              })
            }
          >
            Continue
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function statusLabel(status: TaskStatus): string {
  switch (status) {
    case 'NOT_STARTED':
      return 'Not started';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'WAITING_FOR_USER':
      return 'Waiting for you';
    case 'WAITING_FOR_DOCUMENT':
      return 'Waiting for a document';
    case 'WAITING_FOR_CONFIRMATION':
      return 'Waiting for confirmation';
    case 'SUBMITTED':
      return 'Sent';
    case 'PROCESSING':
      return 'Being processed';
    case 'COMPLETED':
      return 'Done';
    default:
      return 'Cancelled';
  }
}

export function ApplicationCard({ application }: { application: ApplicationView }) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">{application.title}</h3>
            <p className="text-xs text-ink-subtle">
              {application.serviceLabel} ·{' '}
              {application.reference === 'Not submitted'
                ? 'Not sent yet'
                : `Number ${application.reference}`}
            </p>
            {application.requiredFor ? (
              <p className="text-xs font-medium text-accent">
                Needed for your {application.requiredFor}
              </p>
            ) : null}
          </div>
          <Badge tone={STATUS_TONE[application.status]}>{application.statusLabel}</Badge>
        </div>

        {application.papers ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Papers</span>
              <span className="font-medium text-ink">
                {application.papers.ready} of {application.papers.total} ready
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
              <div
                className={`h-full rounded-full ${
                  application.papers.ready === application.papers.total ? 'bg-ok' : 'bg-accent'
                }`}
                style={{ width: `${(application.papers.ready / application.papers.total) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        <ProgressSteps steps={application.progress.slice(0, 6)} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <p className="text-xs text-ink-subtle">
            Last update: {formatRelativeDay(application.updatedAt)}
          </p>
          <div className="flex flex-wrap gap-2">
            {application.nextActionPrompt ? (
              <Link
                href={`/?ask=${encodeURIComponent(application.nextActionPrompt)}`}
                className="inline-flex h-11 items-center gap-1 rounded-lg bg-accent px-4 text-[15px] font-medium text-white hover:bg-accent-strong"
              >
                {application.nextActionLabel ?? 'Continue'}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
            <Link
              href={`/applications/${application.taskId}`}
              className="inline-flex h-11 items-center rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
            >
              See details
            </Link>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function ReviewCard({
  title,
  rows,
  warning,
  confirm,
  cancel,
  onAction,
  busy,
}: {
  title: string;
  rows: { label: string; value: string }[];
  warning: string;
  confirm: ChatAction;
  cancel: ChatAction;
  onAction?: (action: ChatAction) => void;
  busy?: boolean;
}) {
  return (
    <Card className="border-wait/40">
      <CardBody className="space-y-4">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <dl className="rounded-lg border border-line">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5 text-sm last:border-b-0"
            >
              <dt className="text-ink-muted">{row.label}</dt>
              <dd className="font-semibold text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-start gap-2 rounded-lg bg-wait-soft px-3 py-2.5 text-sm text-wait">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {warning}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onAction?.(confirm)} disabled={busy || !onAction}>
            {confirm.label}
          </Button>
          <Button variant="secondary" onClick={() => onAction?.(cancel)} disabled={busy || !onAction}>
            {cancel.label}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
