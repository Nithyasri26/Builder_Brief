import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authConfig } from '@/lib/config';
import type { SessionPayload } from '@/types/auth';
import { SESSION_COOKIE } from './cookie';

export { SESSION_COOKIE };

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function sign(payloadB64: string): string {
  return b64url(createHmac('sha256', authConfig().secret).update(payloadB64).digest());
}

/** Serialises + signs a session payload into a compact cookie token. */
export function encodeSession(userId: string): string {
  const { sessionDays } = authConfig();
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + sessionDays * 24 * 60 * 60,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Verifies a token's signature + expiry and returns the userId, or null. */
export function decodeSession(token: string | undefined): string | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(payloadB64).toString('utf8')) as SessionPayload;
    if (!payload.userId || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

/** Writes the session cookie. Call from a route handler / server action. */
export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: authConfig().sessionDays * 24 * 60 * 60,
  });
}

/** Clears the session cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Reads the signed-in userId from the request cookies, or null if none/invalid. */
export async function readSessionUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    return decodeSession(store.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}
