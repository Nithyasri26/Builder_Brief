import { fail, guard, limit, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { renderDownload } from '@/lib/documents/document-service';
import { getEmailProvider } from '@/lib/email';
import { recordAudit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await context.params;
    const userId = await getCurrentUserId();
    await limit('write', userId);
    const db = getDatabase();
    const file = await db.getDownload(id);
    if (!file || file.userId !== userId) return fail('Not found.', 404);

    const profile = await db.getProfile(userId);
    const rendered = await renderDownload(userId, id);
    const receipt = await getEmailProvider().send({
      to: profile.email,
      subject: `Your ${file.title} is ready`,
      body: `Attached is your ${file.title}. This is demo output from a prototype and is not an official document.`,
      attachmentName: file.fileName,
      attachment: rendered?.bytes,
    });
    await recordAudit({ eventType: 'DOCUMENT_EMAILED', userId, metadata: { kind: file.kind } });
    return ok({ receipt });
  });
}
