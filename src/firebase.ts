// Data and sign-in entry point. The app now runs on Supabase; this module keeps the old
// Firebase-shaped exports (db, auth, getIdToken, ...) so existing imports keep working.
import { getFirestore } from './lib/db/firestore';
import { getAuth } from './lib/db/auth';

export const db = getFirestore();

export const auth = getAuth();

// Offline mode was a Firestore cache feature; Supabase has no client cache to toggle.
export const goOffline = async () => {
  console.debug('Offline mode is not available; data stays live.');
};

export const goOnline = async () => {
  console.debug('Connected to live data.');
};

/**
 * Get the current user's access token for authenticating with the backend.
 */
export const getIdToken = async () => {
  if (auth.currentUser) {
    return await auth.currentUser.getIdToken();
  }
  return null;
};
