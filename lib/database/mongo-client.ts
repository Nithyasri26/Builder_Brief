import 'server-only';
import { MongoClient, type Db, type Document as MongoDocument } from 'mongodb';
import { mongoConfig } from '@/lib/config';

/**
 * The single MongoDB connection for the whole app.
 *
 * Both the citizen-data store (`mongo-db.ts`) and the auth store
 * (`user-store.ts`) share this one client and pool, rather than each opening
 * its own. The client is cached on `globalThis` so Next.js hot reloads and warm
 * serverless invocations reuse the connection instead of opening a new pool
 * every time.
 */

interface MongoState {
  client: MongoClient;
  db: Db;
  ready: Promise<void>;
}

const globalMongo = globalThis as unknown as { __nammasahaayMongo?: MongoState };

export function getMongoState(): MongoState {
  if (globalMongo.__nammasahaayMongo) return globalMongo.__nammasahaayMongo;

  const config = mongoConfig();
  // A hosted cluster (mongodb+srv://) is found through DNS and may be waking
  // from idle on a free tier, so it gets a longer leash than a local server.
  const isRemote = config.uri.startsWith('mongodb+srv://');
  const client = new MongoClient(config.uri, {
    // One app server, not a fleet — keep the pool small.
    maxPoolSize: 10,
    serverSelectionTimeoutMS: isRemote ? 20000 : 8000,
    connectTimeoutMS: isRemote ? 20000 : 10000,
    retryWrites: true,
  });
  const db = client.db(config.dbName);
  const state: MongoState = {
    client,
    db,
    ready: client.connect().then(() => createIndexes(db)),
  };
  globalMongo.__nammasahaayMongo = state;
  return state;
}

/** Resolves once the connection is open and indexes are ensured. */
export async function getDb(): Promise<Db> {
  const state = getMongoState();
  await state.ready;
  return state.db;
}

/**
 * Every index the app relies on, in one place: the citizen-data reads
 * ("this citizen's records, newest first") and the auth lookups.
 */
async function createIndexes(db: Db): Promise<void> {
  const ensure = async (name: string, spec: MongoDocument, options?: MongoDocument) => {
    try {
      await db.collection(name).createIndex(spec as never, options as never);
    } catch {
      // An index that already exists in a different form must not stop startup.
    }
  };

  // Citizen data
  await ensure('conversations', { userId: 1, updatedAt: -1 });
  await ensure('messages', { conversationId: 1, createdAt: 1 });
  await ensure('documents', { userId: 1, addedAt: -1 });
  await ensure('documents', { userId: 1, purposes: 1 });
  await ensure('digilocker_documents', { userId: 1 });
  await ensure('tasks', { userId: 1, updatedAt: -1 });
  await ensure('tasks', { userId: 1, status: 1 });
  await ensure('complaints', { userId: 1, createdAt: -1 });
  await ensure('notifications', { userId: 1, createdAt: -1 });
  await ensure('downloads', { userId: 1, createdAt: -1 });
  await ensure('train_searches', { userId: 1, createdAt: -1 });
  await ensure('emails', { userId: 1, createdAt: -1 });
  await ensure('audit_events', { userId: 1, timestamp: -1 });

  // Auth
  await ensure('user_accounts', { mobile: 1 }, { unique: true });
  await ensure('user_accounts', { email: 1 }, { unique: true });
  await ensure('otp_challenges', { expiresAt: 1 });
}
