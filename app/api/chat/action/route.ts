import { guard, limit, ok, parseBody } from '@/lib/api';
import { chatActionSchema } from '@/lib/validation/schemas';
import { getCurrentUserId } from '@/lib/security/session';
import { runAction } from '@/lib/chat/orchestrator';

export const dynamic = 'force-dynamic';

/** A button pressed inside an assistant message. Never triggered by the model. */
export async function POST(request: Request) {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await limit('write', userId);
    const body = await parseBody(request, chatActionSchema);
    const result = await runAction(userId, body.conversationId, body.action, body.payload ?? {});
    return ok(result);
  });
}
