'use client';

import * as React from 'react';
import { Check, ExternalLink, HelpCircle, Minus, X } from 'lucide-react';
import type { MatchLevel, SchemeMatch } from '@/types/scheme';
import { Badge, Button, Card, CardBody } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import type { ChatAction } from '@/types/chat';

const LEVEL: Record<MatchLevel, { label: string; tone: 'ok' | 'wait' | 'stop'; dot: string }> = {
  potential_match: { label: 'You may be able to get this', tone: 'ok', dot: '🟢' },
  more_information_required: { label: 'Need to know more', tone: 'wait', dot: '🟡' },
  not_matching: { label: 'Not for you', tone: 'stop', dot: '🔴' },
};

export function SchemeCard({
  match,
  onAction,
  defaultExpanded,
}: {
  match: SchemeMatch;
  onAction?: (action: ChatAction) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(Boolean(defaultExpanded));
  const [why, setWhy] = React.useState<{ label: string; text: string } | null>(null);
  const level = LEVEL[match.level];
  const scheme = match.scheme;

  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true">{level.dot}</span>
          <Badge tone={level.tone}>{level.label}</Badge>
          {scheme.isDemoScheme ? null : <Badge tone="info">Government programme</Badge>}
        </div>

        <div>
          <h3 className="text-[17px] font-semibold leading-snug text-ink">{scheme.name}</h3>
          <p className="mt-1 text-[15px] text-ink-muted">{scheme.description}</p>
          {scheme.isDemoScheme ? (
            <p className="mt-1 text-[15px] font-medium text-ok">{scheme.benefitSummary}</p>
          ) : null}
        </div>

        {match.outcomes.length > 0 ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {match.level === 'potential_match' ? 'Why this fits you' : 'What was checked'}
            </h4>
            <ul className="mt-1.5 space-y-1">
              {match.outcomes.map((outcome) => (
                <li key={outcome.ruleId} className="flex items-start gap-2 text-sm">
                  {outcome.result === 'met' ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
                  ) : outcome.result === 'not_met' ? (
                    <X className="mt-0.5 size-4 shrink-0 text-stop" aria-hidden="true" />
                  ) : (
                    <Minus className="mt-0.5 size-4 shrink-0 text-wait" aria-hidden="true" />
                  )}
                  <span className="text-ink-muted">
                    {outcome.label}
                    {outcome.result === 'unknown' ? ' — I do not know this yet' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-lg bg-info-soft px-3 py-2 text-sm text-info">
            The government decides who can get this one. Open their website to check.
          </p>
        )}

        {expanded ? (
          <div className="space-y-3 border-t border-line pt-3">
            {scheme.requiredDocuments.length > 0 ? (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Papers you need
                </h4>
                <ul className="mt-1.5 space-y-1.5">
                  {match.documents.map((document) => (
                    <li key={document.key} className="flex items-start gap-2 text-sm">
                      {document.available ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
                      ) : (
                        <Minus className="mt-0.5 size-4 shrink-0 text-wait" aria-hidden="true" />
                      )}
                      <span className="flex-1 text-ink-muted">
                        {document.label}
                        {document.available ? (
                          <span className="text-ok"> — you have this</span>
                        ) : (
                          <span className="text-ink-subtle"> — you do not have this yet</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setWhy({ label: document.label, text: document.why })}
                        className="-my-2 shrink-0 px-2 py-2 text-sm font-medium text-accent hover:underline"
                      >
                        Why?
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-subtle">You get</dt>
                <dd className="text-ink-muted">{scheme.benefitSummary}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-subtle">How long it takes</dt>
                <dd className="text-ink-muted">{scheme.processingTime}</dd>
              </div>
              {scheme.sourceUrl ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-ink-subtle">Official website</dt>
                  <dd className="text-ink-muted">
                    <a
                      href={scheme.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      {scheme.officialSource}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {scheme.isDemoScheme && match.level !== 'not_matching' && onAction ? (
            <Button
              onClick={() =>
                onAction({
                  kind: 'action',
                  label: 'Apply for this',
                  action: 'START_SCHEME_APPLICATION',
                  payload: { schemeId: scheme.id },
                })
              }
            >
              Apply for this
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Hide details' : 'Tell me more'}
          </Button>
          {!scheme.isDemoScheme && scheme.sourceUrl ? (
            <a
              href={scheme.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
            >
              Open their website
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </CardBody>

      <Modal
        open={Boolean(why)}
        onClose={() => setWhy(null)}
        title={why ? `Why do they need my ${why.label.toLowerCase()}?` : ''}
      >
        <p className="text-[15px] text-ink-muted">{why?.text}</p>
        <p className="mt-3 flex items-start gap-2 text-sm text-ink-subtle">
          <HelpCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          You are never asked for a paper the service does not use. If you already have it, I use it
          instead of asking you again.
        </p>
      </Modal>
    </Card>
  );
}
