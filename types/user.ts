/**
 * Citizen profile types.
 * Every profile in this prototype is SYNTHETIC DEMO DATA.
 */

export type Gender = 'female' | 'male' | 'other';

export type MaritalStatus = 'single' | 'married' | 'widowed' | 'divorced';

export type EmploymentStatus = 'employed' | 'self_employed' | 'unemployed' | 'retired';

export interface Dependent {
  relation: 'daughter' | 'son' | 'parent' | 'other';
  age: number;
}

/** A government identifier shown in the demo. Values are fabricated placeholders. */
export interface DemoIdentifier {
  key: string;
  label: string;
  value: string;
  note: string;
}

export interface CitizenProfile {
  id: string;
  name: string;
  age: number;
  /** ISO date. Applications ask for this rather than an age. */
  dateOfBirth: string;
  /** A photo on file means the citizen is not asked for one again. */
  photo: { available: boolean; label: string };
  gender: Gender;
  state: string;
  city: string;
  maritalStatus: MaritalStatus;
  dependents: Dependent[];
  employmentStatus: EmploymentStatus;
  education: string;
  annualHouseholdIncome: number;
  mobile: string;
  email: string;
  /** Always true in this prototype. */
  isSyntheticDemoData: true;
  identifiers: DemoIdentifier[];
  bankAccountMasked: string;
  /** Postal address line, when captured from an uploaded ID proof. */
  addressLine?: string;
  /** 6-digit postal PIN code. */
  pincode?: string;
  /** Father's or husband's name as printed on the ID, when available. */
  guardianName?: string;
  /** Which ID proof this account was created/verified from (e.g. 'aadhaar'). */
  verifiedVia?: string;
}

export type ConnectionStatus = 'connected' | 'available' | 'unavailable';

export interface ConnectedService {
  id: string;
  name: string;
  description: string;
  status: ConnectionStatus;
  /** Always 'demo' in this prototype — no real government connection exists. */
  mode: 'demo';
  lastCheckedAt: string;
  officialSourceName: string;
  officialSourceUrl: string;
}

/**
 * The structured life situation the AI produces from a natural-language
 * description. The eligibility engine consumes ONLY this — the model never
 * decides eligibility itself.
 */
export interface CitizenSituation {
  state?: string;
  gender?: Gender;
  age?: number;
  maritalStatus?: MaritalStatus;
  dependentChildren?: number;
  youngestChildAge?: number;
  employmentStatus?: EmploymentStatus;
  annualHouseholdIncome?: number;
  educationLevel?: string;
  hasDisability?: boolean;
}
