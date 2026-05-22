'use client';

import type { PatchNote } from '@/lib/patchNotes';

interface PatchNoteCardProps {
  note: PatchNote;
  onClick: () => void;
  viewDetailLabel: string;
}

export function PatchNoteCard({ note, onClick, viewDetailLabel }: PatchNoteCardProps) {
  return (
    <div className="patch-note-card" onClick={onClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}>
      <span className="patch-note-version">v{note.version}</span>
      <p className="patch-note-date">{note.date}</p>
      <h3 className="patch-note-title">{note.title}</h3>
      <p className="patch-note-summary">{note.summary}</p>
      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--accent-yellow)', fontWeight: 500 }}>{viewDetailLabel} →</p>
    </div>
  );
}
