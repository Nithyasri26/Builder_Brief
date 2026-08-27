/** Citizen Task Engine — one workflow model reused by every service. */

export type TaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_USER'
  | 'WAITING_FOR_DOCUMENT'
  | 'WAITING_FOR_CONFIRMATION'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED';

export type ServiceType =
  | 'EPFO'
  | 'PASSPORT'
  | 'SCHEME'
  | 'COMPLAINT'
  | 'RAIL'
  | 'DIGILOCKER'
  /** A single document being obtained, corrected or recovered. */
  | 'DOCUMENT';

export interface StepDefinition {
  id: string;
  label: string;
  /** Shown while the step is the current one. */
  description?: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  label: string;
  detail?: string;
  tone: 'info' | 'success' | 'warning';
}

export interface CitizenTask {
  id: string;
  userId: string;
  serviceType: ServiceType;
  /**
   * Set on a child task: the application that is waiting for it.
   * A passport waiting on an Aadhaar and a birth certificate is one parent
   * with two children, each moving at its own pace.
   */
  parentTaskId?: string | null;
  /** Plain-language reason the child exists, e.g. "your passport application". */
  requiredFor?: string | null;
  /**
   * Set on a background step: when the simulated service finishes. Any read of
   * the task list settles anything past due, so progress keeps moving even if
   * the server restarted in between.
   */
  completeAt?: string | null;
  workflowId: string;
  title: string;
  status: TaskStatus;
  currentStep: string;
  completedSteps: string[];
  pendingSteps: string[];
  data: Record<string, unknown>;
  documents: string[];
  applicationId: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
  /** What the citizen should do next, expressed as a chat prompt. */
  nextActionLabel: string | null;
  nextActionPrompt: string | null;
  conversationId: string | null;
}

/** Read model rendered by My Applications. Derived from a task. */
export interface ApplicationView {
  id: string;
  taskId: string;
  reference: string;
  /** For a paper being sorted out: the application waiting on it. */
  requiredFor?: string | null;
  /** For an application: how many of its papers are ready. */
  papers?: { ready: number; total: number } | null;
  serviceType: ServiceType;
  serviceLabel: string;
  title: string;
  status: TaskStatus;
  statusLabel: string;
  progress: { id: string; label: string; state: 'done' | 'current' | 'pending' }[];
  updatedAt: string;
  createdAt: string;
  nextActionLabel: string | null;
  nextActionPrompt: string | null;
  timeline: TimelineEvent[];
  documents: string[];
  isDemo: true;
}
