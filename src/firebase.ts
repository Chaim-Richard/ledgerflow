import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, disableNetwork, enableNetwork, memoryLocalCache } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

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

export const db = initializeFirestore(app, getCacheConfig(), getDatabaseId());

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
  if (typeof window !== 'undefined' && (window as any)._getMockIdToken) {
    return await (window as any)._getMockIdToken();
  }
  return null;
};

