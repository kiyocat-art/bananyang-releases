'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { PageShell } from '@/components/PageShell';
import { ProviderPricingTabs } from '@/components/ProviderPricingTabs';
import { CheckIcon, WindowsIcon, AppleIcon, ChevronDownIcon } from '@/components/icons';
import { Modal } from '@/components/Modal';
import { WINDOWS_URL, MAC_URL, IS_COMING_SOON } from '@/lib/siteConfig';

export default function PricingPage() {
  return (
    <Suspense>
      <PricingInner />
    </Suspense>
  );
}

function NotifyForm() {
  const { t, locale } = useLanguage();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'success' | 'already_subscribed' | 'email_error' | 'rate_limited' | 'server_error'
  >('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('email_error');
      return;
    }
    setStatus('submitting');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'pricing_page', locale }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean; alreadySubscribed?: boolean; error?: string;
      };
      if (res.status === 429 || json.error === 'rate_limited') { setStatus('rate_limited'); return; }
      if (!res.ok || !json.ok) {
        setStatus(json.error === 'invalid_email' ? 'email_error' : 'server_error');
        return;
      }
      setStatus(json.alreadySubscribed ? 'already_subscribed' : 'success');
      setEmail('');
    } catch (err) {
      console.error('[NotifyForm] subscribe error:', err);
      setStatus('server_error');
    }
  }

  const isSubmitting = status === 'submitting';
  const isDone = status === 'success' || status === 'already_subscribed';

  return (
    <div style={{ marginTop: 28 }}>
      {isDone ? (
        <div className="notify-success-banner">
          <span className="notify-success-check">✓</span>
          {status === 'already_subscribed' ? t.comingSoon.notifyAlready ?? t.comingSoon.notifySuccess : t.comingSoon.notifySuccess}
        </div>
      ) : (
        <>
          <form className="notify-form" onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (status !== 'idle') setStatus('idle'); }}
              placeholder={t.comingSoon.notifyPlaceholder}
              aria-label="Email for launch notification"
              disabled={isSubmitting}
            />
            <button type="submit" aria-label="Submit" disabled={isSubmitting}>{isSubmitting ? '…' : '→'}</button>
          </form>
          {status === 'email_error' && <p className="notify-error-text">{t.comingSoon.notifyError}</p>}
          {status === 'rate_limited' && <p className="notify-error-text">{t.comingSoon.notifyRateLimited ?? t.comingSoon.notifyServerError}</p>}
          {status === 'server_error' && <p className="notify-error-text">{t.comingSoon.notifyServerError}</p>}
        </>
      )}
    </div>
  );
}

