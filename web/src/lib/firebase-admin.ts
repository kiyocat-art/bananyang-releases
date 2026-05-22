/* ─────────────────────────────────────────────────────────────────────────────
   Firebase Admin SDK — server-side only (API routes)
   Uses lazy initialisation so the build step doesn't require env vars.
   NEVER import this file in client components.
   ───────────────────────────────────────────────────────────────────────────── */

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let _app: App | undefined;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[Firebase Admin] Missing env vars: FIREBASE_ADMIN_PROJECT_ID, ' +
        'FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY'
    );
  }

  _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return _app;
}

/** Call inside API route handlers — throws if env vars are missing */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

/** Call inside API route handlers — throws if env vars are missing */
export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
