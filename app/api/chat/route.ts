import { guard, limit, ok, parseBody } from '@/lib/api';
import { chatRequestSchema } from '@/lib/validation/schemas';
import { getCurrentUserId } from '@/lib/security/session';
import { sendMessage } from '@/lib/chat/orchestrator';

export const dynamic = 'force-dynamic';

/** One conversational turn. The only route that can reach a model. */
export async function POST(request: Request) {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await limit('chat', userId);
    const body = await parseBody(request, chatRequestSchema);
    const result = await sendMessage(userId, body.conversationId ?? null, body.message);
    return ok(result);
  });
}
