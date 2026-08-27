import { guard, limit, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { services } from '@/lib/services/registry';

export const dynamic = 'force-dynamic';

/** Returns the demo requirement list. Submission requires confirmation in chat. */
export async function GET() {
  return guard(async () => {
    const requirements = await services.passport.getRequirements();
    return ok({ requirements, source: services.passport.officialSource, mode: 'demo' });
  });
}

export async function POST() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await limit('write', userId);
    const submission = await services.passport.submitApplication(userId);
    return ok({ ...submission, mode: 'demo' }, { status: 201 });
  });
}
