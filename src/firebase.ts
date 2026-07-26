import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, disableNetwork, enableNetwork, memoryLocalCache } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with modern persistent cache configuration (replaces deprecated enableMultiTabIndexedDbPersistence)
const getDatabaseId = () => {
  const dbId = firebaseConfig.firestoreDatabaseId;
  return (dbId && dbId !== "(default)") ? dbId : undefined;
};

const isIframe = () => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    return true;
  }
};

const getCacheConfig = () => {
  if (isIframe()) {
    console.log("Firestore: running in iframe workspace preview. Enabling memory cache to prevent sandboxed IndexedDB blockages.");
    return { localCache: memoryLocalCache() };
  }
  
  try {
    return {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    };
  } catch (error) {
    console.warn("Firestore: persistent local cache initialization failed, falling back to memory cache:", error);
    return { localCache: memoryLocalCache() };
  }
};

let firestoreInstance;
const dbId = getDatabaseId();
try {
  firestoreInstance = dbId ? initializeFirestore(app, getCacheConfig(), dbId) : initializeFirestore(app, getCacheConfig());
} catch (e) {
  firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
}

export const db = firestoreInstance;

export const auth = getAuth(app);

export const goOffline = async () => {
  try {
    await disableNetwork(db);
    console.log("Firestore working in offline sandbox mode");
  } catch (error) {
    console.error("Failed to disable Firestore network:", error);
  }
};

export const goOnline = async () => {
  try {
    await enableNetwork(db);
    console.log("Firestore connected to live network");
  } catch (error) {
    console.error("Failed to enable Firestore network:", error);
  }
};

/**
 * Get the current user's ID token for authenticating with the backend.
 */
export const getIdToken = async () => {
  if (auth.currentUser) {
    return await auth.currentUser.getIdToken();
  }
  if (typeof window !== 'undefined' && (window as any)._getInternalIdToken) {
    return await (window as any)._getInternalIdToken();
  }
  return null;
};

