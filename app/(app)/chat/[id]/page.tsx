import { notFound } from 'next/navigation';
import { ChatView } from '@/components/chat/chat-view';
import { getDatabase } from '@/lib/database';
import { getCurrentUserId } from '@/lib/security/session';

export const dynamic = 'force-dynamic';

/** Reopening a conversation restores its full context, including rich cards. */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const db = getDatabase();
  const conversation = await db.getConversation(id);
  if (!conversation || conversation.userId !== userId) notFound();

  const messages = await db.listMessages(id);

  return <ChatView conversationId={id} initialMessages={messages} />;
}
