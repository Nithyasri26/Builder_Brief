/**
 * Government adapter layer.
 *
 * Every public service the product touches sits behind one of these
 * interfaces. Today each one resolves to a Mock* implementation backed by
 * synthetic data. Replacing a mock with an authorised real integration is a
 * change in this folder only — no citizen-facing screen changes.
 */

export interface OfficialSource {
  name: string;
  url: string;
  lastVerified: string;
}

export interface ServiceConnection {
  serviceId: string;
  status: 'connected' | 'unavailable';
  mode: 'demo' | 'live';
  checkedAt: string;
  message: string;
}

export interface GovernmentService {
  readonly id: string;
  readonly name: string;
  /** Always 'demo' in this prototype. */
  readonly mode: 'demo' | 'live';
  readonly officialSource: OfficialSource;
  checkConnection(): Promise<ServiceConnection>;
}

/** Thrown when an adapter cannot serve a request. Surfaced as a retryable UI state. */
export class ServiceUnavailableError extends Error {
  constructor(
    readonly serviceId: string,
    message = 'That service is temporarily unavailable in this prototype.',
  ) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Lets a demo deliberately show the outage path.
 * Set DEMO_FORCE_OUTAGE=epfo (comma separated) to take an adapter offline.
 * Nothing fails at random — a demo must be repeatable.
 */
export function isForcedOffline(serviceId: string): boolean {
  const raw = process.env.DEMO_FORCE_OUTAGE ?? '';
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(serviceId.toLowerCase());
}

let sequence = 0;

/** PF-2026-00123 style reference numbers. */
export function demoReference(prefix: string, start = 123): string {
  sequence += 1;
  const year = new Date().getFullYear();
  const number = String(start + sequence - 1).padStart(5, '0');
  return `${prefix}-${year}-${number}`;
}
