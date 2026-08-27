import { guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { services } from '@/lib/services/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const result = await services.epfo.getPassbook(userId);
    return ok({ ...result, source: services.epfo.officialSource, mode: 'demo' });
  });
}
