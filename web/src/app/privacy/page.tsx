'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const LAST_UPDATED = '2025-01-01';
const CONTACT_EMAIL = 'contact@bananyang.app';

/* ─── Section heading helper ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
        {children}
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  const { t, locale } = useLanguage();

  const isKo = locale === 'ko';
  const isJa = locale === 'ja';

  return (
    <>
      <div className="dark-grid-bg" aria-hidden="true" />

      <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        {/* ─── Navigation ─── */}
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
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
            }}
          >
            <Image src="/bananyang-icon.png" alt="BanaNyang" width={28} height={28} style={{ borderRadius: 7 }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>BanaNyang</span>
          </Link>
          <LanguageSwitcher />
        </nav>

        {/* ─── Content ─── */}
        <article
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '72px 24px 120px',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t.legal.lastUpdated}: {LAST_UPDATED}
            </p>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
                marginBottom: 16,
              }}
            >
              {isKo ? '개인정보 처리방침' : isJa ? 'プライバシーポリシー' : 'Privacy Policy'}
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {isKo
                ? 'BanaNyang(이하 "회사")은 이용자의 개인정보를 중요시하며, 개인정보 보호법 및 관련 법령을 준수합니다.'
                : isJa
                  ? 'BanaNyang（以下「当社」）は、ユーザーの個人情報を重視し、個人情報保護法および関連法令を遵守します。'
                  : 'BanaNyang ("we", "us", or "our") respects your privacy and is committed to protecting your personal information in accordance with applicable laws.'}
            </p>
          </div>

          {/* Body */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              borderRadius: 20,
              padding: '40px 36px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 24px rgba(0, 0, 0, 0.25)',
            }}
          >
            <Section title={isKo ? '1. 수집하는 개인정보' : isJa ? '1. 収集する個人情報' : '1. Information We Collect'}>
              {isKo ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li><strong>계정 정보</strong>: 이메일 주소, 비밀번호(암호화 저장), 표시 이름 — Firebase Authentication을 통해 수집</li>
                  <li><strong>구매 정보</strong>: 거래 ID, 구매 금액, 구매 일시, 라이선스 키 — Paddle 결제 처리 시 수집</li>
                  <li><strong>사용 정보</strong>: 앱 이용 시 기기에 로컬 저장되는 설정 정보 (서버로 전송되지 않음)</li>
                  <li><strong>문의 정보</strong>: 문의 이메일 수신 시 이름, 이메일, 문의 내용</li>
                </ul>
              ) : isJa ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li><strong>アカウント情報</strong>: メールアドレス、パスワード（暗号化保存）、表示名 — Firebase Authenticationを通じて収集</li>
                  <li><strong>購入情報</strong>: トランザクションID、購入金額、購入日時、ライセンスキー — Paddle決済処理時に収集</li>
                  <li><strong>利用情報</strong>: アプリ使用時にデバイスにローカル保存される設定情報（サーバーには送信されません）</li>
                  <li><strong>お問い合わせ情報</strong>: お問い合わせメール受信時の氏名、メールアドレス、内容</li>
                </ul>
              ) : (
                <ul style={{ paddingLeft: 20 }}>
                  <li><strong>Account information</strong>: Email address, password (encrypted), display name — collected via Firebase Authentication</li>
                  <li><strong>Purchase information</strong>: Transaction ID, purchase amount, purchase date, license key — collected during Paddle payment processing</li>
                  <li><strong>Usage information</strong>: App settings stored locally on your device (not transmitted to servers)</li>
                  <li><strong>Inquiry information</strong>: Name, email address, and message content when you contact us</li>
                </ul>
              )}
            </Section>

            <Section title={isKo ? '2. 개인정보 이용 목적' : isJa ? '2. 個人情報の利用目的' : '2. How We Use Your Information'}>
              {isKo ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>회원 가입 및 서비스 제공</li>
                  <li>구매 내역 관리 및 라이선스 키 발급</li>
                  <li>고객 문의 처리 및 기술 지원</li>
                  <li>서비스 개선 및 버그 수정</li>
                </ul>
              ) : isJa ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>会員登録およびサービス提供</li>
                  <li>購入履歴の管理およびライセンスキーの発行</li>
                  <li>お問い合わせ対応および技術サポート</li>
                  <li>サービス改善およびバグ修正</li>
                </ul>
              ) : (
                <ul style={{ paddingLeft: 20 }}>
                  <li>Account registration and service provision</li>
                  <li>Purchase history management and license key issuance</li>
                  <li>Customer inquiry handling and technical support</li>
                  <li>Service improvement and bug fixes</li>
                </ul>
              )}
            </Section>

            <Section title={isKo ? '3. 제3자 서비스' : isJa ? '3. 第三者サービス' : '3. Third-Party Services'}>
              {isKo ? (
                <>
                  <p>회사는 서비스 운영을 위해 다음 제3자 서비스를 이용합니다:</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li><strong>Google Firebase</strong>: 인증 및 데이터베이스 (미국 서버)</li>
                    <li><strong>Paddle</strong>: 결제 처리 (Paddle의 개인정보 처리방침 적용)</li>
                    <li><strong>AI 공급자 (Google Gemini / Vertex AI, OpenAI, FLUX)</strong>: AI 생성 기능 (사용자 본인의 API 키 또는 계정 사용, 회사를 통해 전송되지 않음)</li>
                  </ul>
                </>
              ) : isJa ? (
                <>
                  <p>当社はサービス運営のため、以下の第三者サービスを利用します：</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li><strong>Google Firebase</strong>: 認証およびデータベース（米国サーバー）</li>
                    <li><strong>Paddle</strong>: 決済処理（Paddleのプライバシーポリシーが適用されます）</li>
                    <li><strong>AIプロバイダー（Google Gemini / Vertex AI、OpenAI、FLUX）</strong>: AI生成機能（ユーザー自身のAPIキーまたはアカウントを使用、当社経由では送信されません）</li>
                  </ul>
                </>
              ) : (
                <>
                  <p>We use the following third-party services to operate our service:</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li><strong>Google Firebase</strong>: Authentication and database (US servers)</li>
                    <li><strong>Paddle</strong>: Payment processing (Paddle's privacy policy applies)</li>
                    <li><strong>AI Providers (Google Gemini / Vertex AI, OpenAI, FLUX)</strong>: AI generation features (uses your own API keys or accounts — not transmitted through us)</li>
                  </ul>
                </>
              )}
            </Section>

            <Section title={isKo ? '4. 개인정보 보관 기간' : isJa ? '4. 個人情報の保管期間' : '4. Data Retention'}>
              {isKo
                ? '계정 정보는 회원 탈퇴 시 삭제됩니다. 구매 기록은 법적 의무에 따라 최대 5년간 보관될 수 있습니다.'
                : isJa
                  ? 'アカウント情報は退会時に削除されます。購入記録は法的義務に従い、最大5年間保管される場合があります。'
                  : 'Account information is deleted upon account deletion. Purchase records may be retained for up to 5 years in accordance with legal obligations.'}
            </Section>

            <Section title={isKo ? '5. 이용자 권리' : isJa ? '5. ユーザーの権利' : '5. Your Rights'}>
              {isKo ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>개인정보 열람, 수정, 삭제 요청 가능</li>
                  <li>계정 페이지에서 표시 이름 수정 가능</li>
                  <li>개인정보 관련 문의: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-yellow)' }}>{CONTACT_EMAIL}</a></li>
                </ul>
              ) : isJa ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>個人情報の閲覧、修正、削除を要求できます</li>
                  <li>アカウントページで表示名を修正できます</li>
                  <li>個人情報に関するお問い合わせ: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-yellow)' }}>{CONTACT_EMAIL}</a></li>
                </ul>
              ) : (
                <ul style={{ paddingLeft: 20 }}>
                  <li>You may request access to, correction, or deletion of your personal information</li>
                  <li>You can update your display name in the account page</li>
                  <li>For privacy inquiries: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-yellow)' }}>{CONTACT_EMAIL}</a></li>
                </ul>
              )}
            </Section>

            <Section title={isKo ? '6. 문의처' : isJa ? '6. お問い合わせ先' : '6. Contact'}>
              <p>
                {isKo ? '개인정보 관련 문의사항은 아래로 연락해 주세요:'
                  : isJa ? '個人情報に関するお問い合わせは以下にご連絡ください：'
                    : 'For privacy-related inquiries, please contact us at:'}
              </p>
              <p style={{ marginTop: 8 }}>
                <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-yellow)', textDecoration: 'none' }}>
                  {CONTACT_EMAIL}
                </a>
              </p>
            </Section>
          </div>

          {/* Back link */}
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <Link href="/" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← {t.nav.backHome}
            </Link>
          </div>
        </article>
      </main>
    </>
  );
}
