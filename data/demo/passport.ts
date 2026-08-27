import type { DocumentPurpose } from '@/types/document';

export interface PassportRequirement {
  key: string;
  label: string;
  purpose: DocumentPurpose;
  why: string;
}

/**
 * The real document list for a passport application is published by Passport
 * Seva and varies by applicant category, so the citizen is always pointed at
 * the official source before submitting anything real.
 */
export const passportRequirements: PassportRequirement[] = [
  {
    key: 'identity',
    label: 'Identity proof',
    purpose: 'identity_proof',
    why: 'Used to confirm that the application belongs to you.',
  },
  {
    key: 'address',
    label: 'Address proof',
    purpose: 'address_proof',
    why: 'Used to confirm the address that will be printed and checked.',
  },
  {
    key: 'dob',
    label: 'Date of birth proof',
    purpose: 'dob_proof',
    why: 'Used to confirm your date of birth on the application.',
  },
  {
    key: 'aadhaar',
    label: 'Aadhaar',
    purpose: 'aadhaar_document',
    why: 'Used to confirm who you are. Most services ask for it.',
  },
  {
    key: 'birth_certificate',
    label: 'Birth Certificate',
    purpose: 'birth_certificate',
    why: 'Used to confirm when and where you were born.',
  },
];

export const PASSPORT_SOURCE = {
  name: 'Passport Seva (official portal)',
  url: 'https://www.passportindia.gov.in',
  lastVerified: '2026-08-25',
} as const;

export const passportApplicationTypes = [
  { id: 'fresh', label: 'Fresh passport' },
  { id: 'reissue', label: 'Re-issue of passport' },
];

export const demoAppointmentCentre = 'Passport Seva Kendra, Bengaluru';
