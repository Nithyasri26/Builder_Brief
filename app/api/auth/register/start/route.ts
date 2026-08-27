import { NextResponse } from 'next/server';
import { z } from 'zod';
import { guard } from '@/lib/api';
import { userStore } from '@/lib/auth/user-store';
import { startOtpChallenge } from '@/lib/auth/otp';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import type { IdDocType, RegisterDraft } from '@/types/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter your date of birth.'),
  gender: z.enum(['male', 'female', 'other']),
  state: z.string().trim().min(2, 'Please choose your state.'),
  city: z.string().trim().min(2, 'Please enter your city or town.'),
  addressLine: z.string().trim().optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'A PIN code is 6 digits.')
    .optional()
    .or(z.literal('')),
  guardianName: z.string().trim().optional(),
  idNumber: z.string().trim().optional(),
  verifiedVia: z
    .enum(['aadhaar', 'pan', 'passport', 'voter', 'driving_licence', 'unknown'])
    .default('unknown'),
  mobile: z.string().trim(),
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z.string(),
});

export async function POST(request: Request) {
  return guard(async () => {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Please check the details you entered.' },
        { status: 400 },
      );
    }

    const mobileDigits = parsed.data.mobile.replace(/\D/g, '').slice(-10);
    if (mobileDigits.length !== 10 || !/^[6-9]/.test(mobileDigits)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }
    const pwdProblem = passwordProblem(parsed.data.password);
    if (pwdProblem) {
      return NextResponse.json({ error: pwdProblem }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();

    const existing = await userStore().findAccount(mobileDigits);
    const existingByEmail = await userStore().findAccount(email);
    if (existing || existingByEmail) {
      return NextResponse.json(
        { error: 'An account already exists with this mobile or email. Please log in instead.' },
        { status: 409 },
      );
    }

    const draft: RegisterDraft = {
      name: parsed.data.name,
      dateOfBirth: parsed.data.dateOfBirth,
      gender: parsed.data.gender,
      state: parsed.data.state,
      city: parsed.data.city,
      addressLine: parsed.data.addressLine || undefined,
      pincode: parsed.data.pincode || undefined,
      guardianName: parsed.data.guardianName || undefined,
      idNumber: parsed.data.idNumber || undefined,
      verifiedVia: parsed.data.verifiedVia as IdDocType,
      mobile: mobileDigits,
      email,
      passwordHash: hashPassword(parsed.data.password),
    };

    const challenge = await startOtpChallenge({
      purpose: 'register',
      mobile: mobileDigits,
      email,
      draft,
    });

    return NextResponse.json(challenge);
  });
}
