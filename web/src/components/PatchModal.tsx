'use client';

import { Modal } from '@/components/Modal';
import type { PatchNote } from '@/lib/patchNotes';

interface PatchModalProps {
  note: PatchNote | null;
  onClose: () => void;
  closeLabel: string;
}

export function PatchModal({ note, onClose, closeLabel }: PatchModalProps) {
  if (!note) return null;
  return (
    <Modal
      isOpen={!!note}
      onClose={onClose}
      ariaLabel={note.title}
      maxWidth={560}
    >
      <div style={{ marginBottom: 4 }}>
        <span className="patch-note-version">v{note.version}</span>
        <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>{note.date}</span>
      </div>
      <h3 className="notify-modal-title" style={{ marginTop: 8 }}>{note.title}</h3>
      <div className="patch-modal-content">
        {note.sections.map((section, i) => (
          <div key={i}>
            <h4>{section.heading}</h4>
            <ul>
              {section.bullets.map((bullet, j) => (
                <li key={j}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: 24,
          padding: '9px 20px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          background: 'none',
          color: 'var(--text-secondary)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {closeLabel}
      </button>
    </Modal>
  );
}
