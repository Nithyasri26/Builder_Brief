'use client';

import * as React from 'react';
import { FileText, HelpCircle, Landmark, ShieldCheck } from 'lucide-react';
import type { ChatAction } from '@/types/chat';
import type { CitizenDocument, DigiLockerDocument, ResolutionRoute } from '@/types/document';
import { Badge, Button, Card, CardBody, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { formatDate } from '@/lib/utils';

/**
 * "Do you already have it, or do you need help getting it?"
 *
 * This is the card that turns a missing document from a dead end into a
 * conversation. Every option leads somewhere real.
 */
export function DocumentOptionsCard({
  documentKey,
  label,
  why,
  parentTaskId,
  options,
  onAction,
  busy,
}: {
  documentKey: string;
  label: string;
  why: string;
  parentTaskId: string | null;
  options: { route: ResolutionRoute; label: string; hint: string }[];
  onAction?: (action: ChatAction) => void;
  busy?: boolean;
}) {
  const [showWhy, setShowWhy] = React.useState(false);

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Landmark className="size-4 text-ink-subtle" aria-hidden="true" />
            {label}
          </h3>
          <button
            type="button"
            onClick={() => setShowWhy(true)}
            className="min-h-9 text-sm font-medium text-accent hover:underline"
          >
            Why is this needed?
          </button>
        </div>

        <div className="grid gap-2">
          {options.map((option) => (
            <button
              key={option.route}
              type="button"
              disabled={busy || !onAction}
              onClick={() =>
                onAction?.({
                  kind: 'action',
                  label: option.label,
                  action: 'DOC_ROUTE',
                  payload: { documentKey, route: option.route, parentTaskId },
                })
              }
              className="rounded-lg border border-line-strong px-4 py-3 text-left transition-colors hover:border-accent disabled:opacity-60"
            >
              <span className="block text-[15px] font-medium text-ink">{option.label}</span>
              <span className="block text-sm text-ink-muted">{option.hint}</span>
            </button>
          ))}
        </div>
      </CardBody>

      <Modal open={showWhy} onClose={() => setShowWhy(false)} title={`Why is my ${label} needed?`}>
        <p className="text-[15px] text-ink-muted">{why}</p>
        <p className="mt-3 flex items-start gap-2 text-sm text-ink-subtle">
          <HelpCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          You are never asked for a paper the service does not use.
        </p>
      </Modal>
    </Card>
  );
}

