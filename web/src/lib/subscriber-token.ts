/* ─────────────────────────────────────────────────────────────────────────────
   Unsubscribe token — HMAC-signed email so the unsubscribe link is tamper-proof
   and stateless (no per-token DB entry needed).
   ───────────────────────────────────────────────────────────────────────────── */

import { createHmac, timingSafeEqual } from 'crypto';

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_HMAC_SECRET?.trim();
  if (!secret) throw new Error('[unsubscribe] Missing UNSUBSCRIBE_HMAC_SECRET');
  return secret;
}

/** token format: <b64url(email)>.<b64url(hmac-sha256(email))> */
export function signUnsubscribeToken(email: string): string {
  const normalized = email.toLowerCase().trim();
  const payload = b64url(Buffer.from(normalized, 'utf8'));
  const mac = createHmac('sha256', getSecret()).update(normalized).digest();
  return `${payload}.${b64url(mac)}`;
}

/** Returns the verified email if the token is valid, null otherwise. */
export function verifyUnsubscribeToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  let email: string;
  let givenMac: Buffer;
  try {
    email = b64urlDecode(parts[0]).toString('utf8');
    givenMac = b64urlDecode(parts[1]);
  } catch {
    return null;
  }

  if (!email || email.length > 320) return null;

  const expected = createHmac('sha256', getSecret()).update(email).digest();
  if (expected.length !== givenMac.length) return null;
  try {
    if (!timingSafeEqual(expected, givenMac)) return null;
  } catch {
    return null;
  }
  return email;
}
