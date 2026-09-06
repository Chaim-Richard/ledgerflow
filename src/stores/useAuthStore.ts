import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Workspace, User as UserProfile } from '../types';
import { useLedgerStore } from './useLedgerStore';
import { useSavedViewsStore } from './useSavedViewsStore';

interface AuthState {
  user: FirebaseUser | null;
  isGuest: boolean;
  userProfile: UserProfile | null;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentProjectId: string | null;
  
  // Actions
  setUser: (user: FirebaseUser | null) => void;
  setIsGuest: (val: boolean) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspaceId: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  updateGeminiApiKey: (key: string) => Promise<void>;
  updateUserRole: (role: 'admin' | 'client') => Promise<void>;
  
  // Helpers
  getCurrentWorkspace: () => Workspace | undefined;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isGuest: typeof localStorage !== "undefined" ? localStorage.getItem("isGuest") === "true" : false,
  userProfile: null,
  workspaces: [],
  currentWorkspaceId: localStorage.getItem('ledgerflow_current_workspace'),
  currentProjectId: null,

  setUser: (user) => set({ user }),
  setIsGuest: (isGuest) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("isGuest", isGuest ? "true" : "false");
    }
    set({ isGuest });
  },
  setUserProfile: (userProfile) => set({ userProfile }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspaceId: (currentWorkspaceId) => {
    if (currentWorkspaceId) {
      localStorage.setItem('ledgerflow_current_workspace', currentWorkspaceId);
    } else {
      localStorage.removeItem('ledgerflow_current_workspace');
    }
    
    // Clear ledger store data immediately to prevent ghosting between workspaces
    if (get().currentWorkspaceId !== currentWorkspaceId) {
      useLedgerStore.getState().resetStore();
      useSavedViewsStore.getState().loadViewsForWorkspace(currentWorkspaceId);
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

  updateUserRole: async (role: 'admin' | 'client') => {
    const { user, userProfile } = get();
    if (!user) {
      if (userProfile) {
        set({ userProfile: { ...userProfile, role } });
      }
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { role });
      if (userProfile) {
        set({ userProfile: { ...userProfile, role } });
      } else {
        set({ 
          userProfile: { 
            uid: user.uid, 
            email: user.email || '', 
            role 
          } as UserProfile 
        });
      }
    } catch (error) {
      console.error("Failed to update user role:", error);
      throw error;
    }
  },
  
  getCurrentWorkspace: () => {
    const { workspaces, currentWorkspaceId } = get();
    return workspaces.find(w => w.id === currentWorkspaceId);
  }
}));
