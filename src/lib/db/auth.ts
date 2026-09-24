/**
 * Firebase-Auth-compatible sign-in layer on Supabase Auth (browser).
 *
 * Keeps the calls the app already makes: onAuthStateChanged, signInWithEmailAndPassword,
 * createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut,
 * signInWithPopup(GoogleAuthProvider), multiFactor(user) + TotpMultiFactorGenerator, and a
 * `User` with uid / email / getIdToken() / getIdTokenResult().
 *
 * Admin status comes from app_metadata (only the server can set it), exposed as
 * claims.admin / claims.role like Firebase custom claims.
 */
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { getSupabase } from './client';

export interface UserInfo {
  providerId: string;
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface IdTokenResult {
  token: string;
  claims: Record<string, unknown>;
  expirationTime: string;
  issuedAtTime: string;
  signInProvider: string | null;
}

export interface User extends UserInfo {
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: string | null;
  providerData: UserInfo[];
  metadata: { creationTime?: string; lastSignInTime?: string };
  getIdToken(forceRefresh?: boolean): Promise<string>;
  getIdTokenResult(forceRefresh?: boolean): Promise<IdTokenResult>;
  reload(): Promise<void>;
}

export interface UserCredential { user: User }

export class AuthError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'FirebaseError';
  }
}

function fail(error: { message: string; code?: string; status?: number } | null, fallbackCode: string): never {
  throw new AuthError(`auth/${error?.code || fallbackCode}`, error?.message || 'Sign-in failed');
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    const json = typeof atob === 'function'
      ? atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      : Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return {};
  }
}

async function currentAccessToken(forceRefresh = false): Promise<string> {
  const supabase = getSupabase();
  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) fail(error, 'token-refresh-failed');
    return data.session.access_token;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new AuthError('auth/no-current-user', 'Not signed in');
  return data.session.access_token;
}

function toUser(u: SupabaseUser): User {
  const meta = (u.user_metadata || {}) as Record<string, string | undefined>;
  const displayName = meta.full_name || meta.name || null;
  const photoURL = meta.avatar_url || meta.picture || null;
  const provider = (u.app_metadata?.provider as string | undefined) || 'email';
  const providerData: UserInfo[] = (u.identities || []).map(identity => ({
    providerId: identity.provider === 'email' ? 'password' : `${identity.provider}.com`,
    uid: identity.id,
    displayName,
    email: (identity.identity_data?.email as string | undefined) || u.email || null,
    photoURL,
  }));
  return {
    providerId: 'supabase',
    uid: u.id,
    email: u.email || null,
    displayName,
    photoURL,
    emailVerified: Boolean(u.email_confirmed_at),
    isAnonymous: Boolean(u.is_anonymous),
    tenantId: null,
    providerData,
    metadata: { creationTime: u.created_at, lastSignInTime: u.last_sign_in_at },
    getIdToken: (forceRefresh?: boolean) => currentAccessToken(forceRefresh),
    async getIdTokenResult(forceRefresh?: boolean): Promise<IdTokenResult> {
      const token = await currentAccessToken(forceRefresh);
      const payload = decodeJwt(token);
      const appMeta = (payload.app_metadata || {}) as Record<string, unknown>;
      const claims: Record<string, unknown> = {
        ...payload,
        admin: appMeta.admin === true,
        role: appMeta.role === 'admin' ? 'admin' : payload.role,
      };
      const exp = typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : '';
      const iat = typeof payload.iat === 'number' ? new Date(payload.iat * 1000).toISOString() : '';
      return { token, claims, expirationTime: exp, issuedAtTime: iat, signInProvider: provider };
    },
    async reload() {
      await getSupabase().auth.refreshSession();
    },
  };
}

// ---------------------------------------------------------------------------
// Auth object
// ---------------------------------------------------------------------------

type Listener = (user: User | null) => void;

export class Auth {
  currentUser: User | null = null;
  private listeners = new Set<Listener>();
  private ready = false;
  private started = false;

  private start() {
    if (this.started) return;
    this.started = true;
    const supabase = getSupabase();
    const apply = (session: Session | null) => {
      this.currentUser = session?.user ? toUser(session.user) : null;
      this.ready = true;
      this.listeners.forEach(l => l(this.currentUser));
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      apply(session);
    });
  }

  onAuthStateChanged(listener: Listener): () => void {
    this.start();
    this.listeners.add(listener);
    if (this.ready) listener(this.currentUser);
    return () => { this.listeners.delete(listener); };
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabase().auth.signOut();
    if (error) fail(error, 'sign-out-failed');
  }
}

