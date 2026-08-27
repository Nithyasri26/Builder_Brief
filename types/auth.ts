/**
 * Authentication & KYC onboarding types.
 *
 * Everything here supports the real login/register flow: a citizen uploads a
 * government ID proof, the app reads it (OCR), the citizen confirms the
 * details, verifies a mobile + email by OTP, and an account is created.
 *
 * The IDENTITY DATA is still synthetic in spirit — this is a practice app and
 * every generated document is watermarked SAMPLE — but the account, the
 * session and the profile are now genuinely per-user and persisted.
 */

export type IdDocType =
  | 'aadhaar'
  | 'pan'
  | 'passport'
  | 'voter'
  | 'driving_licence'
  | 'unknown';

export const ID_DOC_LABEL: Record<IdDocType, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN Card',
  passport: 'Passport',
  voter: 'Voter ID (EPIC)',
  driving_licence: 'Driving Licence',
  unknown: 'ID document',
};

/** The fields we try to lift off a scanned ID. All optional — OCR is imperfect. */
export interface ExtractedIdFields {
  name?: string;
  dateOfBirth?: string; // ISO yyyy-mm-dd
  gender?: 'male' | 'female' | 'other';
  idNumber?: string;
  guardianName?: string; // father's / husband's name as printed
  address?: string;
  pincode?: string;
  placeOfBirth?: string;
  dateOfExpiry?: string; // ISO, passports/licences
}

/** The full result of reading one uploaded ID image. */
export interface ExtractedIdentity {
  docType: IdDocType;
  docTypeLabel: string;
  idNumberLabel: string;
  fields: ExtractedIdFields;
  /** Mean OCR confidence 0–100. Low values prompt a "please check" hint. */
  confidence: number;
  /** Kept for debugging/transparency; never shown as-is to the citizen. */
  rawText: string;
}

/** A registered citizen account. Auth identity, distinct from the rich profile. */
export interface UserAccount {
  id: string;
  mobile: string; // normalised 10-digit
  email: string; // lower-cased
  /** scrypt hash of the citizen's password. Never the plaintext. */
  passwordHash: string;
  createdAt: string;
  verifiedVia: IdDocType;
  status: 'active';
}

/** The profile-shaped data gathered during registration, kept until OTP passes. */
export interface RegisterDraft {
  name: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  state: string;
  city: string;
  addressLine?: string;
  pincode?: string;
  guardianName?: string;
  idNumber?: string;
  verifiedVia: IdDocType;
  mobile: string;
  email: string;
  /** scrypt hash of the password chosen at sign-up. */
  passwordHash: string;
}

export type OtpPurpose = 'register' | 'login' | 'reset';
export type OtpChannel = 'mobile' | 'email';

export interface OtpChannelState {
  destination: string;
  codeHash: string;
  verified: boolean;
}

export interface OtpChallenge {
  id: string;
  purpose: OtpPurpose;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  channels: Partial<Record<OtpChannel, OtpChannelState>>;
  /** Present for register challenges — the account/profile to create on success. */
  draft?: RegisterDraft;
  /** Present for login challenges — the account being signed into. */
  accountId?: string;
}

/** What the browser is told after starting an OTP step. Codes only in demo mode. */
export interface OtpStartResponse {
  challengeId: string;
  channels: OtpChannel[];
  /** Masked destinations for display, e.g. "+91 ·····3210". */
  maskedMobile?: string;
  maskedEmail?: string;
  /** Only populated when NEXT_PUBLIC_DEMO_MODE — lets the demo show the code. */
  demoCodes?: Partial<Record<OtpChannel, string>>;
}

export interface SessionPayload {
  userId: string;
  /** Unix seconds expiry. */
  exp: number;
}
