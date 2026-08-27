import type { CitizenTask } from '@/types/task';
import type { DocumentState, RequirementState, ResolutionRoute } from '@/types/document';
import { getDatabase } from '@/lib/database';
import { documentDefinition } from '@/data/demo/document-catalogue';
import { advanceTask } from './engine';

/**
 * Requirement tracking for a parent application.
 *
 * A parent (a passport, a scheme) holds a list of requirements. Each one has
 * its own state and, once the citizen starts resolving it, its own child task.
 * Children move independently — that is the whole point: a citizen chasing an
 * Aadhaar should not be blocked from also chasing a birth certificate.
 */

export interface RequirementInput {
  key: string;
  label: string;
  purpose: RequirementState['purpose'];
  why: string;
}

/** States that mean the parent still cannot go ahead. */
const OUTSTANDING: DocumentState[] = [
  'MISSING',
  'ACTION_REQUIRED',
  'PROCESSING',
  'APPLICATION_SUBMITTED',
  'VERIFICATION_PENDING',
  'NEEDS_UPDATE',
  'LOST',
  'REJECTED',
];

export function isSatisfied(state: DocumentState): boolean {
  return state === 'AVAILABLE' || state === 'AVAILABLE_AFTER_PROCESSING' || state === 'COMPLETED';
}

export function readRequirements(task: CitizenTask): RequirementState[] {
  const raw = task.data.requirements;
  return Array.isArray(raw) ? (raw as RequirementState[]) : [];
}

export function requirementProgress(task: CitizenTask): {
  ready: number;
  total: number;
  outstanding: RequirementState[];
  allReady: boolean;
} {
  const requirements = readRequirements(task);
  const ready = requirements.filter((requirement) => isSatisfied(requirement.state)).length;
  const outstanding = requirements.filter((requirement) => OUTSTANDING.includes(requirement.state));
  return {
    ready,
    total: requirements.length,
    outstanding,
    allReady: requirements.length > 0 && ready === requirements.length,
  };
}

/** Builds the requirement list by checking what the citizen already holds. */
export async function buildRequirements(
  userId: string,
  inputs: RequirementInput[],
): Promise<RequirementState[]> {
  const documents = await getDatabase().listDocuments(userId);
  return inputs.map((input) => {
    const held = documents.find((document) => document.purposes.includes(input.purpose));
    return {
      key: input.key,
      label: input.label,
      purpose: input.purpose,
      why: input.why,
      state: held ? 'AVAILABLE' : 'MISSING',
      childTaskId: null,
      documentId: held?.id ?? null,
      reference: null,
      note: held ? null : 'We could not find this in your papers.',
    };
  });
}

export interface RequirementPatch {
  state?: DocumentState;
  childTaskId?: string | null;
  documentId?: string | null;
  reference?: string | null;
  note?: string | null;
}

/**
 * Updates one requirement on the parent and recalculates the parent's own
 * status. This is the single place where "3 of 5" becomes "4 of 5", so a child
 * finishing anywhere always moves the parent correctly.
 */
export async function updateRequirement(
  parentTaskId: string,
  key: string,
  patch: RequirementPatch,
): Promise<CitizenTask | null> {
  const db = getDatabase();
  const parent = await db.getTask(parentTaskId);
  if (!parent) return null;

  const requirements = readRequirements(parent).map((requirement) =>
    requirement.key === key ? { ...requirement, ...patch } : requirement,
  );
  const ready = requirements.filter((requirement) => isSatisfied(requirement.state)).length;
  const allReady = requirements.length > 0 && ready === requirements.length;

  const documentIds = requirements
    .map((requirement) => requirement.documentId)
    .filter((value): value is string => Boolean(value));

  return advanceTask({
    taskId: parent.id,
    data: { requirements, documentsReady: ready, documentsTotal: requirements.length },
    documents: documentIds,
    status: allReady ? 'WAITING_FOR_CONFIRMATION' : 'WAITING_FOR_DOCUMENT',
    currentStep: allReady ? 'review' : 'documents',
    complete: allReady ? ['documents'] : [],
    nextActionLabel: allReady ? 'Review and send' : 'Sort out your papers',
    nextActionPrompt: allReady
      ? `Continue my ${parent.title.toLowerCase()}`
      : `Continue my ${parent.title.toLowerCase()}`,
    timeline: allReady
      ? { label: 'All papers are ready', tone: 'success' }
      : undefined,
  });
}

/** The step labels a child task shows, which depend on how it is being resolved. */
export function childSteps(route: ResolutionRoute): { id: string; label: string }[] {
  switch (route) {
    case 'have_it':
      return [
        { id: 'choose', label: 'Choose your paper' },
        { id: 'check', label: 'Check it' },
        { id: 'done', label: 'Saved' },
      ];
    case 'already_applied':
      return [
        { id: 'reference', label: 'Your application number' },
        { id: 'check', label: 'Check with the office' },
        { id: 'done', label: 'Result' },
      ];
    case 'never_applied':
      return [
        { id: 'details', label: 'Your details' },
        { id: 'review', label: 'Your check' },
        { id: 'submit', label: 'Sent to the office' },
        { id: 'processing', label: 'Office checking' },
        { id: 'done', label: 'Ready' },
      ];
    case 'lost':
      return [
        { id: 'details', label: 'Your details' },
        { id: 'review', label: 'Your check' },
        { id: 'submit', label: 'Request sent' },
        { id: 'processing', label: 'Getting a new copy' },
        { id: 'done', label: 'Ready' },
      ];
    case 'update':
      return [
        { id: 'details', label: 'What needs changing' },
        { id: 'verify', label: 'Checking it is you' },
        { id: 'review', label: 'Your check' },
        { id: 'submit', label: 'Change sent' },
        { id: 'processing', label: 'Office checking' },
        { id: 'done', label: 'Ready' },
      ];
    default:
      return [
        { id: 'details', label: 'What went wrong' },
        { id: 'review', label: 'Your check' },
        { id: 'submit', label: 'Complaint sent' },
        { id: 'processing', label: 'Under review' },
        { id: 'done', label: 'Answered' },
      ];
  }
}

/** How long the simulated office takes for this document and route. */
export function processingSeconds(documentKey: string, route: ResolutionRoute): number {
  return documentDefinition(documentKey).processingSeconds[route] ?? 20;
}
