import { fail, guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await context.params;
    const userId = await getCurrentUserId();
    const db = getDatabase();
    const conversation = await db.getConversation(id);
    if (!conversation || conversation.userId !== userId) return fail('Not found.', 404);
    const messages = await db.listMessages(id);
    return ok({ conversation, messages });
  });
}
