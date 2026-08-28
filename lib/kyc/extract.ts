import 'server-only';
import { parse as parseMrz } from 'mrz';
import { ID_DOC_LABEL, type ExtractedIdentity, type ExtractedIdFields, type IdDocType } from '@/types/auth';
import type { OcrResult } from './ocr';

/**
 * Turns raw OCR text into structured identity fields.
 *
 * OCR is never perfect, so this is deliberately forgiving: it detects the
 * document type from the strong signals (a PAN pattern, an Aadhaar triplet, a
 * passport MRZ), lifts what it can, and leaves the rest blank for the citizen
 * to confirm on the review screen. Nothing here is trusted as ground truth —
 * it is a head-start, not an authority.
 */

const STOP_WORDS = new RegExp(
  [
    'GOVERNMENT',
    'INDIA',
    'AADHAAR',
    'UNIQUE',
    'IDENTIFICATION',
    'AUTHORITY',
    'INCOME',
    'TAX',
    'DEPARTMENT',
    'PERMANENT',
    'ACCOUNT',
    'NUMBER',
    'ELECTION',
    'COMMISSION',
    'ELECTOR',
    'PASSPORT',
    'REPUBLIC',
    'DRIVING',
    'LICENCE',
    'LICENSE',
    'TRANSPORT',
    'DATE',
    'BIRTH',
    'YEAR',
    'MALE',
    'FEMALE',
    'GENDER',
    'ADDRESS',
    'FATHER',
    'HUSBAND',
    'SIGNATURE',
    'VALID',
    'ISSUE',
    'EXPIRY',
    'NATIONALITY',
    'INDIAN',
    'SAMPLE',
  ].join('|'),
);

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function toIso(day: string, month: string, year: string): string | undefined {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!d || !m || !y || m > 12 || d > 31 || y < 1900 || y > 2100) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function findDob(text: string): string | undefined {
  const dmy = text.match(/\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/);
  if (dmy) return toIso(dmy[1], dmy[2], dmy[3]);
  // Aadhaar sometimes prints only a year of birth.
  const yob = text.match(/year of birth[:\s]*(\d{4})/i);
  if (yob) return `${yob[1]}-01-01`;
  return undefined;
}

function findGender(text: string): 'male' | 'female' | 'other' | undefined {
  if (/\bfemale\b/i.test(text)) return 'female';
  if (/\bmale\b/i.test(text)) return 'male';
  if (/\btransgender\b|\bother\b/i.test(text)) return 'other';
  return undefined;
}

function findPincode(text: string): string | undefined {
  // A 6-digit group that is not part of a longer number (avoids Aadhaar digits).
  const matches = text.match(/(?<!\d)(\d{6})(?!\d)/g);
  return matches?.[matches.length - 1];
}

