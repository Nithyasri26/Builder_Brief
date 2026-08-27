import { guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { settleBackgroundWork } from '@/lib/workflows/background';

export const dynamic = 'force-dynamic';

/** The messages the product would have emailed, kept where the citizen can read them. */
export async function GET() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await settleBackgroundWork(userId);
    const emails = await getDatabase().listEmails(userId);
    return ok({ emails });
  });
}
