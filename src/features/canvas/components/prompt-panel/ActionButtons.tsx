import React, { useMemo, useState, useCallback } from 'react';
import { AiAction } from '../../../../types';
import { t, Language, TranslationKey } from '../../../../localization';
import { Tooltip } from '../../../../components/Tooltip';
import { LoadingSpinner } from '../../../../components/LoadingSpinner';
import { hasValidAuth } from '../../../../services/geminiService';
import { useAuthStore } from '../../../../store/authStore';
import { useSettingsStore } from '../../../../store/settingsStore';
import { useToolbarStore } from '../../../toolbar/useToolbarStore';
import { useCanvasStore } from '../../../../store/canvasStore';
import { useWorkspaceTabsStore } from '../../../../store/workspaceTabsStore';

interface ActionButtonsProps {
    canGenerate: boolean;
    showSpinner: boolean;
    showProgressBar: boolean;
    handleDoQueue: () => void;
    language: Language;
    selectedAiEditAction: AiAction | null;
    isAutoColoringActive?: boolean;
    isVariationActive?: boolean;
    generationQueueLength: number;
    isProcessing: boolean;
    modelName: string;
    isEditorOpen?: boolean;
    editorMode?: 'crop' | 'expand' | 'generate' | 'object' | 'relight' | 'pbr' | 'inpaint' | null;
    inpaintModelUnsupported?: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
    canGenerate, showSpinner, showProgressBar, handleDoQueue, language,
    selectedAiEditAction, isAutoColoringActive, isVariationActive,
    generationQueueLength, isProcessing, modelName, isEditorOpen, editorMode,
    inpaintModelUnsupported,
}) => {
    const { authState, openLoginModal } = useAuthStore();
    const isLoginState = authState === 'login';
    const autoClosePopoverOnGenerate = useSettingsStore(state => state.autoClosePopoverOnGenerate);

    const [isPressed, setIsPressed] = useState(false);
    const triggerPressAnimation = useCallback(() => {
        setIsPressed(false);
        requestAnimationFrame(() => {
            setIsPressed(true);
            setTimeout(() => setIsPressed(false), 400);
        });
    }, []);

    const inpaintMode = useCanvasStore(s => s.inpaintMode);
    const isWorkspaceLoading = useWorkspaceTabsStore(s => {
        const id = s.activeTabId;
        if (!id) return false;
        return !!s.tabs.find(t => t.id === id)?.loadingState;
    });

    const buttonText = useMemo(() => {
        // 비로그인 상태: 로그인 버튼으로 표시
        if (isLoginState) {
            return t('account.login' as TranslationKey, language);
        }
        // When editor is open, show button based on mode
        if (isEditorOpen && editorMode) {
            if (editorMode === 'crop') {
                return '크롭'; // Crop only (no AI)
            }
            if (editorMode === 'expand') {
                return t('aiEdit.expand', language);
            }
            if (editorMode === 'object') {
                // [User Request] "객체삽입 생성"
                return `${t('aiEdit.insertObject', language)} ${t('editModal.generate', language)}`;
            }
            if (editorMode === 'relight') {
                return t('aiEdit.relight', language);
            }
            if (editorMode === 'pbr') {
                return t('aiEdit.pbr', language);
            }
            if (editorMode === 'inpaint') {
                // remove 모드: "AI 제거", insert 모드: "인페인팅"
                return inpaintMode === 'remove'
                    ? (language === 'ko' ? 'AI 제거' : 'AI Remove')
                    : t('aiEdit.inpainting', language);
            }
            return '생성'; // Fallback
        }
        if (isAutoColoringActive && isVariationActive) {
            return language === 'ko' ? '자동채색 + 베리에이션' : 'Auto Color + Variation';
        }
        if (isAutoColoringActive) return t('aiEdit.run.autoColoring', language);
        if (isVariationActive) return t('aiEdit.run.variation', language);
        if (selectedAiEditAction) {
            const keyMap: Record<AiAction, TranslationKey> = {
                'removeBackground': 'aiEdit.run.removeBackground',
                'keepBackgroundOnly': 'aiEdit.run.keepBackgroundOnly',
                'extractPose': 'aiEdit.run.extractPose',
                'autoColoring': 'aiEdit.run.autoColoring',
                'extractOutfit': 'aiEdit.run.extractOutfit',
                'variation': 'aiEdit.run.variation',
                'insertObject': 'aiEdit.run.insertObject',
                'expand': 'aiEdit.run.expand',
                'relight': 'aiEdit.run.relight',
                'pbr': 'aiEdit.run.pbr',
                'pbr_advanced': 'aiEdit.run.pbr',  // Uses same translation as pbr
                'inpainting': 'aiEdit.run.inpainting',
                'inpaintInsert': 'aiEdit.run.inpainting',
                'inpaintRemove': 'aiEdit.run.inpainting'
            };
            return t(keyMap[selectedAiEditAction], language);
        }
        if (generationQueueLength > 0 || isProcessing) {
            return t('queue.addToQueue', language);
        }
        return t('generateButton', language);
    }, [isLoginState, selectedAiEditAction, isAutoColoringActive, isVariationActive, isProcessing, generationQueueLength, language, isEditorOpen, editorMode, inpaintMode]);

    const getGenerationTooltip = () => {
        if (isWorkspaceLoading) {
            return language === 'ko' ? '워크스페이스 로딩 중' : 'Workspace loading…';
        }
        if (isLoginState) return t('account.login' as TranslationKey, language);
        if (inpaintModelUnsupported) return t('inpaint.unsupported_model.button_tooltip', language);
        if (!hasValidAuth()) return t('error.apiKeyMissing', language);
        if (!modelName.trim()) return t('error.modelNameMissing', language);
        // When editor is open, show tooltip based on mode
        if (isEditorOpen && editorMode) {
            if (editorMode === 'crop') {
                return '크롭 (Ctrl + ↵)';
            }
            if (editorMode === 'expand') {
                return `${t('aiEdit.expand', language)} (Ctrl + ↵)`;
            }
            if (editorMode === 'object') {
                return `${t('aiEdit.insertObject', language)} ${t('editModal.generate', language)} (Ctrl + ↵)`;
            }
            if (editorMode === 'relight') {
                return `${t('aiEdit.relight', language)} (Ctrl + ↵)`;
            }
            if (editorMode === 'pbr') {
                return `${t('aiEdit.pbr', language)} (Ctrl + ↵)`;
            }
            if (editorMode === 'inpaint') {
                return `${t('aiEdit.inpainting', language)} (Ctrl + ↵)`;
            }
            return '생성 (Ctrl + ↵)';
        }
        if (!canGenerate) return t('error.noOptionsSelected', language);
        return `${t('generateButton', language)} (Ctrl + ↵)`;
    };

    // 비로그인 상태: 버튼 활성화 (클릭 시 로그인 팝업)
    // When editor is open, force enable button (ignore canGenerate)
    const isButtonDisabled = isWorkspaceLoading
        ? true
        : isLoginState
            ? showSpinner
            : isEditorOpen
                ? showSpinner
                : (!canGenerate || showSpinner);

    const buttonBaseClass = "relative overflow-hidden flex-shrink-0 flex items-center justify-center gap-2 px-8 h-12 rounded-[20px] font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";

    const buttonClass = `${buttonBaseClass} bg-gradient-to-b from-yellow-300 to-yellow-500 text-black border border-yellow-200/50 shadow-[0_8px_20px_-6px_rgba(250,204,21,0.5)] hover:shadow-[0_12px_24px_-8px_rgba(250,204,21,0.6)]`;

    const handleClick = () => {
        triggerPressAnimation();
        if (isLoginState) {
            openLoginModal();
            return;
        }
        // 인페인트 모드: editor-execute 대신 handleDoQueue() 직접 호출
        // (editor-execute는 crop/object/relight만 처리하며 inpaint는 처리하지 않음)
        if (isEditorOpen && editorMode !== 'inpaint') {
            window.dispatchEvent(new CustomEvent('editor-execute'));
            if (autoClosePopoverOnGenerate) useToolbarStore.getState().setActiveToolId(null);
            return;
        }
        handleDoQueue();
        if (autoClosePopoverOnGenerate) useToolbarStore.getState().setActiveToolId(null);
    };

    return (
        <div className="py-1 pr-1 flex items-center gap-1.5">
            <Tooltip tip={getGenerationTooltip()} position="top">
                <button
                    onClick={handleClick}
                    disabled={isButtonDisabled}
                    className={`${buttonClass} ${isPressed ? 'btn-press-anim' : ''}`}
                >
                    {showProgressBar && (
                        <div
                            className="absolute top-0 left-0 h-full bg-black/15"
                            style={{
                                zIndex: 0,
                                animation: `progress-to-90 ${modelName === 'models/gemini-3-pro-image-preview' ? '52s' : modelName === 'gemini-3.1-flash-image-preview' ? '25s' : '15s'} ease-out forwards`
                            }}
                        ></div>
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {showSpinner ? (
                            <LoadingSpinner className="h-5 w-5 border-black/50" />
                        ) : (
                            <span className="text-sm tracking-wide uppercase">{buttonText}</span>
                        )}
                    </span>
                </button>
            </Tooltip>
        </div>
    );
};
