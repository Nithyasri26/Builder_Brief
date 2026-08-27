import type { AuditEvent, AuditEventType } from '@/types/audit';
import { getDatabase } from '@/lib/database';
import { id as newId, nowIso } from '@/lib/utils';

/** Keys that must never reach the audit log. */
const BLOCKED_KEYS = [
  'aadhaar',
  'pan',
  'uan',
  'account',
  'accountnumber',
  'bank',
  'otp',
  'password',
  'token',
  'email',
  'mobile',
  'phone',
  'address',
];

/** Amounts are recorded as coarse bands, never exact values. */
function band(value: number): string {
  if (value < 10000) return '<10k';
  if (value < 50000) return '10k-50k';
  if (value < 100000) return '50k-1L';
  if (value < 500000) return '1L-5L';
  return '>5L';
}

function sanitise(metadata: Record<string, unknown>): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    if (BLOCKED_KEYS.some((blocked) => lower.includes(blocked))) continue;
    if (typeof value === 'number') {
      clean[key] = lower.includes('amount') ? band(value) : value;
      continue;
    }
    if (typeof value === 'boolean') {
      clean[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      clean[key] = value.slice(0, 80);
    }
  }
  return clean;
}

/**
 * Records a consequential action.
 *
 * Data minimisation is enforced here rather than at every call site: metadata
 * is filtered and amounts are reduced to bands before anything is written.
 */
export async function recordAudit(input: {
  eventType: AuditEventType;
  userId: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const event: AuditEvent = {
    id: newId('audit'),
    eventType: input.eventType,
    userId: input.userId,
    taskId: input.taskId,
    timestamp: nowIso(),
    metadata: sanitise(input.metadata ?? {}),
  };
  try {
    await getDatabase().addAuditEvent(event);
  } catch {
    // Auditing must never break a citizen journey.
  }
}
