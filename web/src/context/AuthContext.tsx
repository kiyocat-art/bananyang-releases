'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   AuthContext — Firebase Auth state for the entire web app
   ───────────────────────────────────────────────────────────────────────────── */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, googleProvider } from '@/lib/firebase';

/* ─── Types ─── */
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ─── Provider ─── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Upsert user document in Firestore on sign-in */
  const upsertUserDoc = useCallback(async (firebaseUser: User) => {
    try {
      await setDoc(
        doc(getFirebaseDb(), 'users', firebaseUser.uid),
        {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // Non-critical — don't block auth flow
    }
  }, []);

  /* Subscribe to Firebase auth state — skip gracefully if API key is not configured */
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      setLoading(false);
      return;
    }
    try {
      const authInstance = getFirebaseAuth();

      // Handle redirect result on mount
      getRedirectResult(authInstance)
        .then(async (result) => {
          if (result?.user) {
            await upsertUserDoc(result.user);
          }
        })
        .catch((err: unknown) => {
          console.error('[auth] getRedirectResult error:', err);
          setError(mapAuthError(err));
        });

      const unsubscribe = onAuthStateChanged(authInstance, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      });
      return unsubscribe;
    } catch {
      setLoading(false);
    }
  }, [upsertUserDoc]);

  const isConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  const signInWithGoogle = useCallback(async () => {
    if (!isConfigured) return;
    setError(null);
    try {
      const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
      if (result?.user) {
        await upsertUserDoc(result.user);
      }
    } catch (err: unknown) {
      console.error('[auth] signInWithPopup error:', (err as { code?: string })?.code, err);
      const code = (err as { code?: string })?.code ?? '';
      
      // Fallback to signInWithRedirect if popup is blocked or not supported in this environment
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(getFirebaseAuth(), googleProvider);
        } catch (redirectErr) {
          console.error('[auth] signInWithRedirect fallback error:', redirectErr);
          setError(mapAuthError(redirectErr));
        }
      } else {
        setError(mapAuthError(err));
      }
    }
  }, [isConfigured, upsertUserDoc]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!isConfigured) return;
    setError(null);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (err: unknown) {
      setError(mapAuthError(err));
    }
  }, [isConfigured]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      if (!isConfigured) return false;
      setError(null);
      try {
        const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
        await updateProfile(result.user, { displayName: name });
        await sendEmailVerification(result.user);
        await upsertUserDoc({ ...result.user, displayName: name });
        return true;
      } catch (err: unknown) {
        setError(mapAuthError(err));
        return false;
      }
    },
    [upsertUserDoc, isConfigured]
  );

  const signOut = useCallback(async () => {
    if (!isConfigured) return;
    setError(null);
    await firebaseSignOut(getFirebaseAuth());
  }, [isConfigured]);

  const resetPassword = useCallback(async (email: string) => {
    if (!isConfigured) return;
    setError(null);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
    } catch (err: unknown) {
      setError(mapAuthError(err));
    }
  }, [isConfigured]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        resetPassword,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ─── Hook ─── */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/* ─── Firebase error code → user-friendly message ─── */
function mapAuthError(err: unknown): string {
  const errObj = err as { code?: string; message?: string };
  const code = errObj?.code ?? '';
  if (!code) {
    console.error('[auth] non-Firebase error:', err);
  } else {
    console.error('[auth] Firebase error code:', code, errObj.message);
  }
  switch (code) {
    case 'auth/email-already-in-use':                        return 'email_in_use';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':                          return 'wrong_password';
    case 'auth/user-not-found':                              return 'user_not_found';
    case 'auth/weak-password':                               return 'weak_password';
    case 'auth/invalid-email':                               return 'invalid_email';
    case 'auth/unauthorized-domain':
    case 'auth/operation-not-supported-in-this-environment': return 'unauthorized_domain';
    case 'auth/popup-blocked':                               return 'popup_blocked';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':                     return '';
    case 'auth/network-request-failed':                      return 'network_error';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':                             return 'config_error';
    default:                                                 return 'unknown';
  }
}
