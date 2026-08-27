import { guard, ok, parseBody } from '@/lib/api';
import { eligibilityRequestSchema } from '@/lib/validation/schemas';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { services } from '@/lib/services/registry';
import { situationFromProfile, mergeSituation } from '@/lib/chat/presenters';
import { ELIGIBILITY_DISCLAIMER } from '@/lib/eligibility/engine';
import { recordAudit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

/**
 * Eligibility is computed by the rules engine, never by a model.
 * The response is always framed as potential eligibility.
 */
export async function POST(request: Request) {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const body = await parseBody(request, eligibilityRequestSchema);
    const db = getDatabase();
    const profile = await db.getProfile(userId);
    const documents = await db.listDocuments(userId);
    const situation = mergeSituation(situationFromProfile(profile), body.situation);
    const matches = await services.schemes.checkPotentialEligibility(situation, documents);
    await recordAudit({ eventType: 'ELIGIBILITY_CHECKED', userId, metadata: { count: matches.length } });
    return ok({ matches, disclaimer: ELIGIBILITY_DISCLAIMER });
  });
}
