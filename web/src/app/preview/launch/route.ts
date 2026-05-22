/* ─────────────────────────────────────────────────────────────────────────────
   GET /preview/launch — renders LaunchAnnouncement as HTML for visual review.
   ───────────────────────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server';
import { render } from '@react-email/components';
import { LaunchAnnouncement } from '@/emails/LaunchAnnouncement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://bananyang.app';
  const html = await render(
    LaunchAnnouncement({
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
