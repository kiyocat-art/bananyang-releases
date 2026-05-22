/* ─────────────────────────────────────────────────────────────────────────────
   /admin — redirects to /admin/subscribers so the short URL also works.
   ───────────────────────────────────────────────────────────────────────────── */

import { redirect } from 'next/navigation';

export default function AdminIndex() {
  redirect('/admin/subscribers');
}
