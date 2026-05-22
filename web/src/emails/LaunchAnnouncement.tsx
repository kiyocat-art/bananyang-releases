/* ─────────────────────────────────────────────────────────────────────────────
   Launch announcement — broadcast email when the app goes live.
   ───────────────────────────────────────────────────────────────────────────── */

import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, styles, colors } from './components/EmailLayout';

export interface LaunchAnnouncementProps {
  siteUrl: string;
  logoUrl: string;
  unsubscribeUrl: string;
}

export function LaunchAnnouncement({
  siteUrl,
  logoUrl,
  unsubscribeUrl,
}: LaunchAnnouncementProps) {
  const ctaUrl = `${siteUrl}/?utm_source=launch_email&utm_medium=email&utm_campaign=launch`;

  return (
    <EmailLayout
      preview="BanaNyang is now available. Lifetime license, one-time payment."
      logoUrl={logoUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <div style={styles.accentBar} />
      <Text style={styles.heading}>BanaNyang is here.</Text>

      <Text style={styles.paragraph}>
        The wait is over — BanaNyang is now available for download. Bring your own Gemini API key,
        and start generating, editing, and iterating on images in a workspace built for serious use.
      </Text>

      <Text style={styles.paragraphMuted}>
        One-time purchase. No subscription, no recurring fee. You only pay Google for the images
        you actually generate.
      </Text>

      <Section style={{ margin: '32px 0 8px 0' }}>
        <Button href={ctaUrl} style={styles.ctaButton}>
          Get BanaNyang →
        </Button>
      </Section>

      <Text
        style={{
          ...styles.paragraphMuted,
          fontSize: '13px',
          color: colors.textMuted,
          margin: '24px 0 0 0',
        }}
      >
        Thank you for waiting with us. We hope BanaNyang earns a permanent spot in your workflow.
      </Text>
    </EmailLayout>
  );
}

export default LaunchAnnouncement;
