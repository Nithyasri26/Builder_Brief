import type {
  CitizenDocument,
  DigiLockerDocument,
  DownloadFile,
  ResolutionRoute,
} from './document';
import type { SchemeMatch } from './scheme';
import type { ApplicationView, CitizenTask } from './task';
import type { TrainOption } from './train';
import type { CitizenNotification } from './notification';
import type { Complaint } from './complaint';
import type { Intent } from './ai';

export type ChatRole = 'user' | 'assistant';

/** A rendered progress line such as "Checking your profile...". */
export interface ProgressStep {
  label: string;
  state: 'done' | 'active' | 'pending';
}

/**
 * A button inside an assistant message.
 * - prompt   : sends text back through the normal chat pipeline
 * - action   : posts a structured action to /api/chat/action
 * - link     : client-side navigation
 * - download : opens a generated demo file
 */
export type ChatActionKind = 'prompt' | 'action' | 'link' | 'download';

export interface ChatAction {
  kind: ChatActionKind;
  label: string;
  /** prompt kind */
  prompt?: string;
  /** action kind */
  action?: string;
  payload?: Record<string, unknown>;
  /** link kind */
  href?: string;
  /** download kind */
  downloadId?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export interface SourceRef {
  name: string;
  url?: string;
  lastVerified?: string;
  dataType: 'verified_public_information' | 'demo_dataset';
}

export interface PassbookSummary {
  uan: string;
  memberId: string;
  employer: string;
  employeeContribution: number;
  employerContribution: number;
  interest: number;
  balance: number;
  lastUpdated: string;
}

export interface EmailReceipt {
  to: string;
  subject: string;
  attachment?: string;
  status: 'demo_sent';
  sentAt: string;
}

export interface RequirementRef {
  key: string;
  label: string;
  why: string;
}

/** One staged step of a simulated service call, shown while input is locked. */
export interface ProcessingPlan {
  title: string;
  steps: { label: string; ms: number }[];
  reassurance?: string;
}

/** What the citizen may do while a turn is in this state. */
export type InputState =
  | 'IDLE'
  | 'ACTIVE_PROCESSING'
  | 'WAITING_FOR_USER'
  | 'WAITING_FOR_DOCUMENT'
  | 'WAITING_FOR_CONFIRMATION'
  | 'BACKGROUND_PROCESSING'
  | 'COMPLETED';

export type ContentBlock =
  | { type: 'notice'; tone: 'info' | 'success' | 'warning' | 'danger'; title?: string; body: string; source?: SourceRef }
  | { type: 'checklist'; title: string; items: { label: string; state: 'done' | 'pending' | 'missing' }[] }
  | { type: 'schemes'; matches: SchemeMatch[] }
  | { type: 'scheme_detail'; match: SchemeMatch }
  | { type: 'pf_passbook'; passbook: PassbookSummary; source: SourceRef }
  | { type: 'documents'; documents: CitizenDocument[]; title?: string; compact?: boolean }
  | { type: 'digilocker'; documents: DigiLockerDocument[] }
  | { type: 'document_choice'; requirement: RequirementRef; suggestion: CitizenDocument | null; taskId: string }
  | { type: 'review'; title: string; rows: { label: string; value: string }[]; warning: string; confirm: ChatAction; cancel: ChatAction }
  | { type: 'task_progress'; task: CitizenTask; steps: { id: string; label: string; state: 'done' | 'current' | 'pending' }[] }
  | { type: 'applications'; applications: ApplicationView[] }
  | { type: 'trains'; options: TrainOption[]; taskId: string; summary: string }
  | { type: 'complaint_draft'; complaint: Complaint }
  | { type: 'email_sent'; receipt: EmailReceipt }
  | { type: 'downloads'; files: DownloadFile[] }
  | { type: 'notifications'; items: CitizenNotification[] }
  | { type: 'explain'; term: string; meaning: string; example?: string }
  | { type: 'why'; title: string; reasons: string[] }
  /** Live progress of an application and the papers it is waiting for. */
  | { type: 'requirements'; taskId: string; title: string }
  /** "Do you already have it, or do you need help getting it?" */
  | {
      type: 'document_options';
      parentTaskId: string | null;
      documentKey: string;
      label: string;
      why: string;
      options: { route: ResolutionRoute; label: string; hint: string }[];
    }
  /** Pick the paper from what the citizen already holds, or add one. */
  | {
      type: 'document_picker';
      childTaskId: string;
      label: string;
      candidates: CitizenDocument[];
      locker: DigiLockerDocument[];
    }
  /** Confirm the details already on file before an application is built. */
  | {
      type: 'profile_confirm';
      childTaskId: string;
      rows: { key: string; label: string; value: string }[];
    }
  /** A single question with a text answer. */
  | {
      type: 'text_input';
      childTaskId: string;
      action: string;
      field: string;
      label: string;
      placeholder?: string;
      help?: string;
      current?: string;
    }
  /** Demo one-time password check. */
  | { type: 'otp'; childTaskId: string; mobile: string; alreadySent?: boolean };

export interface MessageMeta {
  intent?: Intent;
  confidence?: number;
  aiSource?: 'rules' | 'llm' | 'fallback';
  routing?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  /** When set, the client locks input and plays these steps before revealing. */
  processing?: ProcessingPlan;
  /** What the citizen may do once this message is on screen. */
  inputState?: InputState;
  steps?: ProgressStep[];
  blocks?: ContentBlock[];
  actions?: ChatAction[];
  suggestions?: string[];
  createdAt: string;
  meta?: MessageMeta;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export interface ChatTurnResult {
  conversation: Conversation;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}
