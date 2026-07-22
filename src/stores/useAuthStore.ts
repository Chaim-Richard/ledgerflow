import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Workspace, User as UserProfile } from '../types';

interface AuthState {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentProjectId: string | null;
  
  // Actions
  setUser: (user: FirebaseUser | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspaceId: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  updateGeminiApiKey: (key: string) => Promise<void>;
  
  // Helpers
  getCurrentWorkspace: () => Workspace | undefined;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  userProfile: null,
  workspaces: [],
  currentWorkspaceId: localStorage.getItem('clearbook_current_workspace'),
  currentProjectId: null,

  setUser: (user) => set({ user }),
  setUserProfile: (userProfile) => set({ userProfile }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspaceId: (currentWorkspaceId) => {
    if (currentWorkspaceId) {
      localStorage.setItem('clearbook_current_workspace', currentWorkspaceId);
    } else {
      localStorage.removeItem('clearbook_current_workspace');
    }
    set({ currentWorkspaceId });
  },
  setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
  
  updateGeminiApiKey: async (key: string) => {
    const { user, userProfile } = get();
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        geminiApiKey: key
      });
      if (userProfile) {
        set({ userProfile: { ...userProfile, geminiApiKey: key } });
      } else {
        // We shouldn't really be here without a profile, but if so, we create a skeleton
        set({ 
          userProfile: { 
            uid: user.uid, 
            email: user.email || '', 
            role: 'client', 
            geminiApiKey: key 
          } as UserProfile 
        });
      }
    } catch (error) {
      console.error("Failed to update API key:", error);
      throw error;
    }
  },
  
  getCurrentWorkspace: () => {
    const { workspaces, currentWorkspaceId } = get();
    return workspaces.find(w => w.id === currentWorkspaceId);
  }
}));

if (typeof window !== 'undefined') {
  (window as any)._getMockIdToken = async () => {
    const user = useAuthStore.getState().user;
    if (user && typeof (user as any).getIdToken === 'function') {
      return await (user as any).getIdToken();
    }
    return null;
  };
}
