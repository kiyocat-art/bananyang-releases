'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { AuthNav } from '@/components/AuthNav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const TABS = [
  { href: '/features',  labelKey: 'features'  },
  { href: '/pricing',   labelKey: 'pricing'   },
  { href: '/changelog', labelKey: 'changelog' },
] as const;

type TabKey = (typeof TABS)[number]['labelKey'];

export function SiteNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabLabel: Record<TabKey, string> = {
    features:  t.nav.features,
    pricing:   t.nav.pricing,
    changelog: t.nav.changelog,
  };

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <>
      <header className="site-nav">
        <div className="nav-left">
          <Link href="/" className="nav-brand" onClick={() => setMobileMenuOpen(false)}>
            <Image src="/bananyang-icon.png" alt="BanaNyang" width={28} height={28} style={{ borderRadius: 7 }} />
            <span className="nav-brand-name">BanaNyang</span>
          </Link>

          <nav className="nav-tabs" aria-label="Main navigation">
            {TABS.map(({ href, labelKey }) => (
              <Link
                key={href}
                href={href}
                className={`nav-tab${isActive(href) ? ' nav-tab-active' : ''}`}
              >
                {tabLabel[labelKey]}
              </Link>
            ))}
          </nav>
        </div>

        <div className="nav-right">
          <div className="nav-auth-area">
            <AuthNav />
            <LanguageSwitcher />
          </div>
          <button
            className="nav-mobile-toggle"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {mobileMenuOpen ? (
                <>
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="17" y2="6" />
                  <line x1="3" y1="11" x2="17" y2="11" />
                  <line x1="3" y1="16" x2="17" y2="16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="nav-mobile-menu">
          {TABS.map(({ href, labelKey }) => (
            <Link
              key={href}
              href={href}
              className={`mobile-menu-item${isActive(href) ? ' mobile-menu-item-active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {tabLabel[labelKey]}
            </Link>
          ))}
          <div className="mobile-menu-divider" />
          <div className="mobile-menu-auth">
            <AuthNav />
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </>
  );
}
