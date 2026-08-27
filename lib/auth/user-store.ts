import 'server-only';
import { type Db } from 'mongodb';
import { mongoConfig } from '@/lib/config';
import { getDb } from '@/lib/database/mongo-client';
import type { OtpChallenge, UserAccount } from '@/types/auth';

/**
 * Storage for authentication identity — accounts and OTP challenges.
 *
 * This is deliberately SEPARATE from the citizen-data `Database` interface:
 * accounts are cross-cutting auth infrastructure, not per-citizen records. It
 * uses the same backend selection rule as the rest of the app:
 *   MONGODB_URI set  -> MongoDB (persistent, multi-user)
 *   otherwise        -> in-memory (fine for local dev; resets on restart)
 */
export interface UserStore {
  createAccount(account: UserAccount): Promise<UserAccount>;
  getAccount(id: string): Promise<UserAccount | null>;
  findAccount(mobileOrEmail: string): Promise<UserAccount | null>;
  updateAccount(id: string, patch: Partial<UserAccount>): Promise<UserAccount | null>;
  saveChallenge(challenge: OtpChallenge): Promise<void>;
  getChallenge(id: string): Promise<OtpChallenge | null>;
  updateChallenge(id: string, patch: Partial<OtpChallenge>): Promise<OtpChallenge | null>;
  deleteChallenge(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Mongo backend
// ---------------------------------------------------------------------------

class MongoUserStore implements UserStore {
  // Shares the one app-wide connection; indexes are created centrally in
  // mongo-client.ts.
  private db(): Promise<Db> {
    return getDb();
  }

  async createAccount(account: UserAccount): Promise<UserAccount> {
    const db = await this.db();
    await db
      .collection('user_accounts')
      .insertOne({ ...account, _id: account.id } as unknown as Record<string, unknown>);
    return account;
  }

  async getAccount(id: string): Promise<UserAccount | null> {
    const db = await this.db();
    const row = await db.collection('user_accounts').findOne({ _id: id as unknown as never });
    return row ? strip<UserAccount>(row) : null;
  }

  async findAccount(mobileOrEmail: string): Promise<UserAccount | null> {
    const db = await this.db();
    const value = mobileOrEmail.trim().toLowerCase();
    const digits = mobileOrEmail.replace(/\D/g, '').slice(-10);
    const row = await db
      .collection('user_accounts')
      .findOne({ $or: [{ email: value }, { mobile: digits }] });
    return row ? strip<UserAccount>(row) : null;
  }

  async updateAccount(id: string, patch: Partial<UserAccount>): Promise<UserAccount | null> {
    const db = await this.db();
    const row = await db
      .collection('user_accounts')
      .findOneAndUpdate(
        { _id: id as unknown as never },
        { $set: patch as Record<string, unknown> },
        { returnDocument: 'after' },
      );
    return row ? strip<UserAccount>(row) : null;
  }

  async saveChallenge(challenge: OtpChallenge): Promise<void> {
    const db = await this.db();
    await db
      .collection('otp_challenges')
      .replaceOne(
        { _id: challenge.id as unknown as never },
        { ...challenge, _id: challenge.id } as unknown as Record<string, unknown>,
        { upsert: true },
      );
  }

  async getChallenge(id: string): Promise<OtpChallenge | null> {
    const db = await this.db();
    const row = await db.collection('otp_challenges').findOne({ _id: id as unknown as never });
    return row ? strip<OtpChallenge>(row) : null;
  }

  async updateChallenge(id: string, patch: Partial<OtpChallenge>): Promise<OtpChallenge | null> {
    const db = await this.db();
    const row = await db
      .collection('otp_challenges')
      .findOneAndUpdate(
        { _id: id as unknown as never },
        { $set: patch as Record<string, unknown> },
        { returnDocument: 'after' },
      );
    return row ? strip<OtpChallenge>(row) : null;
  }

  async deleteChallenge(id: string): Promise<void> {
    const db = await this.db();
    await db.collection('otp_challenges').deleteOne({ _id: id as unknown as never });
  }
}

function strip<T>(row: Record<string, unknown>): T {
  const { _id: _ignored, ...rest } = row;
  return rest as T;
}

// ---------------------------------------------------------------------------
// In-memory backend (dev / no-Mongo)
// ---------------------------------------------------------------------------

const globalAuthMem = globalThis as unknown as {
  __nammasahaayAuthMem?: { accounts: Map<string, UserAccount>; challenges: Map<string, OtpChallenge> };
};

function mem() {
  if (!globalAuthMem.__nammasahaayAuthMem) {
    globalAuthMem.__nammasahaayAuthMem = { accounts: new Map(), challenges: new Map() };
  }
  return globalAuthMem.__nammasahaayAuthMem;
}

class MemoryUserStore implements UserStore {
  async createAccount(account: UserAccount): Promise<UserAccount> {
    mem().accounts.set(account.id, account);
    return account;
  }
  async getAccount(id: string): Promise<UserAccount | null> {
    return mem().accounts.get(id) ?? null;
  }
  async findAccount(mobileOrEmail: string): Promise<UserAccount | null> {
    const email = mobileOrEmail.trim().toLowerCase();
    const digits = mobileOrEmail.replace(/\D/g, '').slice(-10);
    for (const account of mem().accounts.values()) {
      if (account.email === email || account.mobile === digits) return account;
    }
    return null;
  }
  async updateAccount(id: string, patch: Partial<UserAccount>): Promise<UserAccount | null> {
    const current = mem().accounts.get(id);
    if (!current) return null;
    const next = { ...current, ...patch, id };
    mem().accounts.set(id, next);
    return next;
  }
  async saveChallenge(challenge: OtpChallenge): Promise<void> {
    mem().challenges.set(challenge.id, challenge);
  }
  async getChallenge(id: string): Promise<OtpChallenge | null> {
    return mem().challenges.get(id) ?? null;
  }
  async updateChallenge(id: string, patch: Partial<OtpChallenge>): Promise<OtpChallenge | null> {
    const current = mem().challenges.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    mem().challenges.set(id, next);
    return next;
  }
  async deleteChallenge(id: string): Promise<void> {
    mem().challenges.delete(id);
  }
}

let instance: UserStore | null = null;

/** The active auth store, chosen once per process. */
export function userStore(): UserStore {
  if (instance) return instance;
  instance = mongoConfig().uri ? new MongoUserStore() : new MemoryUserStore();
  return instance;
}
