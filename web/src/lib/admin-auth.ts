/* ─────────────────────────────────────────────────────────────────────────────
   Admin auth — verifies Firebase ID token + email allowlist for /api/admin/*
   ───────────────────────────────────────────────────────────────────────────── */

import { NextRequest } from 'next/server';
import { getAdminAuth } from './firebase-admin';

export interface AdminContext {
  uid: string;
  email: string;
}

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getWhitelist(): Set<string> {
  const raw = process.env.ADMIN_EMAIL_WHITELIST ?? '';
  return new Set(
    raw
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Verifies an Authorization: Bearer <idToken> header. Throws AdminAuthError on
 * failure. Returns admin context on success.
 */
export async function verifyAdminToken(req: NextRequest): Promise<AdminContext> {
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AdminAuthError('Missing bearer token', 401);
  }

  const idToken = match[1];
  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    throw new AdminAuthError('Invalid token', 401);
  }

  const email = (decoded.email ?? '').toLowerCase();
  if (!email) {
    throw new AdminAuthError('Token has no email', 403);
  }

  const whitelist = getWhitelist();
  if (whitelist.size === 0) {
    throw new AdminAuthError('Admin whitelist not configured', 503);
  }
  if (!whitelist.has(email)) {
    throw new AdminAuthError('Forbidden', 403);
  }

  return { uid: decoded.uid, email };
}
