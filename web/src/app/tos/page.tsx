'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const LAST_UPDATED = '2025-01-01';
const CONTACT_EMAIL = 'contact@bananyang.app';

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

export default function TosPage() {
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
              {isKo ? '서비스 이용약관' : isJa ? '利用規約' : 'Terms of Service'}
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {isKo
                ? 'BanaNyang 소프트웨어를 구매하거나 사용함으로써 본 이용약관에 동의하는 것으로 간주됩니다.'
                : isJa
                  ? 'BanaNyangソフトウェアを購入または使用することで、本利用規約に同意したものとみなされます。'
                  : 'By purchasing or using the BanaNyang software, you agree to be bound by these Terms of Service.'}
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
            <Section title={isKo ? '1. 소프트웨어 라이선스' : isJa ? '1. ソフトウェアライセンス' : '1. Software License'}>
              {isKo ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>BanaNyang는 1회 구매 기반의 영구 라이선스 소프트웨어입니다.</li>
                  <li>구매 1건당 1명의 개인 사용자에게 라이선스가 부여됩니다.</li>
                  <li>개인 또는 상업적 목적의 창작물 제작에 자유롭게 사용할 수 있습니다.</li>
                  <li>소프트웨어 자체를 재배포하거나 판매하는 것은 금지됩니다.</li>
                </ul>
              ) : isJa ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>BanaNyangは1回購入型の永続ライセンスソフトウェアです。</li>
                  <li>1購入につき1名の個人ユーザーにライセンスが付与されます。</li>
                  <li>個人または商業目的の創作物制作に自由に使用できます。</li>
                  <li>ソフトウェア自体の再配布または販売は禁止されています。</li>
                </ul>
              ) : (
                <ul style={{ paddingLeft: 20 }}>
                  <li>BanaNyang is a one-time purchase perpetual license software.</li>
                  <li>One license is granted to one individual user per purchase.</li>
                  <li>You may freely use the software for personal or commercial creative works.</li>
                  <li>Redistribution or resale of the software itself is prohibited.</li>
                </ul>
              )}
            </Section>

            <Section title={isKo ? '2. AI 생성 기능' : isJa ? '2. AI生成機能' : '2. AI Generation Features'}>
              {isKo ? (
                <>
                  <p>BanaNyang의 AI 생성 기능은 사용자 본인의 API 키 또는 계정을 사용합니다 (Google Gemini, Google Vertex AI, OpenAI gpt-image-2, FLUX.2 Max 지원).</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li>앱 구매만으로는 AI 생성 기능이 제공되지 않습니다.</li>
                    <li>AI 생성 과정에서 발생하는 API 비용은 사용자 본인이 부담합니다.</li>
                    <li>AI가 생성한 이미지의 저작권은 관련 법령 및 각 AI 공급자의 이용약관을 따릅니다.</li>
                  </ul>
                </>
              ) : isJa ? (
                <>
                  <p>BanaNyangのAI生成機能は、ユーザー自身のAPIキーまたはアカウントを使用します（Google Gemini、Google Vertex AI、OpenAI gpt-image-2、FLUX.2 Max に対応）。</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li>アプリの購入のみではAI生成機能は提供されません。</li>
                    <li>AI生成過程で発生するAPI費用はユーザー自身が負担します。</li>
                    <li>AIが生成した画像の著作権は関連法令および各AIプロバイダーの利用規約に従います。</li>
                  </ul>
                </>
              ) : (
                <>
                  <p>BanaNyang's AI generation features use your own API keys or accounts (supports Google Gemini, Google Vertex AI, OpenAI gpt-image-2, and FLUX.2 Max).</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li>Purchasing the app alone does not include AI generation.</li>
                    <li>API costs incurred during AI generation are borne by the user.</li>
                    <li>Copyright of AI-generated images is subject to applicable laws and the applicable AI provider's terms of service.</li>
                  </ul>
                </>
              )}
            </Section>

            <Section title={isKo ? '3. 환불 정책' : isJa ? '3. 返金ポリシー' : '3. Refund Policy'}>
              {isKo ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>구매 후 <strong>7일 이내</strong>에 환불을 요청할 수 있습니다.</li>
                  <li>소프트웨어가 주요 기술적 결함으로 인해 정상 작동하지 않는 경우 우선적으로 환불을 처리합니다.</li>
                  <li>라이선스 키가 이미 사용된 경우 환불이 제한될 수 있습니다.</li>
                  <li>환불 요청은 <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-yellow)' }}>{CONTACT_EMAIL}</a>로 문의해 주세요.</li>
                </ul>
              ) : isJa ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>購入後<strong>7日以内</strong>に返金を申請できます。</li>
                  <li>ソフトウェアが主要な技術的欠陥により正常に動作しない場合、優先的に返金処理を行います。</li>
                  <li>ライセンスキーがすでに使用されている場合、返金が制限される場合があります。</li>
                  <li>返金申請は<a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-yellow)' }}>{CONTACT_EMAIL}</a>にお問い合わせください。</li>
                </ul>
              ) : (
                <ul style={{ paddingLeft: 20 }}>
                  <li>You may request a refund within <strong>7 days</strong> of purchase.</li>
                  <li>Refunds are prioritized when the software fails to function due to a major technical defect.</li>
                  <li>Refunds may be limited if the license key has already been activated.</li>
                  <li>To request a refund, contact <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-yellow)' }}>{CONTACT_EMAIL}</a>.</li>
                </ul>
              )}
            </Section>

            <Section title={isKo ? '4. 금지 행위' : isJa ? '4. 禁止事項' : '4. Prohibited Uses'}>
              {isKo ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>소프트웨어의 리버스 엔지니어링, 디컴파일, 크랙 시도</li>
                  <li>라이선스 키의 무단 공유 또는 판매</li>
                  <li>불법적이거나 타인의 권리를 침해하는 콘텐츠 생성에 사용</li>
                  <li>서비스 안정성을 해치는 악의적 사용</li>
                </ul>
              ) : isJa ? (
                <ul style={{ paddingLeft: 20 }}>
                  <li>ソフトウェアのリバースエンジニアリング、逆コンパイル、クラック試行</li>
                  <li>ライセンスキーの無断共有または販売</li>
                  <li>違法または他者の権利を侵害するコンテンツ作成への使用</li>
                  <li>サービスの安定性を損なう悪意ある使用</li>
                </ul>
              ) : (
                <ul style={{ paddingLeft: 20 }}>
                  <li>Reverse engineering, decompiling, or attempting to crack the software</li>
                  <li>Unauthorized sharing or resale of license keys</li>
                  <li>Using the software to create illegal content or content that infringes others' rights</li>
                  <li>Malicious use that harms service stability</li>
                </ul>
              )}
            </Section>

            <Section title={isKo ? '5. 면책 조항' : isJa ? '5. 免責事項' : '5. Disclaimer'}>
              {isKo ? (
                <p>
                  BanaNyang는 현재 상태("AS IS")로 제공되며, 명시적 또는 묵시적 보증 없이 제공됩니다.
                  AI 생성 결과물의 품질, 정확성, 저작권에 대해 회사는 책임을 지지 않습니다.
                  소프트웨어 사용으로 인한 직접적 또는 간접적 손해에 대해 회사의 최대 책임은 구매 금액을 초과하지 않습니다.
                </p>
              ) : isJa ? (
                <p>
                  BanaNyangは現状のまま（"AS IS"）提供され、明示的または黙示的な保証なしに提供されます。
                  AI生成結果の品質、正確性、著作権について当社は責任を負いません。
                  ソフトウェアの使用による直接的または間接的損害に対する当社の最大責任は購入金額を超えません。
                </p>
              ) : (
                <p>
                  BanaNyang is provided "AS IS" without warranties of any kind, either express or implied.
                  We are not responsible for the quality, accuracy, or copyright status of AI-generated content.
                  Our maximum liability for any damages arising from use of the software shall not exceed the purchase price.
                </p>
              )}
            </Section>

            <Section title={isKo ? '6. 약관 변경' : isJa ? '6. 規約の変更' : '6. Changes to Terms'}>
              {isKo
                ? '회사는 필요에 따라 본 약관을 변경할 수 있으며, 변경 시 공식 웹사이트에 공지합니다. 변경 후 계속 사용하면 변경된 약관에 동의하는 것으로 간주됩니다.'
                : isJa
                  ? '当社は必要に応じて本規約を変更することがあり、変更時は公式ウェブサイトでお知らせします。変更後も引き続きご利用の場合、変更された規約に同意したものとみなされます。'
                  : 'We may update these terms as needed and will post changes on our official website. Continued use of the software after changes constitutes acceptance of the updated terms.'}
            </Section>

            <Section title={isKo ? '7. 문의처' : isJa ? '7. お問い合わせ先' : '7. Contact'}>
              <p>
                {isKo ? '이용약관 관련 문의:'
                  : isJa ? '利用規約に関するお問い合わせ：'
                    : 'For terms-related inquiries:'}
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
