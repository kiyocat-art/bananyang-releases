/* ─────────────────────────────────────────────────────────────────────────────
   Resend client — server-side only (API routes). Lazy init so build does not
   require RESEND_API_KEY to be present at compile time.
   ───────────────────────────────────────────────────────────────────────────── */

import { Resend } from 'resend';

let _resend: Resend | undefined;

export function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('[Resend] Missing RESEND_API_KEY');
  }
  _resend = new Resend(apiKey);
  return _resend;
}

export function getEmailFrom(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) throw new Error('[Resend] Missing EMAIL_FROM');
  return from;
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://bananyang.app';
}
