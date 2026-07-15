export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthAdapter {
  getCurrentUser(): AuthUser | null;
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void;
  signInWithGoogle(): Promise<AuthUser>;
  signOut(): Promise<void>;
  getIdToken(): Promise<string | null>;
}
