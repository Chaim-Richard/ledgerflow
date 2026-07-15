import { FirebaseAdapter } from './FirebaseAdapter';
import { DatabaseAdapter } from './types';

// We export a singleton instance of the chosen adapter.
// To switch to Supabase or another DB in the future, simply change this instantiation:
// export const storage: DatabaseAdapter = new SupabaseAdapter();

export const storage: DatabaseAdapter = new FirebaseAdapter();

export * from './types';
