/**
 * Rate limiting abstraction.
 *
 * The prototype uses an in-process fixed window, which is enough to stop a
 * runaway client from spending model tokens. A production deployment swaps in
 * a shared store (Redis, Upstash) behind the same interface.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

interface Window {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.limit - 1, resetInSeconds: this.windowMs / 1000 };
    }
    existing.count += 1;
    const remaining = Math.max(0, this.limit - existing.count);
    return {
      allowed: existing.count <= this.limit,
      remaining,
      resetInSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
}

const globalLimiters = globalThis as unknown as {
  __nammasahaayLimiters?: Record<string, RateLimiter>;
};

if (!globalLimiters.__nammasahaayLimiters) {
  globalLimiters.__nammasahaayLimiters = {
    // Chat is the only route that can reach a paid model.
    chat: new InMemoryRateLimiter(30, 60_000),
    write: new InMemoryRateLimiter(60, 60_000),
  };
}

export function getRateLimiter(name: 'chat' | 'write'): RateLimiter {
  return globalLimiters.__nammasahaayLimiters![name];
}
