import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { getRateLimiter } from '@/lib/security/rate-limit';

/** Shared helpers so every route validates, limits and fails the same way. */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError('The request body could not be read.', 400);
  }
  try {
    return schema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError('Some of the information sent was not valid.', 422, {
        issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }
    throw error;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function limit(bucket: 'chat' | 'write', key: string) {
  const result = await getRateLimiter(bucket).check(key);
  if (!result.allowed) {
    throw new ApiError(
      'You are sending requests faster than this prototype allows. Please wait a moment.',
      429,
      { resetInSeconds: result.resetInSeconds },
    );
  }
}

/** Wraps a handler so an unexpected failure never leaks internals to the client. */
export async function guard<T>(handler: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.status, error.extra);
    }
    const status = (error as Error & { status?: number }).status;
    if (status === 404) return fail('Not found.', 404);
    // A configured-but-unreachable or misconfigured database should say so
    // plainly rather than hide behind a generic failure.
    const name = (error as Error).name;
    const message = (error as Error).message ?? '';
    if (name === 'MongoServerError' && /bad auth|authentication failed/i.test(message)) {
      return fail(
        'MongoDB rejected the username or password. Check the credentials in your MONGODB_URI — replace <db_password> with your real password, and percent-encode any special characters (@ : / ? # become %40 %3A %2F %3F %23).',
        503,
      );
    }
    if (name === 'MongoServerSelectionError' || name === 'MongoNetworkError') {
      return fail(
        'The database is not reachable. Check your MONGODB_URI and Atlas Network Access, or remove MONGODB_URI from .env.local to use the in-memory demo store.',
        503,
      );
    }
    console.error('[nammasahaay] request failed:', error);
    return fail('Something went wrong in the prototype. Please try again.', 500);
  }
}
