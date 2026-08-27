import { guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const db = getDatabase();
    const [profile, connections] = await Promise.all([
      db.getProfile(userId),
      db.listConnectedServices(userId),
    ]);
    return ok({ profile, connections });
  });
}