let defaultAuth: Auth | null = null;
export function getAuth(): Auth {
  if (!defaultAuth) defaultAuth = new Auth();
  return defaultAuth;
}

export function onAuthStateChanged(auth: Auth, listener: Listener): () => void {
  return auth.onAuthStateChanged(listener);
}

export function signOut(auth: Auth): Promise<void> {
  return auth.signOut();
}

export async function signInWithEmailAndPassword(_auth: Auth, email: string, password: string): Promise<UserCredential> {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error || !data.user) fail(error, 'invalid-credential');
  return { user: toUser(data.user) };
}

export async function createUserWithEmailAndPassword(_auth: Auth, email: string, password: string): Promise<UserCredential> {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { data, error } = await getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
  if (error || !data.user) fail(error, 'signup-failed');
  return { user: toUser(data.user) };
}

/** Supabase already sends the confirmation email on sign-up; this re-sends it. */
export async function sendEmailVerification(user: User): Promise<void> {
  if (!user.email || user.emailVerified) return;
  const { error } = await getSupabase().auth.resend({ type: 'signup', email: user.email });
  // Re-sending right after sign-up is rate limited; the first email is already on its way.
  if (error && !/rate limit|seconds/i.test(error.message)) fail(error, 'verification-failed');
}

export async function sendPasswordResetEmail(_auth: Auth, email: string): Promise<void> {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) fail(error, 'reset-failed');
}

export class GoogleAuthProvider {
  readonly providerId = 'google.com';
  private scopes: string[] = [];
  addScope(scope: string): GoogleAuthProvider { this.scopes.push(scope); return this; }
  get scopeString(): string { return this.scopes.join(' '); }
}

/**
 * Google sign-in. Supabase uses a full-page redirect instead of a popup: the browser
 * leaves and comes back signed in, and onAuthStateChanged fires then.
 */
export async function signInWithPopup(_auth: Auth, provider: GoogleAuthProvider): Promise<UserCredential> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      scopes: provider.scopeString || undefined,
    },
  });
  if (error) fail(error, 'popup-closed-by-user');
  // The page is navigating away; this promise never needs to resolve.
  return new Promise<UserCredential>(() => {});
}

// ---------------------------------------------------------------------------
// Two-step sign-in (authenticator app / TOTP)
// ---------------------------------------------------------------------------

export interface TotpSecret {
  readonly secretKey: string;
  readonly factorId: string;
  readonly qrCodeSvg: string;
  generateQrCodeUrl(accountName?: string, issuer?: string): string;
}

export interface MultiFactorAssertion { readonly factorId: string; readonly code: string }

export const TotpMultiFactorGenerator = {
  FACTOR_ID: 'totp',
  async generateSecret(_session: unknown): Promise<TotpSecret> {
    const { data, error } = await getSupabase().auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
    });
    if (error || !data) fail(error, 'mfa-enroll-failed');
    const totp = (data as { id: string; totp: { secret: string; uri: string; qr_code: string } });
    return {
      secretKey: totp.totp.secret,
      factorId: totp.id,
      qrCodeSvg: totp.totp.qr_code,
      generateQrCodeUrl: () => totp.totp.uri,
    };
  },
  assertionForEnrollment(secret: TotpSecret, code: string): MultiFactorAssertion {
    return { factorId: secret.factorId, code };
  },
  assertionForSignIn(factorId: string, code: string): MultiFactorAssertion {
    return { factorId, code };
  },
};

export function multiFactor(_user: User) {
  return {
    async getSession(): Promise<null> {
      return null;
    },
    async enroll(assertion: MultiFactorAssertion, _displayName?: string): Promise<void> {
      const supabase = getSupabase();
      const challenge = await supabase.auth.mfa.challenge({ factorId: assertion.factorId });
      if (challenge.error || !challenge.data) fail(challenge.error, 'mfa-challenge-failed');
      const verify = await supabase.auth.mfa.verify({
        factorId: assertion.factorId,
        challengeId: challenge.data.id,
        code: assertion.code,
      });
      if (verify.error) fail(verify.error, 'invalid-verification-code');
    },
    async getEnrolledFactors() {
      const { data } = await getSupabase().auth.mfa.listFactors();
      return (data?.totp || []).filter(f => f.status === 'verified');
    },
  };
}
