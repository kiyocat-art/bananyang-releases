'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { PageShell } from '@/components/PageShell';
import { PatchNoteCard } from '@/components/PatchNoteCard';
import { PatchModal } from '@/components/PatchModal';
import { PATCH_NOTES, type PatchNote } from '@/lib/patchNotes';

export default function ChangelogPage() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<PatchNote | null>(null);

  return (
    <PageShell>
      <section className="content-section">
        <div className="section-label animate-fade-in-up" style={{ justifyContent: 'center' }}>
          <span className="accent-dot" />
          {t.changelog.title}
        </div>
        <h2 className="section-headline animate-fade-in-up" style={{ textAlign: 'center' }}>
          {t.changelog.subtitle}
        </h2>

        {PATCH_NOTES.length === 0 ? (
          <div className="changelog-empty">
            <div style={{ fontSize: 40, marginBottom: 20 }}>🍌</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{t.changelog.empty}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{t.changelog.emptyDesc}</p>
          </div>
        ) : (
          <div className="patch-note-grid" style={{ marginTop: 40 }}>
            {PATCH_NOTES.map(note => (
              <PatchNoteCard
                key={note.id}
                note={note}
                onClick={() => setSelected(note)}
                viewDetailLabel={t.changelog.viewDetail}
              />
            ))}
          </div>
        )}
      </section>

      <PatchModal
        note={selected}
        onClose={() => setSelected(null)}
        closeLabel={t.changelog.close}
      />
    </PageShell>
  );
}
