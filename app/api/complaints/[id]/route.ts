import { fail, guard, limit, ok, parseBody } from '@/lib/api';
import { complaintUpdateSchema } from '@/lib/validation/schemas';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await context.params;
    const userId = await getCurrentUserId();
    const complaint = await getDatabase().getComplaint(id);
    if (!complaint || complaint.userId !== userId) return fail('Not found.', 404);
    return ok({ complaint });
  });
}

/** Edits a draft. A recorded complaint is never rewritten. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await context.params;
    const userId = await getCurrentUserId();
    await limit('write', userId);
    const db = getDatabase();
    const complaint = await db.getComplaint(id);
    if (!complaint || complaint.userId !== userId) return fail('Not found.', 404);
    if (complaint.status !== 'draft') {
      return fail('This complaint has already been recorded and cannot be edited.', 409);
    }
    const body = await parseBody(request, complaintUpdateSchema);
    const updated = await db.updateComplaint(id, body);
    return ok({ complaint: updated });
  });
}
