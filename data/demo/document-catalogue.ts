import type { DocumentPurpose, ResolutionRoute } from '@/types/document';

/**
 * What NammaSahaay knows about each kind of document a service can ask for.
 *
 * This is the table that lets ONE resolution flow serve every document: the
 * citizen says what their situation is ("I lost it", "I never applied"), and
 * the right words, steps and timings come from here rather than from a
 * document-specific branch in the code.
 */

export interface ResolutionOption {
  route: ResolutionRoute;
  label: string;
  /** Shown under the button so the citizen can tell the options apart. */
  hint: string;
}

export interface DocumentDefinition {
  key: string;
  /** What the citizen calls it. */
  label: string;
  purpose: DocumentPurpose;
  /** Answer to "why do you need this?" */
  why: string;
  /** Which office issues it, in plain words. */
  issuedBy: string;
  /** Reference prefix for a demo application, e.g. AAD -> AAD-2026-00124. */
  referencePrefix: string;
  /** Which situations apply to this document. */
  routes: ResolutionRoute[];
  /** Roughly how long the simulated office takes, per route, in seconds. */
  processingSeconds: Partial<Record<ResolutionRoute, number>>;
  /** True when this document can be built from the citizen's saved profile. */
  usesProfile: boolean;
}

const ALL_ROUTES: ResolutionRoute[] = [
  'have_it',
  'already_applied',
  'never_applied',
  'lost',
  'update',
  'problem',
];

export const ROUTE_LABELS: Record<ResolutionRoute, { label: (name: string) => string; hint: string }> =
  {
    have_it: {
      label: (name) => `I already have my ${name}`,
      hint: 'Pick it from your papers or add a photo or PDF.',
    },
    already_applied: {
      label: () => 'I applied but have not got it',
      hint: 'I will check what is happening with your application.',
    },
    never_applied: {
      label: (name) => `I never applied for ${name}`,
      hint: 'I will help you apply for it here.',
    },
    lost: {
      label: (name) => `I lost my ${name}`,
      hint: 'I will help you get another copy.',
    },
    update: {
      label: () => 'Something on it is wrong',
      hint: 'Name, address, date of birth or mobile number.',
    },
    problem: {
      label: () => 'I am having a problem',
      hint: 'I will write a complaint for you.',
    },
  };

export const DOCUMENT_CATALOGUE: Record<string, DocumentDefinition> = {
  aadhaar: {
    key: 'aadhaar',
    label: 'Aadhaar',
    purpose: 'aadhaar_document',
    why: 'Aadhaar is used to confirm who you are. Most services ask for it.',
    issuedBy: 'the Aadhaar office',
    referencePrefix: 'AAD',
    routes: ALL_ROUTES,
    processingSeconds: {
      never_applied: 25,
      lost: 18,
      update: 22,
      already_applied: 12,
      problem: 15,
    },
    usesProfile: true,
  },
  birth_certificate: {
    key: 'birth_certificate',
    label: 'Birth Certificate',
    purpose: 'birth_certificate',
    why: 'A birth certificate confirms when and where you were born.',
    issuedBy: 'your municipal office',
    referencePrefix: 'BIR',
    routes: ALL_ROUTES,
    processingSeconds: {
      never_applied: 30,
      lost: 20,
      update: 24,
      already_applied: 12,
      problem: 15,
    },
    usesProfile: true,
  },
  identity: {
    key: 'identity',
    label: 'Identity proof',
    purpose: 'identity_proof',
    why: 'Used to confirm that the application belongs to you.',
    issuedBy: 'the issuing office',
    referencePrefix: 'IDP',
    routes: ['have_it', 'never_applied', 'lost', 'problem'],
    processingSeconds: { never_applied: 20, lost: 15, problem: 15 },
    usesProfile: true,
  },
  address: {
    key: 'address',
    label: 'Address proof',
    purpose: 'address_proof',
    why: 'Used to confirm where you live.',
    issuedBy: 'the issuing office',
    referencePrefix: 'ADP',
    routes: ['have_it', 'never_applied', 'update', 'problem'],
    processingSeconds: { never_applied: 20, update: 18, problem: 15 },
    usesProfile: true,
  },
  dob: {
    key: 'dob',
    label: 'Date of birth proof',
    purpose: 'dob_proof',
    why: 'Used to confirm your date of birth.',
    issuedBy: 'the issuing office',
    referencePrefix: 'DOB',
    routes: ['have_it', 'never_applied', 'lost', 'problem'],
    processingSeconds: { never_applied: 22, lost: 16, problem: 15 },
    usesProfile: true,
  },
  income: {
    key: 'income',
    label: 'Income certificate',
    purpose: 'income_proof',
    why: 'Used to check whether your household is within the income limit.',
    issuedBy: 'the revenue office',
    referencePrefix: 'INC',
    routes: ['have_it', 'already_applied', 'never_applied', 'lost', 'problem'],
    processingSeconds: { never_applied: 25, lost: 18, already_applied: 12, problem: 15 },
    usesProfile: true,
  },
  bank: {
    key: 'bank',
    label: 'Bank proof',
    purpose: 'bank_proof',
    why: 'Used so any payment reaches the right account.',
    issuedBy: 'your bank',
    referencePrefix: 'BNK',
    routes: ['have_it', 'problem'],
    processingSeconds: { problem: 15 },
    usesProfile: false,
  },
  child: {
    key: 'child',
    label: 'Child birth certificate',
    purpose: 'child_birth_proof',
    why: 'Used to confirm the child named in the application.',
    issuedBy: 'your municipal office',
    referencePrefix: 'CBC',
    routes: ['have_it', 'never_applied', 'lost', 'problem'],
    processingSeconds: { never_applied: 28, lost: 18, problem: 15 },
    usesProfile: false,
  },
  education: {
    key: 'education',
    label: 'Education certificate',
    purpose: 'education_proof',
    why: 'Used as a supporting record for the application.',
    issuedBy: 'your school or board',
    referencePrefix: 'EDU',
    routes: ['have_it', 'lost', 'problem'],
    processingSeconds: { lost: 20, problem: 15 },
    usesProfile: false,
  },
};

