import { fail, guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { settleBackgroundWork } from '@/lib/workflows/background';
import { readRequirements, requirementProgress } from '@/lib/workflows/requirements';
import { STATUS_LABEL } from '@/lib/workflows/engine';

export const dynamic = 'force-dynamic';

/**
 * Live state of one application. The chat card polls this while papers are
 * still being sorted out, which is how "3 of 5" turns into "4 of 5" in front
 * of the citizen. Reading it also settles anything the offices have finished.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await context.params;
    const userId = await getCurrentUserId();
    await settleBackgroundWork(userId);

    const task = await getDatabase().getTask(id);
    if (!task || task.userId !== userId) return fail('Not found.', 404);

    const progress = requirementProgress(task);
    return ok({
      requirements: {
        taskId: task.id,
        title: task.title,
        status: STATUS_LABEL[task.status],
        ready: progress.ready,
        total: progress.total,
        allReady: progress.allReady,
        reference: task.applicationId,
        requirements: readRequirements(task),
      },
    });
  });
}
