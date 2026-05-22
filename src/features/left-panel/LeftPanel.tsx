import React, { useState, useRef, useEffect, memo } from 'react';
import { GeneratedMedia, GenerationTask, MonthlyCredit, GenerationParams } from '../../types';
import { t, Language } from '../../localization';
import { HistoryView } from './components/HistoryView';

import { Tooltip } from '../../components/Tooltip';
import { PencilIcon } from '../../components/icons';
import { useSettingsStore } from '../../store/settingsStore';

interface LeftPanelProps {
    language: Language;
    monthlyCredit: MonthlyCredit;
    manualUsedCredit: number | '';
    onManualUsedCreditChange: (value: string) => void;
    onUpdateCredit: () => void;
    onCreditInputBlur: () => void;
    isProcessing: boolean;
    isPaused: boolean;
    generationQueue: GenerationTask[];
    onCancelAll: () => void;
    onCancelSingleTask: (taskId: string) => void;
    onPauseGeneration: () => void;
    onResumeGeneration: () => void;
    allHistoryMedia: GeneratedMedia[];
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    onSelectSaveDirectory: () => void;
    onOpenSaveDirectory: () => void;
    onSetSaveDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
    selectedMediaIds: Set<string>;
    onSelectAllToggle: () => void;
    onDownloadSelectedMedia: () => void;
    onDeleteSelectedMedia: () => void;
    currentMedia: GeneratedMedia[];
    onHistoryDragStart: (e: React.DragEvent<HTMLElement>, media: GeneratedMedia) => void;
    onToggleMediaSelection: (id: string) => void;
    onZoomImage: (media: GeneratedMedia | string) => void;
    onDownload: (e: React.MouseEvent, media: GeneratedMedia) => void;
    downloadStatus: Record<string, 'downloading' | 'success'>;
    downloadedImageIds: Set<string>;
    totalPages: number;
    currentPage: number;
    onSetCurrentPage: (page: number | ((prev: number) => number)) => void;
    leftPanelWidth: number;
    onUpdateTotalCredit: (newTotal: number) => void;
    onLoadGenerationParams: (params: GenerationParams) => void;
    onNotification: (message: string, type: 'success' | 'error') => void;
    onReorderQueue?: (ids: string[]) => void;
    onSelectSourceImage?: (mediaId: string) => void;
}


// Memoized to prevent re-renders during canvas zoom/pan operations
export const LeftPanel = memo<LeftPanelProps>((props) => {
    const {
        language, monthlyCredit, manualUsedCredit, onManualUsedCreditChange,
        onUpdateCredit, onCreditInputBlur, leftPanelWidth, onUpdateTotalCredit
    } = props;

    const monthlyCreditPercentage = monthlyCredit.total > 0 ? Math.min(100, (monthlyCredit.current / monthlyCredit.total) * 100) : 0;
    const [isEditingTotalCredit, setIsEditingTotalCredit] = useState(false);
    const [totalCreditInput, setTotalCreditInput] = useState(monthlyCredit.total.toString());
    const totalCreditInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isEditingTotalCredit) {
            setTotalCreditInput(monthlyCredit.total.toString());
        }
    }, [monthlyCredit.total, isEditingTotalCredit]);

    useEffect(() => {
        if (isEditingTotalCredit) {
            totalCreditInputRef.current?.focus();
            totalCreditInputRef.current?.select();
        }
    }, [isEditingTotalCredit]);

    const handleTotalCreditUpdate = () => {
        const newTotal = parseFloat(totalCreditInput);
        if (!isNaN(newTotal) && newTotal >= 0) {
            onUpdateTotalCredit(newTotal);
        } else {
            setTotalCreditInput(monthlyCredit.total.toFixed(2));
        }
        setIsEditingTotalCredit(false);
    };

    const showCreditInLeftPanel = useSettingsStore(state => state.showCreditInLeftPanel);

    return (
        <div className="flex flex-col h-full">
            {showCreditInLeftPanel && (
                <div className="flex-shrink-0 p-4 pb-2 space-y-3">


                    <div className="space-y-2">
                        <Tooltip tip={t('tooltip.monthlyCreditProgressBar', language)} className="w-full">
                            <div className="relative w-full bg-neutral-900/50 rounded-md h-5 overflow-hidden border border-white/10">
                                {/* White text on dark background */}
                                <div className="absolute inset-0 flex justify-between items-center px-3">
                                    <span className="text-xs text-white font-bold tracking-wide">크레딧</span>
                                    <span className="text-xs text-white font-bold font-mono">
                                        ${monthlyCredit.current.toFixed(2)} / {' '}
                                        {isEditingTotalCredit ? (
                                            <input
                                                ref={totalCreditInputRef}
                                                type="text"
                                                value={totalCreditInput}
                                                onChange={(e) => setTotalCreditInput(e.target.value.replace(/[^0-9.]/g, ''))}
                                                onBlur={handleTotalCreditUpdate}
                                                onKeyDown={(e) => e.key === 'Enter' && handleTotalCreditUpdate()}
                                                className="w-20 bg-neutral-700 border border-neutral-500 rounded-md py-0 px-1 text-xs font-mono text-zinc-100 text-right outline-none"
                                            />
                                        ) : (
                                            <Tooltip tip={t('tooltip.editTotalCredit', language)} position="top">
                                                <button onClick={() => setIsEditingTotalCredit(true)} className="inline-flex items-center gap-1">
                                                    ${monthlyCredit.total.toFixed(2)}
                                                    <PencilIcon className="w-3 h-3 text-zinc-400" />
                                                </button>
                                            </Tooltip>
                                        )}
                                        <span className="ml-2 opacity-70">({Math.round(monthlyCreditPercentage)}%)</span>
                                    </span>
                                </div>
                                {/* Progress bar with clipped black text */}
                                <div
                                    className="absolute top-0 left-0 h-full bg-yellow-400 overflow-hidden"
                                    style={{ width: `${monthlyCreditPercentage}%`, transition: 'width 0.5s ease-in-out' }}
                                >
                                    <div className="h-full flex justify-between items-center px-3" style={{ width: `${Math.max(0, leftPanelWidth - 32)}px` }}>
                                        <span className="text-xs text-black font-bold tracking-wide">크레딧</span>
                                        <span className="text-xs text-black font-bold font-mono whitespace-nowrap">
                                            ${monthlyCredit.current.toFixed(2)} / ${monthlyCredit.total.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Tooltip>
                        <Tooltip tip={t('tooltip.creditAdjustment', language)} className="w-full">
                            <div className="flex items-center justify-between gap-2">
                                <label htmlFor="used-credit-input" className="text-sm text-zinc-300 whitespace-nowrap">{t('creditAdjustment.usedAmount', language)}</label>
                                <div className="flex items-center gap-2">
                                    <input id="used-credit-input" type="number" value={manualUsedCredit} onChange={(e) => onManualUsedCreditChange(e.target.value)} onBlur={onCreditInputBlur} className="w-24 bg-neutral-900 border border-neutral-600 rounded-md py-1 px-2 text-sm font-mono text-zinc-200 text-right focus:ring-1 focus:ring-white focus:border-white outline-none" />
                                    <button onClick={onUpdateCredit} className="px-3 py-1 text-sm font-semibold text-zinc-800 bg-white hover:bg-zinc-200 rounded-md transition-colors">{t('creditAdjustment.updateButton', language)}</button>
                                </div>
                            </div>
                        </Tooltip>
                    </div>
                    <hr className="border-white/10" />
                </div>
            )}

            {/* History view only - no tabs needed */}
            <HistoryView {...props} />
        </div>
    );
});