import type { ChatMessage, ChatTurnResult, Conversation } from '@/types/chat';
import type { AIContext } from '@/types/ai';
import { getDatabase } from '@/lib/database';
import { resolveIntent } from '@/lib/ai';
import { recordAudit } from '@/lib/security/audit';
import { id as newId, nowIso, truncate } from '@/lib/utils';
import { profileSummary, type AssistantDraft } from './presenters';
import { getAwaitingTask, handleAwaitingAnswer, handleIntent, type HandlerContext } from './handlers';
import { handleChatAction } from './actions';
import { STATUS_LABEL } from '@/lib/workflows/engine';
import { settleBackgroundWork } from '@/lib/workflows/background';

/**
 * One turn of the conversation.
 *
 * Understanding is the only part a model may touch. Everything after it —
 * the workflow, the eligibility check, the documents, the wording of the
 * result — is deterministic application code.
 */
export async function sendMessage(
  userId: string,
  conversationId: string | null,
  text: string,
): Promise<ChatTurnResult> {
  const db = getDatabase();
  // Anything a simulated office has finished by now lands before we answer, so
  // the citizen never sees stale progress.
  await settleBackgroundWork(userId);
  const profile = await db.getProfile(userId);

  const conversation =
    (conversationId ? await db.getConversation(conversationId) : null) ??
    (await db.createConversation(userId, truncate(text, 34)));

  const history = await db.listMessages(conversation.id);

  const userMessage: ChatMessage = {
    id: newId('msg'),
    conversationId: conversation.id,
    role: 'user',
    content: text,
    createdAt: nowIso(),
  };
  await db.appendMessage(userMessage);

  const context = await buildContext(userId, profile.name, history);
  const ctxBase = {
    userId,
    conversationId: conversation.id,
    profile,
    message: text,
  };

  let draft: AssistantDraft;
  let meta: ChatMessage['meta'];

  // A workflow that asked a question gets first refusal on the answer, so a
  // reply like "June" is understood in context instead of being re-classified.
  const awaiting = await getAwaitingTask(userId, conversation.id);
  const awaitingDraft = awaiting
    ? await handleAwaitingAnswer(
        { ...ctxBase, intent: { intent: 'CONTINUE_TASK', confidence: 1, entities: {}, source: 'rules' } },
        awaiting,
      )
    : null;

  if (awaitingDraft) {
    draft = awaitingDraft;
    meta = { intent: 'CONTINUE_TASK', confidence: 1, aiSource: 'rules', routing: 'Answer to a question the workflow asked.' };
  } else {
    const { result, routing } = await resolveIntent(text, context);
    const ctx: HandlerContext = { ...ctxBase, intent: result };
    draft = await handleIntent(ctx);
    if (result.reply && (result.intent === 'UNKNOWN' || result.intent === 'CHECK_GOVERNMENT_SCHEMES')) {
      draft = { ...draft, content: mergeReply(result.reply, draft.content) };
    }
    meta = {
      intent: result.intent,
      confidence: Number(result.confidence.toFixed(2)),
      aiSource: result.source,
      routing: routing.reason,
    };
    await recordAudit({
      eventType: 'AI_INTENT_RESOLVED',
      userId,
      metadata: { intent: result.intent, layer: routing.layer },
    });
  }

  const assistantMessage = await persistAssistant(conversation.id, draft, meta);
  const updatedConversation = await updateConversationMeta(conversation, history.length, draft, text);

  return { conversation: updatedConversation, userMessage, assistantMessage };
}

/** A button inside an assistant message. Always an explicit citizen decision. */
export async function runAction(
  userId: string,
  conversationId: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<{ conversation: Conversation; assistantMessage: ChatMessage }> {
  const db = getDatabase();
  await settleBackgroundWork(userId);
  const profile = await db.getProfile(userId);
  const conversation =
    (await db.getConversation(conversationId)) ?? (await db.createConversation(userId, 'Conversation'));

  const ctx: HandlerContext = {
    userId,
    conversationId: conversation.id,
    profile,
    message: action,
    intent: { intent: 'CONTINUE_TASK', confidence: 1, entities: {}, source: 'rules' },
  };

  const draft = await handleChatAction(ctx, action, payload);
  const assistantMessage = await persistAssistant(conversation.id, draft, {
    aiSource: 'rules',
    routing: 'Citizen action — handled deterministically, no model call.',
  });

  const updated =
    (await db.updateConversation(conversation.id, {
      preview: truncate(draft.content, 80),
      updatedAt: nowIso(),
    })) ?? conversation;

  return { conversation: updated, assistantMessage };
}

async function persistAssistant(
  conversationId: string,
  draft: AssistantDraft,
  meta: ChatMessage['meta'],
): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: newId('msg'),
    conversationId,
    role: 'assistant',
    content: draft.content,
    processing: draft.processing,
    inputState: draft.inputState ?? 'IDLE',
    steps: draft.steps,
    blocks: draft.blocks,
    actions: draft.actions,
    suggestions: draft.suggestions,
    createdAt: nowIso(),
    meta,
  };
  return getDatabase().appendMessage(message);
}

async function updateConversationMeta(
  conversation: Conversation,
  previousMessageCount: number,
  draft: AssistantDraft,
  userText: string,
): Promise<Conversation> {
  const isFirstTurn = previousMessageCount === 0;
  const title = isFirstTurn ? (draft.title ?? truncate(userText, 34)) : conversation.title;
  const updated = await getDatabase().updateConversation(conversation.id, {
    title,
    preview: truncate(draft.content, 90),
    updatedAt: nowIso(),
  });
  return updated ?? conversation;
}

/** Two sentences from the model, then the deterministic body. */
function mergeReply(reply: string, content: string): string {
  const clean = reply.trim();
  if (!clean) return content;
  if (content.toLowerCase().startsWith(clean.slice(0, 20).toLowerCase())) return content;
  return `${clean}\n\n${content}`;
}

async function buildContext(
  userId: string,
  _name: string,
  history: ChatMessage[],
): Promise<AIContext> {
  const db = getDatabase();
  const profile = await db.getProfile(userId);
  const tasks = await db.listTasks(userId);
  const open = tasks.find((task) => !['COMPLETED', 'CANCELLED'].includes(task.status));
  return {
    profileSummary: profileSummary(profile),
    recentMessages: history.slice(-6).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 400),
    })),
    activeTaskSummary: open ? `${open.title} — ${STATUS_LABEL[open.status]}` : undefined,
  };
}