/** Pick the paper from what the citizen already holds, or add a new one. */
export function DocumentPickerCard({
  childTaskId,
  label,
  candidates,
  locker,
  onAction,
  busy,
}: {
  childTaskId: string;
  label: string;
  candidates: CitizenDocument[];
  locker: DigiLockerDocument[];
  onAction?: (action: ChatAction) => void;
  busy?: boolean;
}) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <h3 className="text-[15px] font-semibold text-ink">Your {label}</h3>

        {candidates.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              In your papers
            </p>
            {candidates.map((document) => (
              <div
                key={document.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <FileText className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                <span className="min-w-[120px] flex-1 text-[15px] text-ink">{document.name}</span>
                <Button
                  disabled={busy || !onAction}
                  onClick={() =>
                    onAction?.({
                      kind: 'action',
                      label: 'Use this one',
                      action: 'DOC_PICK',
                      payload: { childTaskId, documentId: document.id },
                    })
                  }
                >
                  Use this one
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {locker.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              In your online locker
            </p>
            {locker.map((document) => (
              <div
                key={document.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <ShieldCheck className="size-4 shrink-0 text-ok" aria-hidden="true" />
                <span className="min-w-[120px] flex-1">
                  <span className="block text-[15px] text-ink">{document.name}</span>
                  <span className="block text-xs text-ink-subtle">
                    {document.issuer} · {formatDate(document.issuedOn)}
                  </span>
                </span>
                <Button
                  disabled={busy || !onAction}
                  onClick={() =>
                    onAction?.({
                      kind: 'action',
                      label: 'Use this one',
                      action: 'DOC_PICK_LOCKER',
                      payload: { childTaskId, digiLockerId: document.id },
                    })
                  }
                >
                  Use this one
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {candidates.length === 0 && locker.length === 0 ? (
          <p className="text-[15px] text-ink-muted">
            I could not find it in your papers. You can add a photo or a PDF of it.
          </p>
        ) : null}

        <a
          href="/documents"
          className="inline-flex h-11 items-center rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
        >
          Add a photo or PDF
        </a>
      </CardBody>
    </Card>
  );
}

/** Shows what is already on file, so nothing is typed twice. */
export function ProfileConfirmCard({
  childTaskId,
  rows,
  onAction,
  busy,
}: {
  childTaskId: string;
  rows: { key: string; label: string; value: string }[];
  onAction?: (action: ChatAction) => void;
  busy?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  const editable = React.useMemo(
    () => rows.filter((row) => ['name', 'address', 'mobile', 'email'].includes(row.key)),
    [rows],
  );

  React.useEffect(() => {
    if (!editing) return;
    const initial: Record<string, string> = {};
    for (const row of editable) initial[row.key] = row.value;
    setDraft(initial);
  }, [editing, editable]);

  return (
    <Card>
      <CardBody className="space-y-3">
        <h3 className="text-[15px] font-semibold text-ink">Your details</h3>
        <dl className="rounded-lg border border-line">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5 text-sm last:border-b-0"
            >
              <dt className="text-ink-muted">{row.label}</dt>
              <dd className="font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-ink-muted">
          I already have these, so you do not have to type them again.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !onAction}
            onClick={() =>
              onAction?.({
                kind: 'action',
                label: 'These are right',
                action: 'DOC_CONFIRM_PROFILE',
                payload: { childTaskId },
              })
            }
          >
            These are right
          </Button>
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
            Something needs changing
          </Button>
        </div>
      </CardBody>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Change your details"
        description="Only change what is wrong. Everything else stays as it is."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setEditing(false);
                const patch: Record<string, string> = {};
                if (draft.name) patch.name = draft.name;
                if (draft.mobile) patch.mobile = draft.mobile;
                if (draft.email) patch.email = draft.email;
                if (draft.address) patch.city = draft.address.split(',')[0]?.trim() ?? draft.address;
                onAction?.({
                  kind: 'action',
                  label: 'Save changes',
                  action: 'DOC_EDIT_PROFILE',
                  payload: { childTaskId, patch },
                });
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editable.map((row) => (
            <Field key={row.key} label={row.label} htmlFor={`edit-${row.key}`}>
              <Input
                id={`edit-${row.key}`}
                value={draft[row.key] ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [row.key]: event.target.value }))
                }
              />
            </Field>
          ))}
          <p className="text-sm text-ink-subtle">
            If you change your mobile number, we will send a code to check it is yours.
          </p>
        </div>
      </Modal>
    </Card>
  );
}

/** One short question with a typed answer. */
export function TextInputCard({
  childTaskId,
  action,
  field,
  label,
  placeholder,
  help,
  current,
  onAction,
  busy,
}: {
  childTaskId: string;
  action: string;
  field: string;
  label: string;
  placeholder?: string;
  help?: string;
  current?: string;
  onAction?: (action: ChatAction) => void;
  busy?: boolean;
}) {
  const [value, setValue] = React.useState(current ?? '');
  const inputId = React.useId();

  return (
    <Card>
      <CardBody>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!value.trim()) return;
            onAction?.({
              kind: 'action',
              label: 'Continue',
              action,
              payload: { childTaskId, field, value: value.trim() },
            });
          }}
        >
          <Field label={label} htmlFor={inputId} hint={help}>
            <Input
              id={inputId}
              value={value}
              placeholder={placeholder}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy || !value.trim() || !onAction}>
            Continue
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

/** Demo one-time code. Never a real OTP. */
export function OtpCard({
  childTaskId,
  mobile,
  alreadySent,
  onAction,
  busy,
}: {
  childTaskId: string;
  mobile: string;
  alreadySent?: boolean;
  onAction?: (action: ChatAction) => void;
  busy?: boolean;
}) {
  const [code, setCode] = React.useState('');
  const [sent, setSent] = React.useState(Boolean(alreadySent));
  const inputId = React.useId();

  return (
    <Card>
      <CardBody className="space-y-3">
        <h3 className="text-[15px] font-semibold text-ink">Check your mobile number</h3>
        <p className="text-[15px] text-ink-muted">
          We will send a code to <strong>{mobile}</strong> to make sure it is yours.
        </p>

        {!sent ? (
          <Button onClick={() => setSent(true)} disabled={busy}>
            Send the code
          </Button>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onAction?.({
                kind: 'action',
                label: 'Check the code',
                action: 'DOC_OTP',
                payload: { childTaskId, value: code.trim() },
              });
            }}
          >
            <Badge tone="wait">Practice code: 123456</Badge>
            <Field label="Enter the code" htmlFor={inputId}>
              <Input
                id={inputId}
                inputMode="numeric"
                maxLength={6}
                value={code}
                placeholder="123456"
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || code.length < 6 || !onAction}>
                Check the code
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSent(false)} disabled={busy}>
                Send it again
              </Button>
            </div>
          </form>
        )}

        <p className="text-xs text-ink-subtle">
          This is a practice app, so no real message is sent and no real number is used.
        </p>
      </CardBody>
    </Card>
  );
}
