'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Image src="/bananyang-icon.png" alt="BanaNyang" width={24} height={24} style={{ borderRadius: 6 }} />
        <span>{t.footer.copyright}</span>
      </div>
      <div className="footer-links">
        <Link href="/tos">{t.footer.tos}</Link>
        <Link href="/privacy">{t.footer.privacy}</Link>
        <Link href="/contact">{t.footer.contact}</Link>
      </div>
    </footer>
  );
}
