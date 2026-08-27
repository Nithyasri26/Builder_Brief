import { DEMO_USER_ID } from '@/data/demo/citizen';
import { readSessionUserId } from '@/lib/auth/session';

/**
 * Session seam.
 *
 * Every route resolves the current citizen through this one function and every
 * service checks ownership against it. It now reads a real signed session
 * cookie set at login/registration; when there is no valid session it falls
 * back to the synthetic demo citizen so the "try the demo" path still works.
 */
export async function getCurrentUserId(): Promise<string> {
  const sessionUser = await readSessionUserId();
  return sessionUser ?? DEMO_USER_ID;
}

/** True when the request carries a real signed-in session (not the demo). */
export async function isAuthenticated(): Promise<boolean> {
  return (await readSessionUserId()) !== null;
}

/** Throws unless the record belongs to the citizen making the request. */
export function assertOwnership(record: { userId: string } | null, userId: string): void {
  if (!record || record.userId !== userId) {
    const error = new Error('Not found');
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
}
