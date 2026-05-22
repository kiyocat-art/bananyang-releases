'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   /account — My Account page
   Shows purchase history, license keys, invoices, and profile info.
   ───────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  type Timestamp,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { AuthNav } from '@/components/AuthNav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

/* ─── Types ─── */
interface Purchase {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  purchasedAt: Timestamp;
  licenseKey: string;
  invoiceUrl: string | null;
  items: { productName: string; quantity: number }[];
}

/* ─── Page ─── */
export default function AccountPage() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  /* Redirect if not logged in */
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login?redirect=/account');
    }
  }, [user, loading, router]);

  /* Set initial display name */
  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user]);

  /* Load purchases from Firestore */
  const loadPurchases = useCallback(async () => {
    if (!user) return;
    setPurchasesLoading(true);
    try {
      const q = query(
        collection(getFirebaseDb(), 'purchases'),
        where('uid', '==', user.uid),
        orderBy('purchasedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({ transactionId: d.id, ...d.data() } as Purchase));
      setPurchases(data);
    } catch {
      // Firestore rules may deny if user has no purchases yet — treat as empty
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadPurchases();
  }, [user, loadPurchases]);

  async function handleSaveName() {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile(getFirebaseAuth().currentUser!, { displayName: displayName.trim() });
      await updateDoc(doc(getFirebaseDb(), 'users', user.uid), {
        displayName: displayName.trim(),
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function handleCopyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  /* Loading / not-logged-in states */
  if (loading || !user) {
    return (
      <>
        <div className="dark-grid-bg" aria-hidden="true" />
        <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t.account.loading}</span>
        </main>
      </>
    );
  }

  const userName = user.displayName || user.email?.split('@')[0] || 'User';

  return (
    <>
      <div className="dark-grid-bg" aria-hidden="true" />
      <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        {/* Nav */}
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 32px',
            background: 'rgba(13,13,13,0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Image src="/bananyang-icon.png" alt="BanaNyang" width={28} height={28} style={{ borderRadius: 7 }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>BanaNyang</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AuthNav />
            <LanguageSwitcher />
          </div>
        </nav>

        {/* Content */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px 100px' }}>
          {/* Greeting */}
          <h1
            style={{
              fontSize: 'clamp(24px, 3vw, 36px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: 40,
              color: 'var(--text-primary)',
            }}
          >
            {t.account.greeting}, <span style={{ color: 'var(--accent-yellow)' }}>{userName}</span>
          </h1>

          {/* ─── Purchase History ─── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={sectionTitleStyle}>
              <span className="accent-dot" />
              {t.account.purchaseHistory}
            </h2>

            {purchasesLoading ? (
              <div style={cardStyle}>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t.account.loading}</p>
              </div>
            ) : purchases.length === 0 ? (
              <div style={cardStyle}>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t.account.noPurchases}</p>
                <Link
                  href="/"
                  style={{
                    display: 'inline-block',
                    marginTop: 16,
                    padding: '10px 20px',
                    borderRadius: 8,
                    background: 'var(--accent-yellow)',
                    color: '#0d0d0d',
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Buy Now
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {purchases.map((p) => (
                  <PurchaseCard
                    key={p.transactionId}
                    purchase={p}
                    onCopyKey={handleCopyKey}
                    copiedKey={copiedKey}
                    t={t}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ─── Device change notice ─── */}
          {purchases.length > 0 && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 10,
                background: 'rgba(255,180,0,0.07)',
                border: '1px solid rgba(255,180,0,0.2)',
                marginBottom: 32,
                fontSize: 13,
                color: 'rgba(255,200,80,0.85)',
                lineHeight: 1.6,
              }}
            >
              {t.account.deviceChangeNotice}
            </div>
          )}

          {/* ─── Profile ─── */}
          <section>
            <h2 style={sectionTitleStyle}>
              <span className="accent-dot" />
              {t.account.profile}
            </h2>
            <div style={cardStyle}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  {t.auth.name}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 8,
                      border: 'none',
                      background: saved ? 'rgba(0,200,100,0.15)' : 'var(--bg-card-hover)',
                      color: saved ? '#00c864' : 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: saving ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {saved ? t.account.saved : saving ? '...' : t.account.saveChanges}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  {t.auth.email}
                </label>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', padding: '10px 0' }}>
                  {user.email}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

/* ─── Purchase Card ─── */
function PurchaseCard({
  purchase,
  onCopyKey,
  copiedKey,
  t,
}: {
  purchase: Purchase;
  onCopyKey: (key: string) => void;
  copiedKey: string | null;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const date = purchase.purchasedAt?.toDate?.()?.toLocaleDateString() ?? '';
  const amount = (purchase.amount / 100).toFixed(2);
  const isCopied = copiedKey === purchase.licenseKey;

  return (
    <div style={{ ...cardStyle, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Status badge */}
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: purchase.status === 'completed' ? 'rgba(0,200,100,0.12)' : 'rgba(255,77,77,0.12)',
              color: purchase.status === 'completed' ? '#00c864' : '#ff6b6b',
              border: `1px solid ${purchase.status === 'completed' ? 'rgba(0,200,100,0.25)' : 'rgba(255,77,77,0.25)'}`,
            }}
          >
            {purchase.status}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{date}</span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          ${amount} {purchase.currency}
        </span>
      </div>

      {/* Product name */}
      {purchase.items.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          {purchase.items.map((i) => i.productName).join(', ')}
        </p>
      )}

      {/* License key */}
      <div style={{ marginBottom: purchase.invoiceUrl ? 12 : 0 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          {t.account.licenseKey}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              fontSize: 13,
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              color: 'var(--accent-yellow)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {purchase.licenseKey}
          </code>
          <button
            onClick={() => onCopyKey(purchase.licenseKey)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              background: isCopied ? 'rgba(0,200,100,0.15)' : 'var(--bg-card-hover)',
              color: isCopied ? '#00c864' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            {isCopied ? t.account.keyCopied : t.account.copyKey}
          </button>
        </div>
      </div>

      {/* Invoice */}
      {purchase.invoiceUrl && (
        <a
          href={purchase.invoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-muted)',
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h7A2.5 2.5 0 0 1 14 2.5v11a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5V2.5Zm4 5.25a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5H6Zm0 3a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5H6ZM5.25 4a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5Z" />
          </svg>
          {t.account.invoice}
        </a>
      )}
    </div>
  );
}

/* ─── Shared styles ─── */
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 16,
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  padding: '24px',
};
