import type { CitizenProfile } from '@/types/user';
import type { RegisterDraft } from '@/types/auth';

/** Age in whole years from an ISO date of birth, or 0 if unparseable. */
export function ageFromDob(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age < 0 ? 0 : age;
}

/**
 * A complete, empty-but-valid profile for a citizen we know nothing about yet.
 * Used as the base a fresh registration is merged onto, so a new account never
 * inherits the demo persona's data.
 */
export function blankProfile(userId: string): CitizenProfile {
  return {
    id: userId,
    name: '',
    age: 0,
    dateOfBirth: '',
    photo: { available: false, label: 'No photo on file yet' },
    gender: 'other',
    state: '',
    city: '',
    maritalStatus: 'single',
    dependents: [],
    employmentStatus: 'unemployed',
    education: '',
    annualHouseholdIncome: 0,
    mobile: '',
    email: '',
    isSyntheticDemoData: true,
    identifiers: [],
    bankAccountMasked: '',
  };
}

/** Builds the citizen profile that a verified registration should persist. */
export function profileFromDraft(userId: string, draft: RegisterDraft): CitizenProfile {
  const base = blankProfile(userId);
  return {
    ...base,
    name: draft.name,
    dateOfBirth: draft.dateOfBirth,
    age: draft.dateOfBirth ? ageFromDob(draft.dateOfBirth) : 0,
    gender: draft.gender,
    state: draft.state,
    city: draft.city,
    addressLine: draft.addressLine,
    pincode: draft.pincode,
    guardianName: draft.guardianName,
    mobile: draft.mobile,
    email: draft.email,
    verifiedVia: draft.verifiedVia,
    identifiers: draft.idNumber
      ? [
          {
            key: draft.verifiedVia,
            label: labelForProof(draft.verifiedVia),
            value: draft.idNumber,
            note: 'Read from the ID proof you uploaded. Sample data — practice app.',
          },
        ]
      : [],
  };
}

function labelForProof(proof: string): string {
  switch (proof) {
    case 'aadhaar':
      return 'Aadhaar';
    case 'pan':
      return 'PAN';
    case 'passport':
      return 'Passport';
    case 'voter':
      return 'Voter ID';
    case 'driving_licence':
      return 'Driving Licence';
    default:
      return 'ID number';
  }
}
