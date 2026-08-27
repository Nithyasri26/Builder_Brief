import type { ApplicationView, CitizenTask, TaskStatus, TimelineEvent } from '@/types/task';
import { getWorkflow, type WorkflowDefinition } from './definitions';
import { getDatabase } from '@/lib/database';
import { id as newId, nowIso } from '@/lib/utils';
import { recordAudit } from '@/lib/security/audit';

/**
 * The citizen task engine.
 *
 * A task is a resumable position inside a workflow: what is done, what is
 * next, and the data collected so far. Pausing is not a special case — it is
 * simply the state the task is already in, which is why "I'll do it later"
 * and "continue my PF withdrawal" work for every service.
 */

export interface StartTaskInput {
  userId: string;
  workflowId: string;
  conversationId: string | null;
  title?: string;
  data?: Record<string, unknown>;
  documents?: string[];
  /** The application waiting on this one, for a document child task. */
  parentTaskId?: string | null;
  requiredFor?: string | null;
  serviceType?: CitizenTask['serviceType'];
}

/**
 * Returns an unfinished task of the same kind, if the citizen already has one.
 * Asking for the same thing twice should carry on where they were, not open a
 * second identical application they then cannot tell apart.
 */
export async function findOpenTask(
  userId: string,
  workflowId: string,
): Promise<CitizenTask | null> {
  const tasks = await getDatabase().listTasks(userId);
  return (
    tasks.find(
      (task) =>
        task.workflowId === workflowId && !['COMPLETED', 'CANCELLED'].includes(task.status),
    ) ?? null
  );
}

export async function startTask(input: StartTaskInput): Promise<CitizenTask> {
  const workflow = getWorkflow(input.workflowId);
  const db = getDatabase();
  const now = nowIso();
  const task: CitizenTask = {
    id: newId('task'),
    userId: input.userId,
    serviceType: input.serviceType ?? workflow.serviceType,
    parentTaskId: input.parentTaskId ?? null,
    requiredFor: input.requiredFor ?? null,
    completeAt: null,
    workflowId: workflow.id,
    title: input.title ?? workflow.title,
    status: 'IN_PROGRESS',
    currentStep: workflow.steps[0].id,
    completedSteps: [],
    pendingSteps: workflow.steps.map((step) => step.id),
    data: input.data ?? {},
    documents: input.documents ?? [],
    applicationId: null,
    createdAt: now,
    updatedAt: now,
    conversationId: input.conversationId,
    nextActionLabel: null,
    nextActionPrompt: null,
    timeline: [
      {
        id: newId('evt'),
        at: now,
        label: `${workflow.title} started`,
        tone: 'info',
      },
    ],
  };
  const created = await db.createTask(task);
  await recordAudit({
    eventType: 'TASK_STARTED',
    userId: input.userId,
    taskId: created.id,
    metadata: { workflow: workflow.id },
  });
  return created;
}

export interface AdvanceInput {
  taskId: string;
  /** Steps to mark as done, in order. */
  complete?: string[];
  /** The step the citizen is now sitting on. */
  currentStep?: string;
  status?: TaskStatus;
  data?: Record<string, unknown>;
  documents?: string[];
  applicationId?: string | null;
  completeAt?: string | null;
  parentTaskId?: string | null;
  timeline?: { label: string; detail?: string; tone?: TimelineEvent['tone'] };
  nextActionLabel?: string | null;
  nextActionPrompt?: string | null;
}

