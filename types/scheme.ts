import type { CitizenSituation } from './user';
import type { DocumentPurpose } from './document';

export type SchemeCategory =
  | 'social_security'
  | 'women_and_child'
  | 'education'
  | 'employment'
  | 'health'
  | 'housing';

export type SchemeStatus = 'open' | 'closed' | 'unknown';

/** Where the information on a card came from. Shown to the citizen. */
export type SchemeDataType = 'verified_public_information' | 'demo_dataset';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'lte'
  | 'gte'
  | 'exists'
  | 'is_true';

export interface EligibilityRule {
  id: string;
  field: keyof CitizenSituation;
  operator: RuleOperator;
  value?: string | number | boolean | Array<string | number>;
  /** Plain-language statement of the rule, e.g. "Karnataka resident". */
  label: string;
  /** Why the rule exists, in simple English. */
  explanation: string;
}

export interface SchemeRequiredDocument {
  key: string;
  label: string;
  purpose: DocumentPurpose;
  /** Answer to "Why do you need this?" */
  why: string;
}

export interface Scheme {
  id: string;
  name: string;
  category: SchemeCategory;
  state: string;
  description: string;
  benefitSummary: string;
  officialSource: string;
  sourceUrl: string;
  eligibilityRules: EligibilityRule[];
  requiredDocuments: SchemeRequiredDocument[];
  applicationMethod: string;
  processingTime: string;
  status: SchemeStatus;
  lastVerified: string;
  dataType: SchemeDataType;
  /** Demo schemes carry a DEMO SCHEME badge and deliberately unofficial names. */
  isDemoScheme: boolean;
}

export type MatchLevel = 'potential_match' | 'more_information_required' | 'not_matching';

export interface RuleOutcome {
  ruleId: string;
  label: string;
  explanation: string;
  result: 'met' | 'unknown' | 'not_met';
}

export interface DocumentAvailability {
  key: string;
  label: string;
  why: string;
  available: boolean;
  documentId?: string;
  documentName?: string;
}

export interface SchemeMatch {
  schemeId: string;
  scheme: Scheme;
  level: MatchLevel;
  outcomes: RuleOutcome[];
  missingInformation: string[];
  documents: DocumentAvailability[];
  /** Used by the "Why am I seeing this?" explainer. */
  explanation: string[];
}