function PricingInner() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userOS, setUserOS] = useState<'windows' | 'mac' | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [purchaseChecked, setPurchaseChecked] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setUserOS(ua.includes('mac') ? 'mac' : 'windows');
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) { setPurchaseChecked(true); return; }
    getDoc(doc(getFirebaseDb(), 'users', user.uid))
      .then((snap) => setIsUnlocked(snap.data()?.hasPurchase ?? false))
      .catch(() => {})
      .finally(() => setPurchaseChecked(true));
  }, [user, authLoading]);

  useEffect(() => {
    if (!purchaseChecked || !user || isUnlocked) return;
    if (searchParams.get('checkout') !== '1') return;
    openCheckout();
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    window.history.replaceState({}, '', url.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseChecked, user, isUnlocked, searchParams]);

  function openCheckout() {
    const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID;
    if (window.Paddle && priceId) {
      window.Paddle.Checkout.open({ items: [{ priceId, quantity: 1 }], ...(user?.email ? { customer: { email: user.email } } : {}) });
      return;
    }
    const checkoutUrl = process.env.NEXT_PUBLIC_PADDLE_CHECKOUT_URL;
    if (checkoutUrl) {
      const emailParam = user?.email ? `?customer[email]=${encodeURIComponent(user.email)}` : '';
      window.open(`${checkoutUrl}${emailParam}`, '_blank', 'noopener,noreferrer');
    }
  }

  function handleBuyClick() {
    if (!user) { router.push('/auth/login?redirect=/pricing?checkout=1'); return; }
    openCheckout();
  }

  const tableHeaders = {
    model: t.pricing.table.model,
    resolution: t.pricing.table.resolution,
    quality: t.pricing.table.quality,
    pricePerImage: t.pricing.table.pricePerImage,
  };

  const providerLabels = {
    google: t.pricing.providers.google,
    openai: t.pricing.providers.openai,
    flux: t.pricing.providers.flux,
  };

  const footnoteLabel = {
    google: t.pricing.footnote.gemini,
    openai: t.pricing.footnote.openai,
    flux: t.pricing.footnote.flux,
  };

  return (
    <PageShell>
      {/* ─── App Purchase Card ─── */}
      <section className="content-section">
        <div className="section-label" style={{ textAlign: 'center', justifyContent: 'center' }}>
          <span className="accent-dot" />
          {t.pricing.title}
        </div>
        <h2 className="section-headline" style={{ textAlign: 'center' }}>
          {t.hero.pricingTagline}
        </h2>
        <p className="section-sub" style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 48px' }}>
          {t.pricing.lifetimeDesc}
        </p>

        <div className="pricing-card">
          {IS_COMING_SOON && (
            <span className="pricing-coming-badge">{t.comingSoon.availableAtLaunch}</span>
          )}
          <div className="pricing-card-header">
            <div>
              <p className="pricing-label">BanaNyang</p>
              <p className="pricing-tier">Lifetime License</p>
            </div>
            <div className="pricing-price">
              <span className="pricing-amount">$19.99</span>
              <span className="pricing-once">one-time</span>
            </div>
          </div>

          <div className="pricing-divider" />

          <ul className="pricing-features">
            {(t.hero.pricingFeatures).split('|').map((feat) => (
              <li key={feat} className="pricing-feature-item">
                <CheckIcon />
                <span>{feat.replace('✔', '').trim()}</span>
              </li>
            ))}
            <li className="pricing-feature-item">
              <CheckIcon />
              <span>Windows &amp; macOS</span>
            </li>
            <li className="pricing-feature-item">
              <CheckIcon />
              <span>All future updates</span>
            </li>
          </ul>

          {IS_COMING_SOON ? (
            <button onClick={() => setNotifyOpen(true)} className="btn-cta-primary pricing-cta-btn">
              {t.comingSoon.notifyMe}
            </button>
          ) : (
            <button onClick={handleBuyClick} className="btn-cta-primary pricing-cta-btn">
              {t.hero.buyNow}
            </button>
          )}

          <p className="pricing-note">{t.hero.priceBadgeDesc}</p>
        </div>
      </section>

      <div className="section-divider" />

      {/* ─── AI 생성 기능 이용 안내 ─── */}
      <div className="pricing-notice">
        <p className="pricing-notice-title">{t.pricing.notice.title}</p>
        <p className="pricing-notice-body">{t.pricing.notice.body}</p>
      </div>

      {/* ─── API Pricing Tables ─── */}
      <section className="content-section" style={{ paddingTop: 16 }}>
        <h2 className="section-headline" style={{ textAlign: 'center' }}>
          {t.pricing.apiPricingTitle}
        </h2>
        <p className="section-sub" style={{ textAlign: 'center', maxWidth: 460, margin: '0 auto 40px' }}>
          {t.pricing.apiPricingSubtitle}
        </p>

        <ProviderPricingTabs
          tableHeaders={tableHeaders}
          providerLabels={providerLabels}
          footnoteLabel={footnoteLabel}
        />
      </section>

      <div className="section-divider" />

      {/* ─── Download Section ─── */}
      <section id="download" className="content-section" style={{ textAlign: 'center' }}>
        <div className="section-label" style={{ justifyContent: 'center' }}>
          <span className="accent-dot" />
          {t.nav.download}
        </div>
        <h2 className="section-headline" style={{ textAlign: 'center', marginBottom: 12 }}>
          {t.download?.title ?? 'Download BanaNyang'}
        </h2>
        <p className="section-sub" style={{ textAlign: 'center', maxWidth: 460, margin: '0 auto 48px' }}>
          {t.download?.subtitle ?? 'Available for Windows and macOS'}
        </p>

        {IS_COMING_SOON ? (
          <div className="coming-soon-card">
            <div className="coming-soon-badge">
              <span className="hero-badge-dot" />
              {t.comingSoon.badge}
            </div>
            <p className="section-sub" style={{ maxWidth: 400, margin: '0 auto' }}>
              {t.comingSoon.cardBody}
            </p>
            <div className="download-btn-group" style={{ marginTop: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button className="btn-download-new btn-download-locked" aria-disabled="true" title={t.comingSoon.tooltip} onClick={e => e.preventDefault()}>
                  <WindowsIcon />{t.hero.downloadWindows}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button className="btn-download-new btn-download-locked" aria-disabled="true" title={t.comingSoon.tooltip} onClick={e => e.preventDefault()}>
                  <AppleIcon />{t.hero.downloadMac}
                </button>
                <span className="btn-sub-note">{t.comingSoon.macOptimizing}</span>
              </div>
            </div>
            <div style={{ marginTop: 28 }}>
              <button className="btn-notify-cta" onClick={() => setNotifyOpen(true)}>
                {t.comingSoon.notifyMe}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="download-btn-group">
              <a href={WINDOWS_URL} download className="btn-download-new">
                <WindowsIcon />{t.hero.downloadWindows}
              </a>
              <a href={MAC_URL} download className="btn-download-new">
                <AppleIcon />{t.hero.downloadMac}
              </a>
            </div>
            {userOS && (
              <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                Detected: {userOS === 'mac' ? 'macOS' : 'Windows'}
              </p>
            )}
          </>
        )}

        {/* License gate (when not unlocked and not coming soon) */}
        {!IS_COMING_SOON && !isUnlocked && purchaseChecked && (
          <div className="download-gate" style={{ marginTop: 40 }}>
            <p className="gate-title">{t.download.gate.title}</p>
            <p className="gate-sub">{t.download.gate.subtitle}</p>
            <div className="gate-actions">
              <button onClick={handleBuyClick} className="btn-cta-primary">
                {t.download.gate.buy}
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{t.download.gate.buyNote}</p>
            </div>
          </div>
        )}
      </section>

      <Modal isOpen={notifyOpen} onClose={() => setNotifyOpen(false)} title={t.comingSoon.notifyMe}>
        <NotifyForm />
      </Modal>

      {/* Suppress unused import warning */}
      <span style={{ display: 'none' }}><ChevronDownIcon /></span>
    </PageShell>
  );
}
