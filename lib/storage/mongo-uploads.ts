import { MongoClient, type Collection } from 'mongodb';
import { mongoConfig } from '@/lib/config';

/**
 * The uploads collection lives in its own module so the storage layer can be
 * imported by client-safe code paths without pulling in the driver.
 */
export interface UploadDocument {
  _id: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  uploadedAt: string;
}

const globalUploads = globalThis as unknown as {
  __nammasahaayUploads?: Promise<Collection<UploadDocument>>;
};

export function getUploadsCollection(): Promise<Collection<UploadDocument>> {
  if (!globalUploads.__nammasahaayUploads) {
    const config = mongoConfig();
    const client = new MongoClient(config.uri, { maxPoolSize: 5 });
    globalUploads.__nammasahaayUploads = client
      .connect()
      .then((connected) => connected.db(config.dbName).collection<UploadDocument>('uploads'));
  }
  return globalUploads.__nammasahaayUploads;
}
