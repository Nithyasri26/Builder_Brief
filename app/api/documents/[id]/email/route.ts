import { fail, guard, limit, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { renderDocument } from '@/lib/documents/document-service';
import { getEmailProvider } from '@/lib/email';
import { recordAudit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

/** Emails a document to the citizen's registered address. Demo mode never sends. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await context.params;
    const userId = await getCurrentUserId();
    await limit('write', userId);
    const db = getDatabase();
    const document = await db.getDocument(id);
    if (!document || document.userId !== userId) return fail('Not found.', 404);

    const profile = await db.getProfile(userId);
    const rendered = await renderDocument(userId, id);
    const receipt = await getEmailProvider().send({
      to: profile.email,
      subject: `Your ${document.name} is ready`,
      body: `Attached is ${document.name}. This is a demo document produced by a prototype and is not an official record.`,
      attachmentName: document.fileName,
      attachment: rendered?.bytes,
    });
    await recordAudit({
      eventType: 'DOCUMENT_EMAILED',
      userId,
      metadata: { category: document.category },
    });
    return ok({ receipt });
  });
}
