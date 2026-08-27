import { fail, guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { toApplicationView } from '@/lib/workflows/engine';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await context.params;
    const userId = await getCurrentUserId();
    const db = getDatabase();
    const task = (await db.getTask(id)) ?? (await db.listTasks(userId)).find((item) => item.applicationId === id) ?? null;
    if (!task || task.userId !== userId) return fail('Not found.', 404);
    const documents = (await Promise.all(task.documents.map((docId) => db.getDocument(docId)))).filter(Boolean);
    return ok({ application: toApplicationView(task), documents });
  });
}
