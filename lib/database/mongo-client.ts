import 'server-only';
import dns from 'node:dns';
import { MongoClient, type Db, type Document as MongoDocument } from 'mongodb';
import { mongoConfig } from '@/lib/config';

/**
 * A `mongodb+srv://` URI hides the cluster's real hosts behind a DNS SRV record
 * that the driver looks up at connect time. On some Windows machines and home
 * routers the DNS server handed to the process refuses SRV queries, so the
 * driver fails with `querySrv ECONNREFUSED` even though the cluster is reachable.
 * Pointing Node's *default* resolver elsewhere (`dns.setServers`) does not help,
 * because the driver resolves SRV through its own resolver instance.
 *
 * So we do the SRV expansion ourselves against a resolver we explicitly bind to
 * a public DNS server (Google/Cloudflare by default), turning the `+srv` URI
 * into a plain `mongodb://host1,host2,.../` URI. The driver then connects with
 * no SRV lookup of its own. Set MONGODB_DNS_SERVERS (comma-separated) to choose
 * different resolvers.
 */
async function expandSrvUri(uri: string): Promise<string> {
  if (!uri.startsWith('mongodb+srv://')) return uri;

  const resolvers = (process.env.MONGODB_DNS_SERVERS ?? '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const resolver = new dns.promises.Resolver();
  if (resolvers.length > 0) resolver.setServers(resolvers);

  // Split "mongodb+srv://[user:pass@]host[/db][?opts]" into its parts without a
  // URL parser (the credentials may contain characters URL() rejects).
  const rest = uri.slice('mongodb+srv://'.length);
  const slashIdx = rest.indexOf('/');
  const qIdx = rest.indexOf('?');
  const authorityEnd = Math.min(
    slashIdx === -1 ? rest.length : slashIdx,
    qIdx === -1 ? rest.length : qIdx,
  );
  const authority = rest.slice(0, authorityEnd);
  const tail = rest.slice(authorityEnd); // "/db?opts" or "?opts" or ""

  const atIdx = authority.lastIndexOf('@');
  const credentials = atIdx === -1 ? '' : authority.slice(0, atIdx + 1); // "user:pass@" or ""
  const srvHost = atIdx === -1 ? authority : authority.slice(atIdx + 1);

  try {
    const [srvRecords, txtChunks] = await Promise.all([
      resolver.resolveSrv(`_mongodb._tcp.${srvHost}`),
      resolver.resolveTxt(srvHost).catch(() => [] as string[][]),
    ]);
    if (srvRecords.length === 0) {
      throw new Error(`No SRV records found for ${srvHost}`);
    }

    const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(',');
    const txtOptions = txtChunks.map((chunk) => chunk.join('')).join('&');

    // Preserve the URI's own query string; layer the TXT options and the +srv
    // defaults (TLS on) underneath so an explicit user option always wins.
    const existingQuery = tail.includes('?') ? tail.slice(tail.indexOf('?') + 1) : '';
    const pathPart = tail.includes('?') ? tail.slice(0, tail.indexOf('?')) : tail;
    const params = new URLSearchParams();
    params.set('tls', 'true');
    for (const [k, v] of new URLSearchParams(txtOptions)) params.set(k, v);
    for (const [k, v] of new URLSearchParams(existingQuery)) params.set(k, v);

    const path = pathPart || '/';
    const expanded = `mongodb://${credentials}${hosts}${path}?${params.toString()}`;
    console.log(`[mongo] expanded +srv via ${resolvers.join(', ')} -> ${srvRecords.length} host(s)`);
    return expanded;
  } catch (err) {
    // If our own resolution fails (e.g. a serverless host that blocks custom DNS
    // servers but resolves SRV natively just fine), fall back to the original
    // +srv URI and let the driver do the lookup itself.
    console.warn(
      `[mongo] manual SRV expansion failed (${(err as Error).message}); falling back to native +srv resolution`,
    );
    return uri;
  }
}

/**
 * The single MongoDB connection for the whole app.
 *
 * Both the citizen-data store (`mongo-db.ts`) and the auth store
 * (`user-store.ts`) share this one client and pool, rather than each opening
 * its own. The client is cached on `globalThis` so Next.js hot reloads and warm
 * serverless invocations reuse the connection instead of opening a new pool
 * every time.
 */

const globalMongo = globalThis as unknown as { __nammasahaayMongo?: Promise<Db> };

async function connect(): Promise<Db> {
  const config = mongoConfig();
  // A hosted cluster (mongodb+srv://) is found through DNS and may be waking
  // from idle on a free tier, so it gets a longer leash than a local server.
  const isRemote = config.uri.startsWith('mongodb+srv://');
  const uri = await expandSrvUri(config.uri);
  const client = new MongoClient(uri, {
    // One app server, not a fleet — keep the pool small.
    maxPoolSize: 10,
    serverSelectionTimeoutMS: isRemote ? 20000 : 8000,
    connectTimeoutMS: isRemote ? 20000 : 10000,
    retryWrites: true,
  });
  await client.connect();
  const db = client.db(config.dbName);
  await createIndexes(db);
  return db;
}

/** Resolves once the connection is open and indexes are ensured. */
export async function getDb(): Promise<Db> {
  if (globalMongo.__nammasahaayMongo) return globalMongo.__nammasahaayMongo;
  // Cache the promise so hot reloads and concurrent callers share one pool. If
  // the first attempt fails, drop the cache so the next request can retry rather
  // than being stuck with a permanently rejected promise.
  const pending = connect();
  globalMongo.__nammasahaayMongo = pending;
  pending.catch(() => {
    if (globalMongo.__nammasahaayMongo === pending) globalMongo.__nammasahaayMongo = undefined;
  });
  return pending;
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
