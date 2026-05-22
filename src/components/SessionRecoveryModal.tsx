/**
 * Session Recovery Modal
 * Displays recoverable sessions from previous app crashes/closes
 * and allows users to restore their work
 */

import React, { useEffect, useRef, useState } from 'react';
import { t, Language, TranslationKey } from '../localization';
import { Z_INDEX } from '../constants/zIndex';
import { HoverEdgeAutoScroll } from './HoverEdgeAutoScroll';

interface RecoverableSession {
    id: string;
    createdAt: number;
    fileCount: number;
    sizeBytes: number;
    thumbnails: string[];
    workspaceFile: string | null;
}

interface SessionRecoveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRecover: (sessionId: string) => Promise<void>;
    language: Language;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeAgo(timestamp: number, language: Language): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (language === 'ko') {
        if (days > 0) return `${days}일 전`;
        if (hours > 0) return `${hours}시간 전`;
        if (minutes > 0) return `${minutes}분 전`;
        return '방금 전';
    } else {
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }
}

export const SessionRecoveryModal: React.FC<SessionRecoveryModalProps> = ({
    isOpen,
    onClose,
    onRecover,
    language,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [sessions, setSessions] = useState<RecoverableSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [recovering, setRecovering] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen]);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.getRecoverableSessions();
            if (result.success) {
                setSessions(result.sessions);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRecover = async (sessionId: string) => {
        setRecovering(sessionId);
        try {
            await onRecover(sessionId);
            // Remove recovered session from list
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (sessions.length === 1) {
                onClose();
            }
        } finally {
            setRecovering(null);
        }
    };

    const handleDelete = async (sessionId: string) => {
        const confirmMsg = t('sessionRecovery.deleteConfirm' as TranslationKey, language);

        if (!confirm(confirmMsg)) {
            return;
        }

        setDeleting(sessionId);
        try {
            await window.electronAPI.deleteSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (sessions.length === 1) {
                onClose();
            }
        } finally {
            setDeleting(null);
        }
    };

    const handleDeleteAll = async () => {
        const confirmMsg = t('sessionRecovery.deleteAllConfirm' as TranslationKey, language);

        if (!confirm(confirmMsg)) {
            return;
        }

        for (const session of sessions) {
            await window.electronAPI.deleteSession(session.id);
        }
        setSessions([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center" style={{ zIndex: Z_INDEX.SESSION_RECOVERY }}>
            <div className="glass-dialog w-[600px] max-h-[80vh] rounded-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚠️</span>
                        <h2 className="text-lg font-bold text-white">
                            {t('sessionRecovery.title' as TranslationKey, language)}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 relative min-h-0">
                <div ref={scrollRef} className="h-full overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            {t('sessionRecovery.noSessions' as TranslationKey, language)}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-zinc-400 mb-4">
                                {t('sessionRecovery.description' as TranslationKey, language)}
                            </p>

                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                </svg>
                                                <span className="font-medium text-white">
                                                    {t('sessionRecovery.session' as TranslationKey, language)} {new Date(session.createdAt).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US')}
                                                </span>
                                            </div>
                                            <div className="text-sm text-zinc-400 mt-1">
                                                {`${t('sessionRecovery.imageCount' as TranslationKey, language, { count: session.fileCount })} (${formatBytes(session.sizeBytes)}) · ${formatTimeAgo(session.createdAt, language)}`}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Thumbnails */}
                                    {session.thumbnails.length > 0 && (
                                        <div className="flex gap-2 mb-3">
                                            {session.thumbnails.map((thumb, i) => (
                                                <div
                                                    key={i}
                                                    className="w-16 h-16 rounded-lg overflow-hidden bg-black/30 border border-white/5"
                                                >
                                                    <img
                                                        src={thumb}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ))}
                                            {session.fileCount > 4 && (
                                                <div className="w-16 h-16 rounded-lg bg-black/30 flex items-center justify-center text-sm text-zinc-400 border border-white/5">
                                                    +{session.fileCount - 4}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDelete(session.id)}
                                            disabled={deleting === session.id || recovering === session.id}
                                            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                        >
                                            {deleting === session.id
                                                ? t('sessionRecovery.deleting' as TranslationKey, language)
                                                : t('sessionRecovery.delete' as TranslationKey, language)}
                                        </button>
                                        <button
                                            onClick={() => handleRecover(session.id)}
                                            disabled={recovering === session.id || deleting === session.id}
                                            className="px-3 py-1.5 text-sm rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium transition-colors disabled:opacity-50"
                                        >
                                            {recovering === session.id
                                                ? t('sessionRecovery.recovering' as TranslationKey, language)
                                                : t('sessionRecovery.recover' as TranslationKey, language)}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <HoverEdgeAutoScroll targetRef={scrollRef} />
                </div>

                {/* Footer */}
                {sessions.length > 0 && (
                    <div className="flex flex-col gap-2 px-6 py-4 border-t border-white/10">
                        <span className="text-xs text-zinc-500">
                            {t('sessionRecovery.tip' as TranslationKey, language)}
                        </span>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={handleDeleteAll}
                                className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                            >
                                {t('sessionRecovery.deleteAll' as TranslationKey, language)}
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                {t('sessionRecovery.later' as TranslationKey, language)}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SessionRecoveryModal;
