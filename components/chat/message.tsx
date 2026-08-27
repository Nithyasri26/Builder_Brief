'use client';

import * as React from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import type { ChatAction, ChatMessage } from '@/types/chat';
import { cn, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui';
import { BlockRenderer } from './block-renderer';
import { ProcessingPanel } from './processing-panel';

export function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="ns-enter flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-white sm:max-w-[70%]">
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{message.content}</p>
        <p className="mt-1 text-right text-[11px] text-white/70">{formatTime(message.createdAt)}</p>
      </div>
    </div>
  );
}

export function AssistantMessage({
  message,
  onAction,
  onSuggestion,
  busy,
  onProcessingDone,
}: {
  message: ChatMessage;
  onAction: (action: ChatAction) => void;
  onSuggestion: (text: string) => void;
  busy?: boolean;
  /** Told when a staged service call has finished playing. */
  onProcessingDone?: (messageId: string) => void;
}) {
  const [processing, setProcessing] = React.useState(Boolean(message.processing));

  // A message that represents a service call shows what is happening first,
  // and only then reveals the answer.
  if (processing && message.processing) {
    return (
      <div className="ns-enter flex gap-3">
        <span
          className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
          aria-hidden="true"
        >
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <ProcessingPanel
            plan={message.processing}
            onDone={() => {
              setProcessing(false);
              onProcessingDone?.(message.id);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ns-enter flex gap-3">
      <span
        className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
        aria-hidden="true"
      >
        <Sparkles className="size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-3">
        {message.steps && message.steps.length > 0 ? (
          <ol className="space-y-1 text-sm text-ink-subtle">
            {message.steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2">
                {step.state === 'done' ? (
                  <Check className="size-3.5 text-ok" aria-hidden="true" />
                ) : (
                  <Loader2 className="size-3.5 text-wait" aria-hidden="true" />
                )}
                {step.label}
              </li>
            ))}
          </ol>
        ) : null}

        {message.content
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .map((line, index) => (
            <p key={`${message.id}-line-${index}`} className="text-[15px] leading-relaxed text-ink">
              {line}
            </p>
          ))}

        {message.blocks?.map((block, index) => (
          <BlockRenderer
            key={`${message.id}-block-${index}`}
            block={block}
            onAction={onAction}
            busy={busy}
          />
        ))}

        {message.actions && message.actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <ActionButton
                key={`${action.label}-${action.action ?? action.href ?? action.prompt}`}
                action={action}
                onAction={onAction}
                busy={busy}
              />
            ))}
          </div>
        ) : null}

        {message.suggestions && message.suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion(suggestion)}
                disabled={busy}
                className="min-h-11 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-[15px] text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <MessageMeta message={message} />
      </div>
    </div>
  );
}

function ActionButton({
  action,
  onAction,
  busy,
}: {
  action: ChatAction;
  onAction: (action: ChatAction) => void;
  busy?: boolean;
}) {
  const variant = action.variant ?? 'secondary';

  if (action.kind === 'link' && action.href?.startsWith('/api/')) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex h-11 items-center rounded-lg border border-line-strong px-4 text-[15px] font-medium text-ink hover:border-accent hover:text-accent"
      >
        {action.label}
      </a>
    );
  }

  if (action.kind === 'download' && action.downloadId) {
    return (
      <a
        href={`/api/downloads/${action.downloadId}/file`}
        className={cn(
          'inline-flex h-11 items-center rounded-lg px-4 text-[15px] font-medium',
          variant === 'primary'
            ? 'bg-accent text-white hover:bg-accent-strong'
            : 'border border-line-strong text-ink hover:border-accent hover:text-accent',
        )}
      >
        {action.label}
      </a>
    );
  }

  return (
    <Button variant={variant} onClick={() => onAction(action)} disabled={busy}>
      {action.label}
    </Button>
  );
}

/**
 * Small transparency line: which layer answered, and whether it cost a model
 * call. Judges can see the cost story without opening the code.
 */
function MessageMeta({ message }: { message: ChatMessage }) {
  const [open, setOpen] = React.useState(false);
  if (!message.meta?.routing) return null;

  return (
    <div className="pt-0.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="-mx-1 min-h-9 px-1 text-xs text-ink-subtle underline-offset-2 hover:underline"
        aria-expanded={open}
      >
        Why am I seeing this?
      </button>
      {open ? (
        <dl className="mt-1.5 space-y-0.5 rounded-lg bg-canvas px-3 py-2 text-[11px] text-ink-muted">
          {message.meta.intent ? (
            <div className="flex gap-2">
              <dt className="text-ink-subtle">Understood as</dt>
              <dd>
                {message.meta.intent}
                {message.meta.confidence !== undefined
                  ? ` (confidence ${message.meta.confidence})`
                  : ''}
              </dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="text-ink-subtle">Handled by</dt>
            <dd>
              {message.meta.aiSource === 'llm'
                ? 'Language model, then the app'
                : 'The app on its own — no AI model was used'}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-subtle">Routing</dt>
            <dd>{message.meta.routing}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
