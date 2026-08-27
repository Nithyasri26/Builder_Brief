/**
 * Central runtime configuration.
 *
 * Secrets are read on the server only. The single public flag exposed to the
 * browser is the demo-mode indicator, which drives the DEMO MODE badge.
 */

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

export const PRODUCT = {
  name: 'NammaSahaay AI',
  tagline: 'One place for every service',
  subline: 'Tell it what you need, in your own words.',
} as const;

export const DEMO_NOTICE = 'Practice app — nothing is sent to a real government office.';

export const DEMO_LONG_NOTICE =
  'This is a practice app. The person, the papers and the connections in it are all samples. No real government account, Aadhaar, PAN, UAN, payment or OTP is used, and nothing you do here reaches a government office.';

export const VERIFY_NOTICE = 'Sample information — check the official service before you rely on it.';

/** Server-only AI configuration. Never import this from a client component. */
export function aiConfig() {
  return {
    provider: (process.env.AI_PROVIDER ?? 'gemini').toLowerCase(),
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? '',
      model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    },
    local: {
      baseUrl: process.env.LOCAL_MODEL_BASE_URL ?? '',
      model: process.env.LOCAL_MODEL_NAME ?? '',
    },
  };
}

/** Primary persistence for the prototype. */
export function mongoConfig() {
  return {
    uri: process.env.MONGODB_URI ?? '',
    dbName: process.env.MONGODB_DB ?? 'nammasahaay',
  };
}

export function databaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  };
}

export function emailConfig() {
  return {
    apiKey: process.env.EMAIL_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'NammaSahaay Demo <demo@example.com>',
  };
}

/**
 * Server-only auth configuration. The secret signs the session cookie; in a
 * real deployment it MUST be set. The dev fallback keeps the prototype runnable
 * out of the box but is not safe for anything public.
 */
export function authConfig() {
  const secret = process.env.AUTH_SECRET ?? '';
  return {
    secret: secret || 'nammasahaay-dev-secret-change-me',
    isSecretSet: Boolean(secret),
    sessionDays: 30,
  };
}
