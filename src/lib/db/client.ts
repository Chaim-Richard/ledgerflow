import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import supabaseConfig from '../../../supabase-config.json';

// The project URL and publishable key are public (like the old Firebase web config).
// A build can point at another project with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
function readEnv(name: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.[name] || undefined;
  } catch {
    return undefined;
  }
}

export const SUPABASE_URL = readEnv('VITE_SUPABASE_URL') || supabaseConfig.url;
export const SUPABASE_PUBLISHABLE_KEY =
  readEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || supabaseConfig.publishableKey;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: typeof window !== 'undefined',
        detectSessionInUrl: typeof window !== 'undefined',
      },
    });
  }
  return client;
}
