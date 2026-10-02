import { auth } from '../../firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut 
} from '../../lib/db/auth';
import { AuthAdapter, AuthUser } from '../../services/auth/types';

export class FirebaseAuthAdapter implements AuthAdapter {
  private mapUser(user: import('../../lib/db/auth').User | null): AuthUser | null {
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
  }

  getCurrentUser(): AuthUser | null {
    return this.mapUser(auth.currentUser);
  }

  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    return onAuthStateChanged(auth, (user) => {
      callback(this.mapUser(user));
    });
  }

  async signInWithGoogle(): Promise<AuthUser> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return this.mapUser(result.user)!;
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  async getIdToken(): Promise<string | null> {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  }
}
