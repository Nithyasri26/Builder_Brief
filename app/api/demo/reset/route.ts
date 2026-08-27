import { guard, limit, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { recordAudit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

/** Puts the prototype back to its starting state so the demo can be repeated. */
export async function POST() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await limit('write', userId);
    await getDatabase().reset(userId);
    await recordAudit({ eventType: 'DEMO_RESET', userId, metadata: {} });
    return ok({ done: true });
  });
}
