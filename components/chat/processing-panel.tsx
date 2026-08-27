'use client';

import * as React from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { ProcessingPlan } from '@/types/chat';
import { Button, Card, CardBody } from '@/components/ui';

/**
 * The one loading component every service uses.
 *
 * It always says what is happening rather than spinning silently, and if the
 * simulated office takes longer than expected it says that too, so the screen
 * never looks frozen to someone who is already anxious.
 */
export function ProcessingPanel({
  plan,
  onDone,
}: {
  plan: ProcessingPlan;
  onDone: () => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [slow, setSlow] = React.useState(false);
  const [waiting, setWaiting] = React.useState(false);
  const finished = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    let elapsed = 0;

    plan.steps.forEach((step, position) => {
      elapsed += step.ms;
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setIndex(position + 1);
        }, elapsed),
      );
    });

    timers.push(
      window.setTimeout(() => {
        if (cancelled || finished.current) return;
        finished.current = true;
        onDone();
      }, elapsed + 250),
    );

    // If it ever ran long, say so instead of leaving a dead screen.
    timers.push(
      window.setTimeout(() => {
        if (!cancelled && !finished.current) setSlow(true);
      }, Math.max(elapsed + 4000, 6000)),
    );

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [plan, onDone]);

  return (
    <Card className="border-accent/25 bg-accent-soft/40" aria-live="polite">
      <CardBody className="space-y-3">
        <h3 className="text-[15px] font-semibold text-ink">{plan.title}</h3>

        <ol className="space-y-1.5">
          {plan.steps.map((step, position) => {
            const done = position < index;
            const active = position === index;
            return (
              <li key={step.label} className="flex items-center gap-2 text-[15px]">
                {done ? (
                  <Check className="size-4 shrink-0 text-ok" aria-hidden="true" />
                ) : active ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden="true" />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border border-line-strong" aria-hidden="true" />
                )}
                <span className={done ? 'text-ink-muted' : active ? 'font-medium text-ink' : 'text-ink-subtle'}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        {slow && !waiting ? (
          <div className="space-y-2 rounded-lg bg-wait-soft px-3 py-2.5">
            <p className="text-sm text-wait">
              The service is taking a little longer than usual. Your progress is saved.
            </p>
            <Button variant="secondary" onClick={() => setWaiting(true)}>
              Keep waiting
            </Button>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            {plan.reassurance ?? 'Please wait while we finish this step.'}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
