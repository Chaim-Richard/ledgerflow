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
  isAdmin: boolean;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentProjectId: string | null;
  
  // Actions
  setUser: (user: FirebaseUser | null) => void;
  setIsGuest: (val: boolean) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  checkTokenAdminClaim: () => Promise<boolean>;
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
  isAdmin: false,
  workspaces: [],
  currentWorkspaceId: localStorage.getItem('ledgerflow_current_workspace'),
  currentProjectId: null,

  setUser: (user) => {
    set({ user });
    if (user) {
      user.getIdTokenResult().then((res) => {
        const tokenIsAdmin = Boolean(res.claims.admin || res.claims.role === 'admin');
        set({ isAdmin: tokenIsAdmin || get().userProfile?.role === 'admin' });
      }).catch(console.error);
    } else {
      set({ isAdmin: false });
    }
  },
  setIsGuest: (isGuest) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("isGuest", isGuest ? "true" : "false");
    }
    set({ isGuest });
  },
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  checkTokenAdminClaim: async () => {
    const { user, userProfile } = get();
    if (!user) {
      set({ isAdmin: false });
      return false;
    }
    try {
      let res = await user.getIdTokenResult();
      let tokenIsAdmin = Boolean(res.claims.admin || res.claims.role === 'admin');
      if (!tokenIsAdmin && userProfile?.role === 'admin') {
        // Force refresh to grab newly granted custom claim
        await user.getIdToken(true);
        res = await user.getIdTokenResult();
        tokenIsAdmin = Boolean(res.claims.admin || res.claims.role === 'admin');
      }
      const finalIsAdmin = tokenIsAdmin || userProfile?.role === 'admin';
      set({ isAdmin: finalIsAdmin });
      return finalIsAdmin;
    } catch (err) {
      console.warn("Failed to check token admin claim:", err);
      const fallback = userProfile?.role === 'admin';
      set({ isAdmin: fallback });
      return fallback;
    }
  },
  setUserProfile: (userProfile) => {
    set({ userProfile });
    const { user, isAdmin } = get();
    if (userProfile?.role === 'admin' && user && !isAdmin) {
      get().checkTokenAdminClaim().catch(console.error);
    } else if (userProfile) {
      set({ isAdmin: get().isAdmin || userProfile.role === 'admin' });
    }
  },
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

    if (userProfile) {
      set({ userProfile: { ...userProfile, geminiApiKey: key } });
    } else {
      set({ 
        userProfile: { 
          uid: user.uid, 
          email: user.email || '', 
          role: 'client', 
          geminiApiKey: key 
        } as UserProfile 
      });
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
      // Force refresh auth token so custom claims update immediately
      try {
        await user.getIdToken(true);
      } catch (err) {
        console.warn("Could not force-refresh ID token:", err);
      }
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
