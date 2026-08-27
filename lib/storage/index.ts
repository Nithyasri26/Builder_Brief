import { databaseConfig, mongoConfig } from '@/lib/config';

/**
 * Storage abstraction for citizen-uploaded files.
 *
 * The prototype keeps uploads in memory so the whole journey runs with no
 * infrastructure. Supabase Storage is used automatically when configured.
 */

export interface StoredObject {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

export interface StorageProvider {
  readonly id: string;
  put(key: string, object: StoredObject): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  remove(key: string): Promise<void>;
}

const MAX_BYTES = 4 * 1024 * 1024;

export class MemoryStorage implements StorageProvider {
  readonly id = 'memory';

  private get bucket(): Map<string, StoredObject> {
    const store = globalThis as unknown as { __nammasahaayFiles?: Map<string, StoredObject> };
    if (!store.__nammasahaayFiles) store.__nammasahaayFiles = new Map();
    return store.__nammasahaayFiles;
  }

  async put(key: string, object: StoredObject): Promise<void> {
    if (object.bytes.byteLength > MAX_BYTES) {
      throw new Error('File is larger than the 4 MB prototype limit.');
    }
    this.bucket.set(key, object);
  }

  async get(key: string): Promise<StoredObject | null> {
    return this.bucket.get(key) ?? null;
  }

  async remove(key: string): Promise<void> {
    this.bucket.delete(key);
  }
}

const BUCKET = 'citizen-documents';

export class SupabaseStorage implements StorageProvider {
  readonly id = 'supabase';

  private get config() {
    const config = databaseConfig();
    return {
      url: config.url.replace(/\/$/, ''),
      key: config.serviceRoleKey || config.anonKey,
    };
  }

  async put(key: string, object: StoredObject): Promise<void> {
    const { url, key: apiKey } = this.config;
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': object.mimeType,
        'x-upsert': 'true',
      },
      body: object.bytes as unknown as BodyInit,
    });
    if (!res.ok) throw new Error(`Storage upload failed: ${res.status}`);
  }

  async get(key: string): Promise<StoredObject | null> {
    const { url, key: apiKey } = this.config;
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const buffer = new Uint8Array(await res.arrayBuffer());
    return {
      bytes: buffer,
      mimeType: res.headers.get('content-type') ?? 'application/octet-stream',
      fileName: key.split('/').pop() ?? key,
    };
  }

  async remove(key: string): Promise<void> {
    const { url, key: apiKey } = this.config;
    await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    });
  }
}

/**
 * GridFS-free Mongo storage: uploads are capped at 4 MB, comfortably under the
 * 16 MB BSON document limit, so a single binary field is simpler and cheaper
 * than a chunked bucket.
 */
export class MongoStorage implements StorageProvider {
  readonly id = 'mongodb';

  private async collection() {
    const { getUploadsCollection } = await import('./mongo-uploads');
    return getUploadsCollection();
  }

  async put(key: string, object: StoredObject): Promise<void> {
    if (object.bytes.byteLength > MAX_BYTES) {
      throw new Error('File is larger than the 4 MB prototype limit.');
    }
    const uploads = await this.collection();
    await uploads.replaceOne(
      { _id: key },
      {
        fileName: object.fileName,
        mimeType: object.mimeType,
        bytes: Buffer.from(object.bytes),
        uploadedAt: new Date().toISOString(),
      },
      { upsert: true },
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    const uploads = await this.collection();
    const found = await uploads.findOne({ _id: key });
    if (!found) return null;
    return {
      bytes: new Uint8Array(found.bytes.buffer, found.bytes.byteOffset, found.bytes.byteLength),
      mimeType: found.mimeType,
      fileName: found.fileName,
    };
  }

  async remove(key: string): Promise<void> {
    const uploads = await this.collection();
    await uploads.deleteOne({ _id: key });
  }
}

let instance: StorageProvider | null = null;

/** Mirrors the database choice so files and records never live apart. */
export function getStorage(): StorageProvider {
  if (instance) return instance;
  const supabase = databaseConfig();
  if (mongoConfig().uri) {
    instance = new MongoStorage();
  } else if (supabase.url && (supabase.serviceRoleKey || supabase.anonKey)) {
    instance = new SupabaseStorage();
  } else {
    instance = new MemoryStorage();
  }
  return instance;
}
