import 'server-only';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing with scrypt (built into Node — no external dependency).
 * Stored form: `scrypt$<salt-hex>$<hash-hex>`. The plaintext password is never
 * stored anywhere.
 */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Minimum rules for a new password. Returns an error message, or null if ok. */
export function passwordProblem(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Please choose a password of at least 8 characters.';
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Please use a mix of letters and numbers.';
  }
  return null;
}