export function documentDefinition(key: string): DocumentDefinition {
  return (
    DOCUMENT_CATALOGUE[key] ?? {
      key,
      label: key.replace(/_/g, ' '),
      purpose: 'identity_proof',
      why: 'Used to check the details of your application.',
      issuedBy: 'the issuing office',
      referencePrefix: 'DOC',
      routes: ['have_it', 'never_applied', 'lost', 'problem'],
      processingSeconds: { never_applied: 20, lost: 15, problem: 15 },
      usesProfile: false,
    }
  );
}

/** Finds the document a free-text phrase is about ("I lost my aadhaar"). */
export function matchDocumentKey(text: string): string | null {
  const t = text.toLowerCase();
  if (/\baadhaa?r\b|\buid\b/.test(t)) return 'aadhaar';
  if (/\bbirth certificate\b|\bbirth cert\b/.test(t)) {
    return /\b(daughter|son|child|baby)\b/.test(t) ? 'child' : 'birth_certificate';
  }
  if (/\bincome certificate\b/.test(t)) return 'income';
  if (/\b(bank|passbook) proof\b|\bbank details\b/.test(t)) return 'bank';
  if (/\b(marksheet|school certificate|education certificate)\b/.test(t)) return 'education';
  if (/\baddress proof\b/.test(t)) return 'address';
  if (/\bidentity proof\b|\bid proof\b/.test(t)) return 'identity';
  if (/\bdate of birth proof\b|\bdob proof\b/.test(t)) return 'dob';
  return null;
}

/** The situation a phrase describes, when the citizen states it directly. */
export function matchRoute(text: string): ResolutionRoute | null {
  const t = text.toLowerCase();
  if (/\b(lost|misplaced|cannot find|can'?t find|missing my)\b/.test(t)) return 'lost';
  if (/\bnever (applied|got|had)\b|\bdo not have\b|\bdon'?t have\b/.test(t)) return 'never_applied';
  if (/\b(applied|enrolled)\b.*\b(not (received|got)|waiting|pending)\b/.test(t)) {
    return 'already_applied';
  }
  if (/\balready applied\b|\bapplied but\b/.test(t)) return 'already_applied';
  if (
    /\b(wrong|incorrect|mistake|spelling|changed|change|update|not linked|old number)\b/.test(t)
  ) {
    return 'update';
  }
  if (/\b(problem|issue|not working|cannot download|can'?t download|complain)\b/.test(t)) {
    return 'problem';
  }
  if (/\bi (already )?have\b/.test(t)) return 'have_it';
  return null;
}

/** Which part of a document a correction is about. */
export function matchCorrectionField(text: string): 'name' | 'address' | 'dob' | 'mobile' | null {
  const t = text.toLowerCase();
  if (/\bmobile\b|\bphone\b|\bnumber\b/.test(t)) return 'mobile';
  if (/\bname\b/.test(t)) return 'name';
  if (/\baddress\b/.test(t)) return 'address';
  if (/\b(date of birth|dob|birth date)\b/.test(t)) return 'dob';
  return null;
}
