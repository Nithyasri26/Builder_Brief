import { ApiError, guard, limit, ok, parseBody } from '@/lib/api';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { DEMO_OTP } from '@/lib/chat/resolution';

export const dynamic = 'force-dynamic';

const profileUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  dateOfBirth: z.string().max(20).optional(),
  gender: z.enum(['female', 'male', 'other']).optional(),
  city: z.string().max(60).optional(),
  state: z.string().max(60).optional(),
  email: z.string().email().max(120).optional(),
  mobile: z.string().max(20).optional(),
  /** Required only when the mobile number is changing. */
  otp: z.string().max(8).optional(),
});

/**
 * Saves a change to the citizen's own details.
 *
 * A new mobile number is the one field that cannot be saved on trust, so it
 * needs the code first. Everything else saves directly.
 */
export async function PUT(request: Request) {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await limit('write', userId);
    const body = await parseBody(request, profileUpdateSchema);
    const db = getDatabase();
    const current = await db.getProfile(userId);

    const changingMobile = Boolean(body.mobile && body.mobile !== current.mobile);
    if (changingMobile && body.otp !== DEMO_OTP) {
      throw new ApiError('To change your mobile number, enter the code we sent you.', 422, {
        needsOtp: true,
      });
    }

    const patch: Record<string, unknown> = {};
    for (const key of ['name', 'dateOfBirth', 'gender', 'city', 'state', 'email'] as const) {
      if (body[key]) patch[key] = body[key];
    }
    if (changingMobile) patch.mobile = body.mobile;

    const profile = await db.updateProfile(userId, patch);
    return ok({ profile });
  });
}
