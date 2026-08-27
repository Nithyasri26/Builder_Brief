'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import type { ChatAction, ChatMessage, ChatTurnResult, Conversation, InputState } from '@/types/chat';
import { ProgressDots } from '@/components/ui';
import { Composer } from './composer';
import { AssistantMessage, UserMessage } from './message';

const THINKING_LABELS = [
  'Reading what you said…',
  'Checking what I know about you…',
  'Checking your papers…',
  'Getting your answer ready…',
];

const EXAMPLES = [
  'Is there any government help for me?',
  'Show my PF money',
  'I want a passport',
  'My pension has not come',
  'Show my papers',
];

export function ChatView({
  conversationId: initialConversationId,
  initialMessages,
  initialPrompt,
  greetingName,
  showHero,
  dashboard,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  initialPrompt?: string;
  greetingName?: string;
  showHero?: boolean;
  /** Secondary dashboard shown under the greeting before the first message. */
  dashboard?: React.ReactNode;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = React.useState(initialConversationId);
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /**
   * While a service call is playing, text and voice are switched off so the
   * citizen cannot start something else on top of a critical step. They come
   * straight back the moment a decision is needed.
   */
  const [locked, setLocked] = React.useState(false);
  const [thinkingIndex, setThinkingIndex] = React.useState(0);
  const endRef = React.useRef<HTMLDivElement>(null);
  const sentInitial = React.useRef(false);

  React.useEffect(() => {
    if (!busy) {
      setThinkingIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setThinkingIndex((index) => Math.min(index + 1, THINKING_LABELS.length - 1));
    }, 650);
    return () => window.clearInterval(timer);
  }, [busy]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: messages.length > 2 ? 'smooth' : 'auto', block: 'end' });
  }, [messages, busy]);

  const send = React.useCallback(
    async (text: string) => {
      if (busy) return;
      setError(null);
      setBusy(true);
      const optimistic: ChatMessage = {
        id: `local-${Date.now()}`,
        conversationId: conversationId ?? 'pending',
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, optimistic]);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, conversationId: conversationId ?? undefined }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? 'The prototype could not answer just now.');
        }
        const result = (await response.json()) as ChatTurnResult;
        if (result.assistantMessage.processing) setLocked(true);
        setMessages((current) => [
          ...current.filter((message) => message.id !== optimistic.id),
          result.userMessage,
          result.assistantMessage,
        ]);
        applyConversation(result.conversation);
      } catch (caught) {
        setMessages((current) => current.filter((message) => message.id !== optimistic.id));
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }

      function applyConversation(conversation: Conversation) {
        if (!conversationId) {
          setConversationId(conversation.id);
          window.history.replaceState(null, '', `/chat/${conversation.id}`);
        }
        window.dispatchEvent(new CustomEvent('ns:data-changed'));
      }
    },
    [busy, conversationId],
  );

  const runAction = React.useCallback(
    async (action: ChatAction) => {
      if (action.kind === 'prompt' && action.prompt) {
        void send(action.prompt);
        return;
      }
      if (action.kind === 'link' && action.href) {
        router.push(action.href);
        return;
      }
      if (action.kind !== 'action' || !action.action) return;

      setError(null);
      setBusy(true);
      try {
        let activeConversationId = conversationId;
        if (!activeConversationId) {
          const created = await fetch('/api/conversations', { method: 'POST' });
          const data = (await created.json()) as { conversation: Conversation };
          activeConversationId = data.conversation.id;
          setConversationId(activeConversationId);
          window.history.replaceState(null, '', `/chat/${activeConversationId}`);
        }

        const response = await fetch('/api/chat/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: action.action,
            conversationId: activeConversationId,
            payload: action.payload ?? {},
          }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? 'That action could not be completed.');
        }
        const result = (await response.json()) as { assistantMessage: ChatMessage };
        if (result.assistantMessage.processing) setLocked(true);
        setMessages((current) => [...current, result.assistantMessage]);
        window.dispatchEvent(new CustomEvent('ns:data-changed'));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    },
    [conversationId, router, send],
  );

  React.useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      void send(initialPrompt);
    }
  }, [initialPrompt, send]);

  const isEmpty = messages.length === 0;
  const inputBlocked = busy || locked;

  // What the citizen is allowed to do right now, from the last answer.
  const inputState: InputState = React.useMemo(() => {
    if (locked) return 'ACTIVE_PROCESSING';
    const last = [...messages].reverse().find((message) => message.role === 'assistant');
    return last?.inputState ?? 'IDLE';
  }, [messages, locked]);

  return (
    <div className="flex h-full min-h-[calc(100dvh-56px)] flex-col lg:min-h-dvh">
      <div className="ns-scroll flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {isEmpty && showHero ? (
            <section className="pt-6 sm:pt-16">
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {greetingName ? `${greetingName},` : 'Hello,'} how can I help you today?
              </h1>
              <p className="mt-2 max-w-xl text-[15px] text-ink-muted">
                Tell me what you need in your own words.
              </p>
              {dashboard ? <div className="mt-8">{dashboard}</div> : null}
            </section>
          ) : null}

          <div className="space-y-6 pt-4">
            {messages.map((message) =>
              message.role === 'user' ? (
                <UserMessage key={message.id} message={message} />
              ) : (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  onAction={runAction}
                  onSuggestion={(text) => void send(text)}
                  busy={inputBlocked}
                  onProcessingDone={() => setLocked(false)}
                />
              ),
            )}

            {busy ? (
              <div className="flex gap-3" role="status" aria-live="polite">
                <span
                  className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                  aria-hidden="true"
                >
                  <Sparkles className="size-4" />
                </span>
                <div className="flex items-center gap-2 pt-1.5 text-sm text-ink-muted">
                  <ProgressDots />
                  {THINKING_LABELS[thinkingIndex]}
                </div>
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="rounded-[var(--radius-card)] border border-stop/25 bg-stop-soft px-4 py-3 text-sm text-stop"
              >
                {error}
              </div>
            ) : null}
          </div>

          <div ref={endRef} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
          <Composer
            onSend={(text) => void send(text)}
            busy={inputBlocked}
            autoFocus={isEmpty}
            placeholder={
              locked
                ? 'Please wait while we finish this step…'
                : inputState === 'WAITING_FOR_CONFIRMATION'
                  ? 'Choose an option above, or ask me something'
                  : 'Tell me what you need...'
            }
          />
          {locked ? (
            <p className="mt-2 text-center text-xs text-ink-muted" role="status">
              Typing is paused for a moment while this step finishes.
            </p>
          ) : null}
          {isEmpty ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => void send(example)}
                    disabled={inputBlocked}
                    className="min-h-11 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-[15px] text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-center text-[11px] text-ink-subtle">
              Practice app. Nothing is sent anywhere without you tapping Confirm.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
