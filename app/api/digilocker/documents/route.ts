import { guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { services } from '@/lib/services/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const documents = await services.digilocker.listDocuments(userId);
    return ok({ documents, connection: 'demo', source: services.digilocker.officialSource });
  });
}