/** A line that plausibly names a person: 2–4 mostly-alphabetic words, no keywords. */
function looksLikeName(line: string): boolean {
  const cleaned = line.replace(/[^A-Za-z .]/g, '').trim();
  if (cleaned.length < 4) return false;
  if (STOP_WORDS.test(cleaned.toUpperCase())) return false;
  const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
  return words.length >= 2 && words.length <= 4;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Picks the most name-like line, preferring the one just above the DOB/gender. */
function findName(rows: string[]): string | undefined {
  const anchor = rows.findIndex((line) => /\b(male|female|\d{2}[\/\-.]\d{2}[\/\-.]\d{4})\b/i.test(line));
  if (anchor > 0) {
    for (let i = anchor - 1; i >= 0; i -= 1) {
      if (looksLikeName(rows[i])) return titleCase(rows[i].replace(/[^A-Za-z .]/g, '').trim());
    }
  }
  const candidate = rows.find(looksLikeName);
  return candidate ? titleCase(candidate.replace(/[^A-Za-z .]/g, '').trim()) : undefined;
}

function findGuardian(rows: string[]): string | undefined {
  const row = rows.find((line) => /(father|husband|s\/o|d\/o|w\/o)/i.test(line));
  if (!row) return undefined;
  const after = row.replace(/.*(father'?s? name|husband'?s? name|s\/o|d\/o|w\/o)[:\s]*/i, '').trim();
  return after && looksLikeName(after) ? titleCase(after) : undefined;
}

// --- document number patterns ---------------------------------------------

const PATTERNS = {
  aadhaar: /\b(\d{4}\s?\d{4}\s?\d{4})\b/,
  pan: /\b([A-Z]{5}\d{4}[A-Z])\b/,
  passport: /\b([A-PR-WY][0-9]{7})\b/,
  voter: /\b([A-Z]{3}\d{7})\b/,
  drivingLicence: /\b([A-Z]{2}[-\s]?\d{2}[-\s]?(?:19|20)?\d{2}[-\s]?\d{6,7})\b/,
};

function detectDocType(text: string): IdDocType {
  const upper = text.toUpperCase();
  if (/PERMANENT ACCOUNT NUMBER|INCOME TAX/.test(upper) || PATTERNS.pan.test(upper)) return 'pan';
  if (/PASSPORT|REPUBLIC OF INDIA/.test(upper) || /P<IND/.test(upper)) return 'passport';
  if (/AADHAAR|UNIQUE IDENTIFICATION/.test(upper) || PATTERNS.aadhaar.test(text)) return 'aadhaar';
  if (/ELECTION COMMISSION|ELECTOR|EPIC/.test(upper) || PATTERNS.voter.test(upper)) return 'voter';
  if (/DRIVING LICENCE|DRIVING LICENSE|TRANSPORT/.test(upper)) return 'driving_licence';
  return 'unknown';
}

function parsePassportMrz(rows: string[]): {
  name?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  number?: string;
  expiry?: string;
} | null {
  const mrzLines = rows
    .map((line) => line.replace(/\s/g, '').toUpperCase())
    .filter((line) => line.includes('<<') || /^P<[A-Z]{3}/.test(line));
  if (mrzLines.length === 0) return null;
  // Passports use two 44-char lines; take the last two MRZ-looking rows.
  const candidate = mrzLines.slice(-2);
  try {
    const result = parseMrz(candidate.length === 2 ? candidate : candidate[0]);
    const f = result.fields;
    // MRZ dates are YYMMDD with no century. The century has to be inferred from
    // context: a birth date is in the past (pivot on a sliding window), while an
    // expiry date is always this century — a passport expiring in '45 means 2045,
    // not 1945.
    const mrzDate = (value: string | null | undefined, kind: 'birth' | 'expiry'): string | undefined => {
      if (!value || value.length !== 6) return undefined;
      const yy = Number(value.slice(0, 2));
      const year =
        kind === 'expiry'
          ? 2000 + yy
          : yy > 40
            ? 1900 + yy
            : 2000 + yy;
      return toIso(value.slice(4, 6), value.slice(2, 4), String(year));
    };
    const name = [f.firstName, f.lastName].filter(Boolean).map((n) => titleCase(String(n))).join(' ');
    return {
      name: name || undefined,
      dob: mrzDate(f.birthDate, 'birth'),
      gender: f.sex === 'female' ? 'female' : f.sex === 'male' ? 'male' : undefined,
      number: f.documentNumber ? String(f.documentNumber).replace(/</g, '') : undefined,
      expiry: mrzDate(f.expirationDate, 'expiry'),
    };
  } catch {
    return null;
  }
}

/** The main entry point: OCR result in, structured identity out. */
export function extractIdentity(ocr: OcrResult): ExtractedIdentity {
  const text = ocr.text;
  const rows = lines(text);
  const docType = detectDocType(text);
  const fields: ExtractedIdFields = {};

  if (docType === 'passport') {
    const mrz = parsePassportMrz(rows);
    if (mrz) {
      fields.name = mrz.name;
      fields.dateOfBirth = mrz.dob;
      fields.gender = mrz.gender;
      fields.idNumber = mrz.number;
      fields.dateOfExpiry = mrz.expiry;
    }
    fields.idNumber = fields.idNumber ?? PATTERNS.passport.exec(text.toUpperCase())?.[1];
  }

  // Fill anything MRZ didn't provide (and everything for non-passports).
  fields.name = fields.name ?? findName(rows);
  fields.dateOfBirth = fields.dateOfBirth ?? findDob(text);
  fields.gender = fields.gender ?? findGender(text);
  fields.guardianName = fields.guardianName ?? findGuardian(rows);
  fields.pincode = fields.pincode ?? findPincode(text);

  if (!fields.idNumber) {
    if (docType === 'aadhaar') fields.idNumber = PATTERNS.aadhaar.exec(text)?.[1]?.replace(/\s/g, ' ');
    else if (docType === 'pan') fields.idNumber = PATTERNS.pan.exec(text.toUpperCase())?.[1];
    else if (docType === 'voter') fields.idNumber = PATTERNS.voter.exec(text.toUpperCase())?.[1];
    else if (docType === 'driving_licence')
      fields.idNumber = PATTERNS.drivingLicence.exec(text.toUpperCase())?.[1];
  }

  return {
    docType,
    docTypeLabel: ID_DOC_LABEL[docType],
    idNumberLabel: idNumberLabel(docType),
    fields,
    confidence: Math.round(ocr.confidence),
    rawText: text,
  };
}

function idNumberLabel(docType: IdDocType): string {
  switch (docType) {
    case 'aadhaar':
      return 'Aadhaar number';
    case 'pan':
      return 'PAN';
    case 'passport':
      return 'Passport number';
    case 'voter':
      return 'Voter ID (EPIC) number';
    case 'driving_licence':
      return 'Driving Licence number';
    default:
      return 'ID number';
  }
}
