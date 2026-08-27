'use client';

import * as React from 'react';
import { AlertCircle, Check, Clock, Loader2 } from 'lucide-react';
import type { RequirementState, DocumentState } from '@/types/document';
import type { ChatAction } from '@/types/chat';
import { Badge, Button, Card, CardBody } from '@/components/ui';

interface RequirementsPayload {
  taskId: string;
  title: string;
  status: string;
  ready: number;
  total: number;
  allReady: boolean;
  reference: string | null;
  requirements: RequirementState[];
}

const STATE_VIEW: Record<
  DocumentState,
  { label: string; tone: 'ok' | 'wait' | 'info' | 'stop'; icon: 'check' | 'clock' | 'spin' | 'alert' }
> = {
  AVAILABLE: { label: 'Ready', tone: 'ok', icon: 'check' },
  AVAILABLE_AFTER_PROCESSING: { label: 'Ready', tone: 'ok', icon: 'check' },
  COMPLETED: { label: 'Ready', tone: 'ok', icon: 'check' },
  MISSING: { label: 'Needed', tone: 'wait', icon: 'alert' },
  ACTION_REQUIRED: { label: 'Needs you', tone: 'wait', icon: 'alert' },
  PROCESSING: { label: 'Being sorted', tone: 'info', icon: 'spin' },
  APPLICATION_SUBMITTED: { label: 'Sent to the office', tone: 'info', icon: 'spin' },
  VERIFICATION_PENDING: { label: 'Office checking', tone: 'info', icon: 'spin' },
  NEEDS_UPDATE: { label: 'Needs a change', tone: 'wait', icon: 'alert' },
  LOST: { label: 'Lost', tone: 'wait', icon: 'alert' },
  REJECTED: { label: 'Not accepted', tone: 'stop', icon: 'alert' },
};

/**
 * Live progress of an application and the papers it is waiting for.
 *
 * It refreshes itself while anything is still being sorted out, so "3 of 5"
 * becomes "4 of 5" in front of the citizen without them doing anything.
 */
export function RequirementsCard({
  taskId,
  title,
  onAction,
}: {
  taskId: string;
  title: string;
  onAction?: (action: ChatAction) => void;
}) {
  const [data, setData] = React.useState<RequirementsPayload | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const body = (await res.json()) as { requirements: RequirementsPayload };
      setData(body.requirements);
      return body.requirements;
    } catch {
      return null;
    }
  }, [taskId]);

  React.useEffect(() => {
    let stop = false;
    let lastReady = -1;
    void load();

    const timer = window.setInterval(async () => {
      if (stop) return;
      const next = await load();
      if (!next) return;

      // Only shout when something actually moved: a refresh on every poll
      // would restart anything else on screen.
      if (next.ready !== lastReady) {
        if (lastReady !== -1) window.dispatchEvent(new CustomEvent('ns:data-changed'));
        lastReady = next.ready;
      }

      // Once nothing is moving there is nothing to poll for.
      const settled = !next.requirements.some((requirement) =>
        ['PROCESSING', 'APPLICATION_SUBMITTED', 'VERIFICATION_PENDING'].includes(requirement.state),
      );
      if (settled) window.clearInterval(timer);
    }, 4000);

    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [load]);

  if (!data) {
    return (
      <Card>
        <CardBody className="text-sm text-ink-muted">Loading your progress…</CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <Badge tone={data.allReady ? 'ok' : 'info'}>
            {data.ready} of {data.total} papers ready
          </Badge>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-canvas"
          role="progressbar"
          aria-valuenow={data.ready}
          aria-valuemin={0}
          aria-valuemax={data.total}
          aria-label={`${data.ready} of ${data.total} papers ready`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${data.allReady ? 'bg-ok' : 'bg-accent'}`}
            style={{ width: `${data.total ? (data.ready / data.total) * 100 : 0}%` }}
          />
        </div>

        <ul className="space-y-2">
          {data.requirements.map((requirement) => {
            const view = STATE_VIEW[requirement.state] ?? STATE_VIEW.MISSING;
            const needsUser =
              requirement.state === 'MISSING' || requirement.state === 'ACTION_REQUIRED';
            return (
              <li key={requirement.key} className="flex flex-wrap items-center gap-2">
                {view.icon === 'check' ? (
                  <Check className="size-4 shrink-0 text-ok" aria-hidden="true" />
                ) : view.icon === 'spin' ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden="true" />
                ) : view.icon === 'clock' ? (
                  <Clock className="size-4 shrink-0 text-wait" aria-hidden="true" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 text-wait" aria-hidden="true" />
                )}
                <span className="min-w-[110px] flex-1 text-[15px] text-ink">{requirement.label}</span>
                <Badge tone={view.tone}>{view.label}</Badge>
                {needsUser && onAction ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      onAction({
                        kind: 'action',
                        label: `Sort out ${requirement.label}`,
                        action: 'RESOLVE_REQUIREMENT',
                        payload: { taskId: data.taskId, key: requirement.key },
                      })
                    }
                  >
                    Sort this out
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {data.requirements.some((requirement) => requirement.note) ? (
          <ul className="space-y-1 text-xs text-ink-subtle">
            {data.requirements
              .filter((requirement) => requirement.note)
              .map((requirement) => (
                <li key={`${requirement.key}-note`}>
                  {requirement.label}: {requirement.note}
                </li>
              ))}
          </ul>
        ) : null}

        {data.allReady && onAction ? (
          <Button
            onClick={() =>
              onAction({
                kind: 'action',
                label: 'Check my application',
                action: 'PARENT_REVIEW',
                payload: { taskId: data.taskId },
              })
            }
          >
            Check my application
          </Button>
        ) : null}

        {data.reference ? (
          <p className="text-xs text-ink-subtle">Number to keep: {data.reference}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
