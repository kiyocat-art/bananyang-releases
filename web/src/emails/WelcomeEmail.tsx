/* ─────────────────────────────────────────────────────────────────────────────
   Welcome email — sent on signup. English copy with feature breakdown.
   ───────────────────────────────────────────────────────────────────────────── */

import { Section, Text, Link } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, styles, colors, fontStack } from './components/EmailLayout';

export interface WelcomeEmailProps {
  siteUrl: string;
  logoUrl: string;
  unsubscribeUrl: string;
}

export function WelcomeEmail({ siteUrl, logoUrl, unsubscribeUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout
      preview="You're on the BanaNyang waitlist — we'll email you the moment the app is ready."
      logoUrl={logoUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <div style={styles.accentBar} />
      <Text style={styles.heading}>Welcome aboard!</Text>

      <Text style={styles.paragraph}>
        Thank you for signing up. You're now officially on the BanaNyang waitlist.
      </Text>

      <Text style={styles.paragraph}>
        BanaNyang is a powerful desktop AI image workspace, optimized for professional workflows.
      </Text>

      {/* Feature blocks */}
      <Section style={featureBlock}>
        <Text style={featureHeading}>💸 No middleman fees, pay only for what you use</Text>
        <Text style={featureBody}>
          Connect your own API keys for Gemini, OpenAI, Flux, and any other AI model you prefer.
          Unlike other SaaS platforms, there are no monthly subscriptions and no middleman fees —
          you pay only the model's list price for exactly what you generate and use.
        </Text>
      </Section>

      <Section style={featureBlock}>
        <Text style={featureHeading}>🎨 Infinite canvas with expert-level editing</Text>
        <Text style={featureBody}>
          Spread your ideas freely across a truly limitless canvas. Detailed, expert-level image
          generation and editing — without the usual complexity.
        </Text>
      </Section>

      <Section style={featureBlock}>
        <Text style={featureHeading}>💻 Desktop-first, with full local control</Text>
        <Text style={featureBody}>
          No more loading a web app and logging in every time. As a native desktop application,
          BanaNyang lets you manage local files and organize images quickly and intuitively —
          the most comfortable, friction-free environment for professionals who actually ship work.
        </Text>
      </Section>

      <Text style={{ ...styles.paragraphMuted, marginTop: 28 }}>
        We'll email you the moment the app is available to download. No spam, no marketing blasts
        — only the important launch news, delivered cleanly.
      </Text>

      <Section style={{ margin: '24px 0 4px 0' }}>
        <Link href={siteUrl} style={styles.secondaryLink}>
          Visit bananyang.app →
        </Link>
      </Section>
    </EmailLayout>
  );
}

export default WelcomeEmail;

const featureBlock: React.CSSProperties = {
  margin: '18px 0',
  paddingLeft: '16px',
  borderLeft: `2px solid ${colors.accent}`,
};

const featureHeading: React.CSSProperties = {
  color: colors.text,
  fontSize: '15px',
  fontWeight: 600,
  lineHeight: '22px',
  margin: '0 0 6px 0',
  fontFamily: fontStack,
};

const featureBody: React.CSSProperties = {
  color: colors.textSecondary,
  fontSize: '14px',
  lineHeight: '22px',
  margin: 0,
  fontFamily: fontStack,
};
