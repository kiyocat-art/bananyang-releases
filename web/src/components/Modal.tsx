'use client';

import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  maxWidth?: number;
}

export function Modal({ isOpen, onClose, title, children, ariaLabel, maxWidth = 420 }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="notify-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="notify-modal-dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        style={{ maxWidth }}
      >
        <button className="notify-modal-close" onClick={onClose} aria-label="Close">✕</button>
        {title && <h3 className="notify-modal-title">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
