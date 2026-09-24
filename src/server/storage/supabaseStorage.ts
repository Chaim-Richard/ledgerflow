/**
 * File storage on Supabase Storage (replaces firebase-admin's storage()).
 * Used by the workspace purge to delete a workspace's files. Needs SUPABASE_SERVICE_ROLE_KEY
 * (server only); the bucket is SUPABASE_STORAGE_BUCKET (default "workspace-files").
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl } from '../auth/supabaseAuth';

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('File storage is not configured (SUPABASE_SERVICE_ROLE_KEY is not set)');
    this.name = 'StorageNotConfiguredError';
  }
}

let adminClient: SupabaseClient | null = null;

function storageClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new StorageNotConfiguredError();
  if (!adminClient) {
    adminClient = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return adminClient;
}

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'workspace-files';
}

async function listFiles(client: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const folders = [prefix.replace(/\/+$/, '')];
  while (folders.length > 0) {
    const folder = folders.pop() as string;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.storage.from(bucket).list(folder, { limit: 1000, offset });
      if (error) {
        if (/not found/i.test(error.message)) return files;
        throw error;
      }
      for (const entry of data || []) {
        const path = `${folder}/${entry.name}`;
        // Folders come back without an id.
        if (entry.id) files.push(path); else folders.push(path);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return files;
}

/** Deletes every file under the prefix. Returns how many were deleted. */
export async function deleteFilesWithPrefix(prefix: string): Promise<number> {
  const client = storageClient();
  const bucket = storageBucket();
  const files = await listFiles(client, bucket, prefix);
  for (let i = 0; i < files.length; i += 1000) {
    const { error } = await client.storage.from(bucket).remove(files.slice(i, i + 1000));
    if (error) throw error;
  }
  return files.length;
}
