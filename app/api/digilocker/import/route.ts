import { guard, limit, ok, parseBody } from '@/lib/api';
import { digilockerImportSchema } from '@/lib/validation/schemas';
import { getCurrentUserId } from '@/lib/security/session';
import { services } from '@/lib/services/registry';
import { recordAudit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await limit('write', userId);
    const body = await parseBody(request, digilockerImportSchema);
    const document = await services.digilocker.importDocument(userId, body.documentId);
    await recordAudit({ eventType: 'DOCUMENT_IMPORTED', userId, metadata: { category: document.category } });
    return ok({ document }, { status: 201 });
  });
}
