import { guard, ok } from '@/lib/api';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const conversations = await getDatabase().listConversations(userId);
    return ok({ conversations });
  });
}

export async function POST() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const conversation = await getDatabase().createConversation(userId, 'New conversation');
    return ok({ conversation }, { status: 201 });
  });
}
