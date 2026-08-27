import { fail, guard } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { renderDownload } from '@/lib/documents/document-service';
import { recordAudit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await context.params;
    const userId = await getCurrentUserId();
    const file = await renderDownload(userId, id);
    if (!file) return fail('Not found.', 404);

    const inline = new URL(request.url).searchParams.get('inline') === '1';
    await recordAudit({
      eventType: inline ? 'DOCUMENT_VIEWED' : 'DOCUMENT_DOWNLOADED',
      userId,
      metadata: { downloadId: id.slice(0, 12) },
    });

    return new Response(file.bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${file.fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
