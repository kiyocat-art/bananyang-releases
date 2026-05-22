/* ─────────────────────────────────────────────────────────────────────────────
   License key utilities (server-side only)
   ───────────────────────────────────────────────────────────────────────────── */

import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure license key.
 * Format: XXXX-XXXX-XXXX-XXXX
 * Character set excludes visually ambiguous chars: 0/O, 1/I
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => {
      const byte = randomBytes(1)[0];
      return chars[byte % chars.length];
    }).join('')
  );
  return segments.join('-');
}

/**
 * Validates license key format only (no server check).
 * Use /api/license/verify for authoritative validation.
 */
export function isValidKeyFormat(key: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
}
