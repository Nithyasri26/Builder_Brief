import type {
  ChatAction,
  ContentBlock,
  InputState,
  ProcessingPlan,
  ProgressStep,
  SourceRef,
} from '@/types/chat';
import type { CitizenTask } from '@/types/task';
import type { CitizenProfile, CitizenSituation } from '@/types/user';
import type { CitizenDocument } from '@/types/document';
import { progressOf } from '@/lib/workflows/engine';
import { formatCurrency } from '@/lib/utils';

/** Shared building blocks for assistant messages. */

export interface AssistantDraft {
  content: string;
  steps?: ProgressStep[];
  blocks?: ContentBlock[];
  actions?: ChatAction[];
  suggestions?: string[];
  /** Suggested conversation title when this is the first turn. */
  title?: string;
  /** Locks text and voice while these steps play, then reveals the answer. */
  processing?: ProcessingPlan;
  /** What the citizen may do once this answer is on screen. */
  inputState?: InputState;
}

export function done(...labels: string[]): ProgressStep[] {
  return labels.map((label) => ({ label, state: 'done' }));
}

export function steps(
  completed: string[],
  active?: string,
  pending: string[] = [],
): ProgressStep[] {
  return [
    ...completed.map((label) => ({ label, state: 'done' as const })),
    ...(active ? [{ label: active, state: 'active' as const }] : []),
    ...pending.map((label) => ({ label, state: 'pending' as const })),
  ];
}

export function taskProgressBlock(task: CitizenTask): ContentBlock {
  return { type: 'task_progress', task, steps: progressOf(task) };
}

export function noticeBlock(
  body: string,
  tone: 'info' | 'success' | 'warning' | 'danger' = 'info',
  title?: string,
  source?: SourceRef,
): ContentBlock {
  return { type: 'notice', tone, body, title, source };
}

export function demoSource(name: string, url: string, lastVerified: string): SourceRef {
  return { name, url, lastVerified, dataType: 'verified_public_information' };
}

export function demoDatasetSource(): SourceRef {
  return { name: 'Sample programme data', dataType: 'demo_dataset' };
}

/** Turns the stored profile into the structured situation the engine reads. */
export function situationFromProfile(profile: CitizenProfile): CitizenSituation {
  return {
    state: profile.state,
    gender: profile.gender,
    age: profile.age,
    maritalStatus: profile.maritalStatus,
    dependentChildren: profile.dependents.filter((d) => d.relation === 'daughter' || d.relation === 'son').length,
    youngestChildAge: profile.dependents.length
      ? Math.min(...profile.dependents.map((d) => d.age))
      : undefined,
    employmentStatus: profile.employmentStatus,
    annualHouseholdIncome: profile.annualHouseholdIncome,
    educationLevel: profile.education,
  };
}

export function mergeSituation(
  base: CitizenSituation,
  extracted?: CitizenSituation,
): CitizenSituation {
  if (!extracted) return base;
  const merged: CitizenSituation = { ...base };
  for (const [key, value] of Object.entries(extracted)) {
    if (value !== undefined && value !== null) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export function profileSummary(profile: CitizenProfile): string {
  const children = profile.dependents.length;
  return [
    `${profile.name}, ${profile.age}`,
    `${profile.city}, ${profile.state}`,
    profile.maritalStatus,
    children ? `${children} dependent child` : 'no dependents recorded',
    profile.employmentStatus.replace('_', ' '),
    `household income ${formatCurrency(profile.annualHouseholdIncome)}`,
  ].join('; ');
}

/** compact = a short ticked list instead of full cards, for use inside a chat turn. */
export function documentsBlock(
  documents: CitizenDocument[],
  title?: string,
  compact = false,
): ContentBlock {
  return { type: 'documents', documents, title, compact };
}

export function promptAction(label: string, prompt: string, variant: ChatAction['variant'] = 'secondary'): ChatAction {
  return { kind: 'prompt', label, prompt, variant };
}

export function serverAction(
  label: string,
  action: string,
  payload: Record<string, unknown> = {},
  variant: ChatAction['variant'] = 'primary',
): ChatAction {
  return { kind: 'action', label, action, payload, variant };
}

export function linkAction(label: string, href: string, variant: ChatAction['variant'] = 'secondary'): ChatAction {
  return { kind: 'link', label, href, variant };
}

export function downloadAction(label: string, downloadId: string, variant: ChatAction['variant'] = 'secondary'): ChatAction {
  return { kind: 'download', label, downloadId, variant };
}

export const DEFAULT_SUGGESTIONS = [
  'Is there any government help for me?',
  'Show my PF money',
  'I want a passport',
  'Show my papers',
  'I want to complain',
];

export const UNAVAILABLE_DRAFT = (serviceName: string, retryPrompt: string): AssistantDraft => ({
  content: `The ${serviceName} service is not answering right now. Nothing you did was lost.`,
  actions: [promptAction('Try again', retryPrompt, 'primary')],
  suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
});
