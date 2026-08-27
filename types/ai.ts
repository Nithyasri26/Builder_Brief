import type { CitizenSituation } from './user';

/** Every intent the product understands. UNKNOWN triggers a guided fallback. */
export const INTENTS = [
  'GET_PF_PASSBOOK',
  'START_PF_WITHDRAWAL',
  'CHECK_GOVERNMENT_SCHEMES',
  'CHECK_SCHEME_ELIGIBILITY',
  'START_SCHEME_APPLICATION',
  'GET_DOCUMENT',
  'IMPORT_DIGILOCKER_DOCUMENT',
  /** A request about one document: lost, never applied, wrong details, stuck. */
  'RESOLVE_DOCUMENT',
  'START_PASSPORT_APPLICATION',
  'CREATE_COMPLAINT',
  'SEARCH_TRAINS',
  'START_TRAIN_BOOKING',
  'VIEW_APPLICATIONS',
  'VIEW_DOCUMENTS',
  'VIEW_DOWNLOADS',
  'VIEW_NOTIFICATIONS',
  'CONTINUE_TASK',
  'EXPLAIN_TERM',
  'PAUSE_TASK',
  'HELP',
  'UNKNOWN',
] as const;

export type Intent = (typeof INTENTS)[number];

export interface IntentEntities {
  service?: string;
  amount?: number;
  documentName?: string;
  term?: string;
  from?: string;
  to?: string;
  date?: string;
  passengers?: number;
  travelClass?: string;
  complaintTopic?: string;
  lastReceived?: string;
  taskId?: string;
  schemeId?: string;
}

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entities: IntentEntities;
  /** Which layer produced the result — used for the cost dashboard. */
  source: 'rules' | 'llm' | 'fallback';
  /** Structured situation extracted from a life-situation message, if any. */
  situation?: CitizenSituation;
  /** Optional model-written empathy/context line. Never used for decisions. */
  reply?: string;
}

export interface AIContext {
  profileSummary: string;
  recentMessages: { role: 'user' | 'assistant'; content: string }[];
  activeTaskSummary?: string;
}

/**
 * The only AI surface the rest of the application is allowed to touch.
 * Business logic never imports a vendor SDK directly.
 */
export interface AIProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  understandIntent(input: string, context: AIContext): Promise<IntentResult>;
  generateResponse(input: string, context: AIContext): Promise<string>;
}

export interface AIRoutingDecision {
  layer: 'deterministic' | 'rules' | 'llm';
  reason: string;
  estimatedTokens: number;
}
