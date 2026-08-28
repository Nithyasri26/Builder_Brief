import 'server-only';
import { createHmac, randomInt } from 'node:crypto';
import { authConfig, DEMO_MODE } from '@/lib/config';
import { getEmailProvider } from '@/lib/email';
import { id as newId, nowIso } from '@/lib/utils';
import { userStore } from './user-store';
import type {
  OtpChallenge,
  OtpChannel,
  OtpPurpose,
  OtpStartResponse,
  RegisterDraft,
} from '@/types/auth';

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCode(code: string, destination: string): string {
  return createHmac('sha256', authConfig().secret).update(`${destination}:${code}`).digest('hex');
}

export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ·····${digits.slice(-4)}` : mobile;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const head = user.slice(0, 2);
  return `${head}${'·'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

interface StartArgs {
  purpose: OtpPurpose;
  mobile?: string;
  email?: string;
  draft?: RegisterDraft;
  accountId?: string;
}

/**
 * Creates an OTP challenge, delivers a code to each channel, and returns what
 * the browser needs to render the verify step. In demo mode the codes are
 * returned so the practice app can show them; in a real deployment they never
 * leave the server.
 */
export async function startOtpChallenge(args: StartArgs): Promise<OtpStartResponse> {
  const now = Date.now();
  const challenge: OtpChallenge = {
    id: newId('otp'),
    purpose: args.purpose,
    createdAt: nowIso(),
    expiresAt: new Date(now + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
    attempts: 0,
    channels: {},
    draft: args.draft,
    accountId: args.accountId,
  };

  const channels: OtpChannel[] = [];
  const demoCodes: Partial<Record<OtpChannel, string>> = {};

  if (args.mobile) {
    const digits = args.mobile.replace(/\D/g, '').slice(-10);
    const code = generateCode();
    challenge.channels.mobile = { destination: digits, codeHash: hashCode(code, digits), verified: false };
    channels.push('mobile');
    demoCodes.mobile = code;
    // No SMS gateway is configured in the prototype; the code is surfaced to
    // the demo UI instead. A real deployment plugs an SMS provider in here.
    console.info(`[otp] mobile ${maskMobile(digits)} → ${DEMO_MODE ? code : '******'}`);
  }

  if (args.email) {
    const email = args.email.trim().toLowerCase();
    const code = generateCode();
    challenge.channels.email = { destination: email, codeHash: hashCode(code, email), verified: false };
    channels.push('email');
    demoCodes.email = code;
    try {
      await getEmailProvider().send({
        to: email,
        subject: 'Your NammaSahaay verification code',
        body: `Your verification code is ${code}. It is valid for ${OTP_TTL_MINUTES} minutes.\n\nThis is a practice app — never share real OTPs with anyone.`,
      });
    } catch {
      // Delivery is best-effort in the prototype; the demo code still works.
    }
  }

  await userStore().saveChallenge(challenge);

  return {
    challengeId: challenge.id,
    channels,
    maskedMobile: challenge.channels.mobile ? maskMobile(challenge.channels.mobile.destination) : undefined,
    maskedEmail: challenge.channels.email ? maskEmail(challenge.channels.email.destination) : undefined,
    demoCodes: DEMO_MODE ? demoCodes : undefined,
  };
}

export type VerifyResult =
  | { ok: true; challenge: OtpChallenge }
  | { ok: false; error: string };

/**
 * Checks the supplied codes against a challenge. Every channel that was issued
 * a code must be verified before the challenge passes.
 */
export async function verifyOtpChallenge(
  challengeId: string,
  codes: Partial<Record<OtpChannel, string>>,
): Promise<VerifyResult> {
  const store = userStore();
  const challenge = await store.getChallenge(challengeId);
  if (!challenge) return { ok: false, error: 'This verification has expired. Please start again.' };
  if (Date.parse(challenge.expiresAt) < Date.now()) {
    await store.deleteChallenge(challengeId);
    return { ok: false, error: 'The code has expired. Please request a new one.' };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    await store.deleteChallenge(challengeId);
    return { ok: false, error: 'Too many attempts. Please start again.' };
  }

  const channels = challenge.channels;
  const next = { ...channels };
  for (const channel of Object.keys(channels) as OtpChannel[]) {
    const state = channels[channel];
    if (!state || state.verified) continue;
    const code = (codes[channel] ?? '').replace(/\D/g, '');
    if (!code) continue;
    if (hashCode(code, state.destination) === state.codeHash) {
      next[channel] = { ...state, verified: true };
    }
  }

  const channelKeys = Object.keys(next) as OtpChannel[];
  // A challenge with no channels must never count as "all verified" — an empty
  // `.every(...)` is vacuously true, which would let it pass with nothing checked.
  const allVerified = channelKeys.length > 0 && channelKeys.every((c) => next[c]?.verified);
  const updated = await store.updateChallenge(challengeId, {
    channels: next,
    attempts: challenge.attempts + 1,
  });

  if (!updated) return { ok: false, error: 'This verification has expired. Please start again.' };
  if (!allVerified) {
    return { ok: false, error: 'That code was not correct. Please check and try again.' };
  }
  return { ok: true, challenge: updated };
}
