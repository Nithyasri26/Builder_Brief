import { guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { toApplicationView } from '@/lib/workflows/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const tasks = await getDatabase().listTasks(userId);
    return ok({ applications: tasks.map(toApplicationView) });
  });
}
