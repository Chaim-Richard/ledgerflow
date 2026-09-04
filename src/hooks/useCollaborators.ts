import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, serverTimestamp, query, deleteDoc } from 'firebase/firestore';
import { useAuthStore } from '../stores/useAuthStore';

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  lastActive: any;
  color: string;
  cursor?: { x: number; y: number };
}

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
];

export function useCollaborators() {
  const userProfile = useAuthStore(s => s.userProfile);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  useEffect(() => {
    if (!userProfile) return;

    const userDocRef = doc(db, 'presence', userProfile.uid);
    const userColor = COLORS[userProfile.uid.charCodeAt(0) % COLORS.length];

    // Mark current user as active
    const updatePresence = async () => {
      try {
        await setDoc(userDocRef, {
          uid: userProfile.uid,
          name: userProfile.displayName || userProfile.email?.split('@')[0] || 'Anonymous',
          email: userProfile.email,
          lastActive: serverTimestamp(),
          color: userColor
        }, { merge: true });
      } catch (err) {
        console.warn('Presence update deferred:', err);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000); // Pulse every 30s

    // Listen to all active users
    const q = query(collection(db, 'presence'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const activeThreshold = 60000; // 1 minute
      
      const active = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Collaborator))
        .filter(c => {
          if (!c.lastActive) return true;
          const lastActiveTime = c.lastActive.toDate?.()?.getTime() || now;
          return now - lastActiveTime < activeThreshold;
        });

      setCollaborators(active);
    });

    // Cleanup presence on unmount
    window.addEventListener('beforeunload', () => {
      deleteDoc(userDocRef).catch(() => {});
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
      deleteDoc(userDocRef).catch(() => {});
    };
  }, [userProfile]);

  return collaborators;
}
