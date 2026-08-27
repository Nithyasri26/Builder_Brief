import { guard, limit, ok, parseBody } from '@/lib/api';
import { schemeApplySchema } from '@/lib/validation/schemas';
import { getCurrentUserId } from '@/lib/security/session';
import { services } from '@/lib/services/registry';

export const dynamic = 'force-dynamic';

/** Starts a demo scheme application. The citizen still confirms in chat before submission. */
export async function POST(request: Request) {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await limit('write', userId);
    const body = await parseBody(request, schemeApplySchema);
    const result = await services.schemes.startSchemeApplication(userId, body.schemeId);
    return ok({ ...result, status: 'prepared_demo' });
  });
}
