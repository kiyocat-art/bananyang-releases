/* ─────────────────────────────────────────────────────────────────────────────
   GET /preview/welcome — renders WelcomeEmail as HTML for visual review.
   Public (no PII rendered, just a sample). Useful for design QA without
   triggering a real send.
   ───────────────────────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import { WelcomeEmail } from '@/emails/WelcomeEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://bananyang.app';
  const html = await render(
    WelcomeEmail({
      siteUrl,
      logoUrl: `${siteUrl}/bananyang-icon.png`,
      unsubscribeUrl: `${siteUrl}/unsubscribe?token=PREVIEW`,
    })
  );
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
