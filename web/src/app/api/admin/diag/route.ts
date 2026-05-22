/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/admin/diag — env-var + service health check for the email pipeline.
   Admin-only. Returns which env vars are set + tries to ping Resend domains API.
   Does NOT send any email — safe to call.
   ───────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, AdminAuthError } from '@/lib/admin-auth';

export const runtime = 'nodejs';

interface EnvStatus {
  name: string;
  present: boolean;
  hint?: string;
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);
  } catch (e) {
    const err = e as AdminAuthError;
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status ?? 401 });
  }

  const env: EnvStatus[] = [
    { name: 'RESEND_API_KEY', present: !!process.env.RESEND_API_KEY?.trim() },
    {
      name: 'EMAIL_FROM',
      present: !!process.env.EMAIL_FROM?.trim(),
      hint: process.env.EMAIL_FROM?.trim(),
    },
    {
      name: 'NEXT_PUBLIC_SITE_URL',
      present: !!process.env.NEXT_PUBLIC_SITE_URL?.trim(),
      hint: process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    },
    {
      name: 'UNSUBSCRIBE_HMAC_SECRET',
      present: !!process.env.UNSUBSCRIBE_HMAC_SECRET?.trim(),
    },
    {
      name: 'ADMIN_EMAIL_WHITELIST',
      present: !!process.env.ADMIN_EMAIL_WHITELIST?.trim(),
      hint: process.env.ADMIN_EMAIL_WHITELIST?.trim(),
    },
    {
      name: 'FIREBASE_ADMIN_PROJECT_ID',
      present: !!process.env.FIREBASE_ADMIN_PROJECT_ID?.trim(),
      hint: process.env.FIREBASE_ADMIN_PROJECT_ID?.trim(),
    },
    {
      name: 'FIREBASE_ADMIN_CLIENT_EMAIL',
      present: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim(),
    },
    {
      name: 'FIREBASE_ADMIN_PRIVATE_KEY',
      present: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim(),
    },
  ];

  /* ─── Resend ping — list domains (no-op if key missing) ─── */
  let resendReachable = false;
  let resendDomains: Array<{ name: string; status: string; region?: string }> = [];
  let resendError: string | null = null;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        resendReachable = true;
        const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
        resendDomains = (json.data ?? []).map(d => ({
          name: String(d.name ?? ''),
          status: String(d.status ?? ''),
          region: typeof d.region === 'string' ? d.region : undefined,
        }));
      } else {
        resendError = `Resend HTTP ${res.status}: ${await res.text().catch(() => '')}`.slice(
          0,
          300
        );
      }
    } catch (e) {
      resendError = String((e as Error)?.message ?? e).slice(0, 300);
    }
  } else {
    resendError = 'RESEND_API_KEY not set';
  }

  const missing = env.filter(e => !e.present).map(e => e.name);
  const ok = missing.length === 0 && resendReachable;

  return NextResponse.json({
    ok,
    env,
    missingEnv: missing,
    resend: {
      reachable: resendReachable,
      domains: resendDomains,
      error: resendError,
    },
    hints: buildHints(env, resendReachable, resendDomains, resendError),
  });
}

function buildHints(
  env: EnvStatus[],
  reachable: boolean,
  domains: Array<{ name: string; status: string }>,
  err: string | null
): string[] {
  const hints: string[] = [];
  const missing = env.filter(e => !e.present).map(e => e.name);
  if (missing.length > 0) {
    hints.push(
      `Missing env vars in Vercel Production: ${missing.join(', ')}. Set them in Vercel project settings, then redeploy.`
    );
  }
  if (!reachable && err) {
    hints.push(`Resend API not reachable: ${err}`);
  }
  if (reachable) {
    if (domains.length === 0) {
      hints.push(
        'No domains registered in Resend. Add bananyang.app at https://resend.com/domains and add the 4 DNS records (MX/SPF/DKIM/DMARC).'
      );
    } else {
      const ok = domains.some(d => d.status === 'verified');
      if (!ok) {
        const list = domains.map(d => `${d.name}=${d.status}`).join(', ');
        hints.push(
          `No verified domain in Resend yet. Current: ${list}. Until verification completes, sends from your domain will fail. ` +
            'Quick workaround: temporarily set EMAIL_FROM=onboarding@resend.dev (Resend default) — but it can only deliver to your account-owner email, not arbitrary recipients.'
        );
      }
    }
  }
  if (hints.length === 0) {
    hints.push('All checks passed. If welcome emails still are not arriving, check the Resend dashboard "Emails" tab for the most recent send attempt and its error.');
  }
  return hints;
}
