import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, serverTimestamp, query, where, deleteDoc } from '../lib/db/firestore';
import { useAuthStore } from '../stores/useAuthStore';

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  lastActive: unknown;
  color: string;
  cursor?: { x: number; y: number };
  currentWorkspaceId?: string;
}

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
];

export function useCollaborators() {
  const userProfile = useAuthStore(s => s.userProfile);
  const activeWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  useEffect(() => {
    if (!userProfile || !activeWorkspaceId) return;

    const userDocRef = doc(db, 'presence', userProfile.uid);
    const userColor = COLORS[userProfile.uid.charCodeAt(0) % COLORS.length];

    // Mark current user as active in this workspace
    const updatePresence = async () => {
      try {
        await setDoc(userDocRef, {
          uid: userProfile.uid,
          name: userProfile.displayName || userProfile.email?.split('@')[0] || 'Anonymous',
          email: userProfile.email,
          currentWorkspaceId: activeWorkspaceId,
          lastActive: serverTimestamp(),
          color: userColor
        }, { merge: true });
      } catch (err) {
        console.warn('Presence update deferred:', err);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000); // Pulse every 30s

    // F1: Scoped query by currentWorkspaceId to prevent cross-tenant presence leaking
    const q = query(
      collection(db, 'presence'),
      where('currentWorkspaceId', '==', activeWorkspaceId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const activeThreshold = 60000; // 1 minute
      
      const active = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Collaborator))
        .filter(c => {
          if (!c.lastActive) return true;
          const lastActiveTime = (c.lastActive as { toDate?: () => Date }).toDate?.()?.getTime() || now;
          return now - lastActiveTime < activeThreshold;
        });

      setCollaborators(active);
    }, (err) => {
      console.warn('Presence subscription warning:', err);
    });

    // F29: Properly store handler reference and remove on unmount
    const handleUnload = () => {
      deleteDoc(userDocRef).catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
      deleteDoc(userDocRef).catch(() => {});
    };
  }, [userProfile, activeWorkspaceId]);

  return collaborators;
}
