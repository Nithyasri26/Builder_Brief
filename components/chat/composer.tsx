'use client';

import * as React from 'react';
import { ArrowUp, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { useSpeechInput } from './use-speech-input';

/**
 * The single input the whole product is built around.
 * Voice is optional and provider-independent: it converts speech to text and
 * then uses exactly the same pipeline as typing.
 */
export function Composer({
  onSend,
  busy,
  placeholder = 'Tell me what you need...',
  autoFocus,
}: {
  onSend: (text: string) => void;
  busy: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const speech = useSpeechInput((text) => {
    setValue((current) => (current ? `${current} ${text}` : text));
    textareaRef.current?.focus();
  });

  React.useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || busy) return;
    setValue('');
    onSend(text);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="rounded-2xl border border-line-strong bg-surface p-2 shadow-sm focus-within:border-accent"
    >
      <label htmlFor="composer" className="sr-only">
        Tell NammaSahaay what you need
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="composer"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={busy}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={speech.listening ? 'Listening…' : placeholder}
          className="ns-scroll max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:text-ink-subtle"
        />

        {speech.supported ? (
          <button
            type="button"
            onClick={speech.toggle}
            disabled={busy}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? 'Stop voice input' : 'Start voice input'}
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl border transition-colors',
              speech.listening
                ? 'border-stop bg-stop-soft text-stop'
                : 'border-line-strong text-ink-muted hover:border-accent hover:text-accent',
              busy && 'opacity-50',
            )}
          >
            {speech.listening ? (
              <MicOff className="size-5" aria-hidden="true" />
            ) : (
              <Mic className="size-5" aria-hidden="true" />
            )}
          </button>
        ) : null}

        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          aria-label="Send message"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-strong disabled:bg-line-strong disabled:text-ink-subtle"
        >
          {busy ? <Spinner /> : <ArrowUp className="size-5" aria-hidden="true" />}
        </button>
      </div>

      {speech.error ? (
        <p className="px-2 pb-1 text-xs text-stop" role="status">
          {speech.error}
        </p>
      ) : null}
    </form>
  );
}