export async function advanceTask(input: AdvanceInput): Promise<CitizenTask | null> {
  const db = getDatabase();
  const task = await db.getTask(input.taskId);
  if (!task) return null;
  const workflow = getWorkflow(task.workflowId);

  const completed = new Set(task.completedSteps);
  for (const step of input.complete ?? []) completed.add(step);

  const currentStep = input.currentStep ?? nextPending(workflow, completed) ?? task.currentStep;
  const pending = workflow.steps.map((step) => step.id).filter((step) => !completed.has(step));

  const timeline = [...task.timeline];
  if (input.timeline) {
    timeline.push({
      id: newId('evt'),
      at: nowIso(),
      label: input.timeline.label,
      detail: input.timeline.detail,
      tone: input.timeline.tone ?? 'info',
    });
  }

  return db.updateTask(task.id, {
    completedSteps: [...completed],
    pendingSteps: pending,
    currentStep,
    status: input.status ?? task.status,
    data: { ...task.data, ...(input.data ?? {}) },
    documents: input.documents ? unique([...task.documents, ...input.documents]) : task.documents,
    applicationId: input.applicationId === undefined ? task.applicationId : input.applicationId,
    completeAt: input.completeAt === undefined ? task.completeAt : input.completeAt,
    parentTaskId: input.parentTaskId === undefined ? task.parentTaskId : input.parentTaskId,
    timeline,
    nextActionLabel:
      input.nextActionLabel === undefined ? task.nextActionLabel : input.nextActionLabel,
    nextActionPrompt:
      input.nextActionPrompt === undefined ? task.nextActionPrompt : input.nextActionPrompt,
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function nextPending(workflow: WorkflowDefinition, completed: Set<string>): string | null {
  const step = workflow.steps.find((candidate) => !completed.has(candidate.id));
  return step ? step.id : null;
}

export async function pauseTask(taskId: string): Promise<CitizenTask | null> {
  const db = getDatabase();
  const task = await db.getTask(taskId);
  if (!task) return null;
  await recordAudit({
    eventType: 'TASK_PAUSED',
    userId: task.userId,
    taskId,
    metadata: { step: task.currentStep },
  });
  return advanceTask({
    taskId,
    status: 'WAITING_FOR_USER',
    timeline: { label: 'Saved for later', tone: 'warning' },
    nextActionLabel: 'Continue',
    nextActionPrompt: `Continue my ${task.title.toLowerCase()}`,
  });
}

export async function resumeTask(taskId: string): Promise<CitizenTask | null> {
  const db = getDatabase();
  const task = await db.getTask(taskId);
  if (!task) return null;
  await recordAudit({
    eventType: 'TASK_RESUMED',
    userId: task.userId,
    taskId,
    metadata: { step: task.currentStep },
  });
  return advanceTask({
    taskId,
    status: 'IN_PROGRESS',
    timeline: { label: 'Resumed', tone: 'info' },
  });
}

export async function cancelTask(taskId: string): Promise<CitizenTask | null> {
  const db = getDatabase();
  const task = await db.getTask(taskId);
  if (!task) return null;
  await recordAudit({
    eventType: 'TASK_CANCELLED',
    userId: task.userId,
    taskId,
    metadata: { step: task.currentStep },
  });
  return advanceTask({
    taskId,
    status: 'CANCELLED',
    timeline: { label: 'Stopped by you', tone: 'warning' },
    nextActionLabel: null,
    nextActionPrompt: null,
  });
}

/** Finds the task a "continue" request refers to. */
export async function findResumableTask(
  userId: string,
  serviceType?: string,
): Promise<CitizenTask | null> {
  const tasks = await getDatabase().listTasks(userId);
  const open = tasks.filter(
    (task) => !['COMPLETED', 'CANCELLED'].includes(task.status),
  );
  if (serviceType) {
    const match = open.find((task) => task.serviceType === serviceType);
    if (match) return match;
  }
  const waiting = open.find((task) =>
    ['WAITING_FOR_USER', 'WAITING_FOR_CONFIRMATION', 'WAITING_FOR_DOCUMENT'].includes(task.status),
  );
  return waiting ?? open[0] ?? null;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_USER: 'Waiting for you',
  WAITING_FOR_DOCUMENT: 'Waiting for a document',
  WAITING_FOR_CONFIRMATION: 'Waiting for confirmation',
  SUBMITTED: 'Sent',
  PROCESSING: 'Being processed',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
};

export function progressOf(task: CitizenTask) {
  // A document task carries its own steps, because "I lost it" and "I never
  // applied" are genuinely different journeys through the same workflow.
  const ownSteps = task.data.steps as { id: string; label: string }[] | undefined;
  const workflow = ownSteps?.length ? { steps: ownSteps } : getWorkflow(task.workflowId);
  // A cancelled task is not sitting on a step any more.
  const showsCurrent = task.status !== 'CANCELLED';
  return workflow.steps.map((step) => ({
    id: step.id,
    label: step.label,
    state: (task.completedSteps.includes(step.id)
      ? 'done'
      : showsCurrent && step.id === task.currentStep
        ? 'current'
        : 'pending') as 'done' | 'current' | 'pending',
  }));
}

/** Projects a task into the record My Applications renders. */
export function toApplicationView(task: CitizenTask): ApplicationView {
  const workflow = getWorkflow(task.workflowId);
  const requirements = Array.isArray(task.data.requirements)
    ? (task.data.requirements as { state: string }[])
    : [];
  const ready = requirements.filter((requirement) =>
    ['AVAILABLE', 'AVAILABLE_AFTER_PROCESSING', 'COMPLETED'].includes(requirement.state),
  ).length;

  return {
    id: task.applicationId ?? task.id,
    taskId: task.id,
    reference: task.applicationId ?? 'Not submitted',
    requiredFor: task.requiredFor ?? null,
    papers: requirements.length > 0 ? { ready, total: requirements.length } : null,
    serviceType: task.serviceType,
    serviceLabel: workflow.serviceLabel,
    title: task.title,
    status: task.status,
    statusLabel: STATUS_LABEL[task.status],
    progress: progressOf(task),
    updatedAt: task.updatedAt,
    createdAt: task.createdAt,
    nextActionLabel: task.nextActionLabel,
    nextActionPrompt: task.nextActionPrompt,
    timeline: task.timeline,
    documents: task.documents,
    isDemo: true,
  };
}

export { getWorkflow, WORKFLOWS } from './definitions';
