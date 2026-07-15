import { FirebaseAuthAdapter } from './FirebaseAuthAdapter';
import { AuthAdapter } from './types';

// Singleton instance
// Easily swappable for SupabaseAuthAdapter, etc.
export const authService: AuthAdapter = new FirebaseAuthAdapter();

export * from './types';
