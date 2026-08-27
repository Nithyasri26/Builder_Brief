/** Document wallet types. All files in this prototype are synthetic. */

export type DocumentCategory =
  | 'identity'
  | 'education'
  | 'employment'
  | 'bank'
  | 'family'
  | 'government';

export type DocumentSource =
  | 'demo_wallet'
  | 'digilocker_demo'
  | 'uploaded'
  | 'generated';

export type DocumentVerification = 'demo_verified' | 'demo_imported' | 'unverified';

/**
 * What a document can be used for. Workflows request a purpose, not a
 * specific file, which is what makes document reuse possible.
 */
export type DocumentPurpose =
  | 'identity_proof'
  | 'address_proof'
  | 'dob_proof'
  | 'income_proof'
  | 'bank_proof'
  | 'child_birth_proof'
  | 'education_proof'
  | 'employment_proof'
  | 'aadhaar_document'
  | 'birth_certificate';

/**
 * Where a single required document has got to.
 *
 * A missing document is never just "upload it" — the citizen may already have
 * it, may have applied, may never have applied, may have lost it, or may need
 * it corrected. Each of those is a different state with a different next step.
 */
export type DocumentState =
  | 'AVAILABLE'
  | 'MISSING'
  | 'ACTION_REQUIRED'
  | 'PROCESSING'
  | 'APPLICATION_SUBMITTED'
  | 'VERIFICATION_PENDING'
  | 'AVAILABLE_AFTER_PROCESSING'
  | 'NEEDS_UPDATE'
  | 'LOST'
  | 'REJECTED'
  | 'COMPLETED';

/** How the citizen chose to resolve a document they do not currently hold. */
export type ResolutionRoute =
  | 'have_it'
  | 'already_applied'
  | 'never_applied'
  | 'lost'
  | 'update'
  | 'problem';

/** One requirement inside a parent application, with its own live state. */
export interface RequirementState {
  key: string;
  label: string;
  purpose: DocumentPurpose;
  why: string;
  state: DocumentState;
  /** The child task resolving this requirement, once one has been started. */
  childTaskId?: string | null;
  documentId?: string | null;
  reference?: string | null;
  note?: string | null;
}

export interface CitizenDocument {
  id: string;
  userId: string;
  name: string;
  fileName: string;
  category: DocumentCategory;
  purposes: DocumentPurpose[];
  source: DocumentSource;
  sourceLabel: string;
  issuedOn: string | null;
  addedAt: string;
  verification: DocumentVerification;
  mimeType: string;
  sizeLabel: string;
  /** Always true — nothing here is a real citizen document. */
  isDemoDocument: true;
  summary: string;
  /** Set for uploaded files: where the bytes live in the storage provider. */
  storageKey?: string;
}

/** A document sitting in the simulated DigiLocker wallet, not yet imported. */
export interface DigiLockerDocument {
  id: string;
  name: string;
  issuer: string;
  issuedOn: string;
  category: DocumentCategory;
  purposes: DocumentPurpose[];
  imported: boolean;
}

export interface DownloadFile {
  id: string;
  userId: string;
  fileName: string;
  title: string;
  kind: 'pf_passbook' | 'application' | 'certificate' | 'complaint' | 'ticket';
  createdAt: string;
  sizeLabel: string;
  /** Payload used to regenerate the demo PDF on request. */
  documentId?: string;
  taskId?: string;
}
