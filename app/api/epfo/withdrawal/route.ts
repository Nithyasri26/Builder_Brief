import { guard, limit, ok, parseBody } from '@/lib/api';
import { withdrawalSchema } from '@/lib/validation/schemas';
import { getCurrentUserId } from '@/lib/security/session';
import { services } from '@/lib/services/registry';

export const dynamic = 'force-dynamic';

/**
 * Checks a withdrawal amount. Submission happens only through an explicit
 * citizen confirmation in the conversation.
 */
export async function POST(request: Request) {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await limit('write', userId);
    const body = await parseBody(request, withdrawalSchema);
    const check = await services.epfo.checkWithdrawalEligibility(userId, body.amount);
    return ok({ check, requiresConfirmation: true, mode: 'demo' });
  });
}
