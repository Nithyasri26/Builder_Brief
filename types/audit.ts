export type AuditEventType =
  | 'DOCUMENT_VIEWED'
  | 'DOCUMENT_DOWNLOADED'
  | 'DOCUMENT_EMAILED'
  | 'DOCUMENT_IMPORTED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_REUSED'
  | 'TASK_STARTED'
  | 'TASK_PAUSED'
  | 'TASK_RESUMED'
  | 'TASK_CANCELLED'
  | 'USER_CONFIRMED_PF_WITHDRAWAL'
  | 'USER_CONFIRMED_SCHEME_APPLICATION'
  | 'USER_CONFIRMED_PASSPORT_APPLICATION'
  | 'USER_CONFIRMED_COMPLAINT'
  | 'USER_CONFIRMED_TRAIN_BOOKING'
  | 'APPLICATION_SUBMITTED_DEMO'
  | 'ELIGIBILITY_CHECKED'
  | 'AI_INTENT_RESOLVED'
  | 'DEMO_RESET';

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  userId: string;
  taskId?: string;
  timestamp: string;
  /** Non-sensitive metadata only — never identifiers, amounts stay coarse. */
  metadata: Record<string, string | number | boolean>;
}
