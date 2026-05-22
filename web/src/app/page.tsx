'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { PageShell } from '@/components/PageShell';
import { YoutubeEmbed } from '@/components/YoutubeEmbed';
import {
  WalletIcon, CanvasFrameIcon, DesktopIcon, ChevronDownIcon,
} from '@/components/icons';
import { VIDEOS, IS_COMING_SOON } from '@/lib/siteConfig';
import Link from 'next/link';

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#pricing' || hash === '#download') {
      router.replace('/pricing');
    } else if (hash === '#features' || hash === '#showcase') {
      router.replace('/features');
    }
  }, [router]);

  return (
    <PageShell>
      {/* ══════════════════════════════════════
          HERO — Split Layout
      ══════════════════════════════════════ */}
      <section id="hero" className="hero-split-section">

        {/* Left — Text + CTA */}
        <div className="hero-text-col animate-fade-in-up">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            NanoBanana Workspace for Artists
          </div>

          <h1 className="hero-headline">
            {t.hero.title}
          </h1>

          <p className="hero-sub">
            {t.hero.subtitle}
          </p>

          <p className="hero-price-note">{t.hero.price}</p>

          <div className="hero-cta-row">
            {IS_COMING_SOON ? (
              <>
                <Link href="/pricing" className="btn-cta-primary">
                  {t.comingSoon.notifyMe}
                </Link>
                <span className="btn-cta-secondary btn-disabled-cta" aria-disabled="true" title={t.comingSoon.tooltip}>
                  {t.comingSoon.badge}
                  <ChevronDownIcon />
                </span>
              </>
            ) : (
              <>
                <Link href="/pricing" className="btn-cta-primary">
                  {t.hero.buyNow}
                </Link>
                <Link href="/pricing#download" className="btn-cta-secondary">
                  {t.nav.download}
                  <ChevronDownIcon />
                </Link>
              </>
            )}
          </div>

          <p className="hero-features-line">{t.hero.pricingFeatures}</p>
        </div>

        {/* Right — Hero Video */}
        <div className="hero-media-col animate-fade-in-up animate-delay-200">
          <YoutubeEmbed videoId={VIDEOS.hero} label="Product Demo" className="media-placeholder-hero" />
        </div>

      </section>

      {/* ── Separator ── */}
      <div className="section-divider" />

      {/* ══════════════════════════════════════
          INTRO PILLARS — 3 differentiators
      ══════════════════════════════════════ */}
      <section id="intro" className="content-section">
        <div className="section-label animate-fade-in-up">
          <span className="accent-dot" />
          {t.intro.label}
        </div>
        <h2 className="section-headline animate-fade-in-up">
          {t.intro.headline}
        </h2>

        <div className="intro-pillar-grid">
          {[
            { icon: <WalletIcon />, title: t.intro.byok.title, desc: t.intro.byok.desc },
            { icon: <CanvasFrameIcon />, title: t.intro.canvas.title, desc: t.intro.canvas.desc },
            { icon: <DesktopIcon />, title: t.intro.desktop.title, desc: t.intro.desktop.desc },
          ].map((p) => (
            <div key={p.title} className="intro-pillar-card">
              <div className="intro-pillar-icon">{p.icon}</div>
              <h3 className="intro-pillar-title">{p.title}</h3>
              <p className="intro-pillar-desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
