import 'server-only';
import type { Database } from './types';
import { MemoryDatabase } from './memory-db';
import { MongoDatabase } from './mongo-db';
import { SupabaseDatabase } from './supabase-db';
import { databaseConfig, mongoConfig } from '@/lib/config';

let instance: Database | null = null;

/**
 * Chooses the persistence implementation once per process.
 *
 *   MONGODB_URI set        -> MongoDB (the primary database for this product)
 *   Supabase vars set      -> Postgres, kept as an alternative adapter
 *   neither                -> the seeded in-memory demo store, so the
 *                             prototype still runs anywhere with zero setup
 *
 * Every implementation satisfies the same Database interface, so nothing else
 * in the application knows or cares which one is active.
 */
export function getDatabase(): Database {
  if (instance) return instance;
  const supabase = databaseConfig();
  if (mongoConfig().uri) {
    instance = new MongoDatabase();
  } else if (supabase.url && (supabase.serviceRoleKey || supabase.anonKey)) {
    instance = new SupabaseDatabase();
  } else {
    instance = new MemoryDatabase();
  }
  return instance;
}

/** Which store is actually serving requests. Used by the About page. */
export function databaseKind(): 'mongodb' | 'supabase' | 'memory' {
  return getDatabase().id as 'mongodb' | 'supabase' | 'memory';
}

export type { Database } from './types';
