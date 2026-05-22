/* ─────────────────────────────────────────────────────────────────────────────
   Shared dark email shell — matches bananyang.app design tokens.
   Inline styles only (email clients drop most CSS).
   ───────────────────────────────────────────────────────────────────────────── */

import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export const colors = {
  bg: '#0d0d0d',
  card: '#161616',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f0f0f0',
  textSecondary: '#a0a0a0',
  textMuted: '#5a5a5a',
  accent: '#f5c542',
  accentText: '#1a1a1a',
} as const;

export const fontStack = `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;

interface EmailLayoutProps {
  preview: string;
  logoUrl: string;
  unsubscribeUrl?: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, logoUrl, unsubscribeUrl, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa05L7.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header — logo */}
          <Section style={{ padding: '32px 0 8px 0', textAlign: 'center' as const }}>
            <Img
              src={logoUrl}
              width="44"
              height="44"
              alt="BanaNyang"
              style={{ display: 'inline-block', borderRadius: '10px' }}
            />
          </Section>

          {/* Body */}
          <Section style={cardStyle}>{children}</Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              You're receiving this email because you signed up at{' '}
              <Link href="https://bananyang.app" style={footerLinkStyle}>
                bananyang.app
              </Link>{' '}
              for launch notifications.
            </Text>
            {unsubscribeUrl && (
              <Text style={footerTextStyle}>
                <Link href={unsubscribeUrl} style={footerLinkStyle}>
                  Unsubscribe
                </Link>
              </Text>
            )}
            <Hr style={hrStyle} />
            <Text style={footerCopyrightStyle}>© BanaNyang. All rights reserved.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: colors.bg,
  margin: 0,
  padding: 0,
  fontFamily: fontStack,
  color: colors.text,
  WebkitFontSmoothing: 'antialiased' as const,
};

const containerStyle: React.CSSProperties = {
  maxWidth: '600px',
  width: '100%',
  margin: '0 auto',
  padding: '0 20px 48px 20px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: '14px',
  padding: '40px 36px',
  margin: '20px 0 0 0',
};

const footerStyle: React.CSSProperties = {
  padding: '28px 8px 0 8px',
  textAlign: 'center' as const,
};

const footerTextStyle: React.CSSProperties = {
  color: colors.textMuted,
  fontSize: '12px',
  lineHeight: '18px',
  margin: '4px 0',
  fontFamily: fontStack,
};

const footerLinkStyle: React.CSSProperties = {
  color: colors.textSecondary,
  textDecoration: 'underline',
};

const hrStyle: React.CSSProperties = {
  border: 'none',
  borderTop: `1px solid ${colors.border}`,
  margin: '20px 0 14px 0',
};

const footerCopyrightStyle: React.CSSProperties = {
  color: colors.textMuted,
  fontSize: '11px',
  margin: '0',
  fontFamily: fontStack,
};

/* ─── Shared element styles (re-exported for templates) ─── */
export const styles = {
  heading: {
    color: colors.text,
    fontSize: '28px',
    fontWeight: 600,
    lineHeight: '36px',
    margin: '0 0 16px 0',
    fontFamily: fontStack,
    letterSpacing: '-0.01em',
  } as React.CSSProperties,
  accentBar: {
    width: '36px',
    height: '3px',
    backgroundColor: colors.accent,
    borderRadius: '2px',
    margin: '0 0 24px 0',
  } as React.CSSProperties,
  paragraph: {
    color: colors.text,
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 18px 0',
    fontFamily: fontStack,
  } as React.CSSProperties,
  paragraphMuted: {
    color: colors.textSecondary,
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0 0 18px 0',
    fontFamily: fontStack,
  } as React.CSSProperties,
  ctaButton: {
    backgroundColor: colors.accent,
    color: colors.accentText,
    padding: '14px 28px',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-block',
    fontFamily: fontStack,
    letterSpacing: '0.01em',
  } as React.CSSProperties,
  secondaryLink: {
    color: colors.accent,
    fontSize: '14px',
    textDecoration: 'none',
    fontFamily: fontStack,
  } as React.CSSProperties,
};
