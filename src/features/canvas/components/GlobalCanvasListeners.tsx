import React, { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../../store/canvasStore';
import { useGenerationStore } from '../../../store/generationStore';
import { isShortcut } from '../../../hooks/useShortcuts';
import { translateToEnglish } from '../../../services/geminiService';
import { useToolbarStore } from '../../../features/toolbar/useToolbarStore';

interface GlobalCanvasListenersProps {
    onSaveWorkspace: () => void;
    // FIX: Add onSaveWorkspaceAs to props
    onSaveWorkspaceAs: () => void;
    onLoadWorkspace: (content?: string, filePath?: string) => void;
    // FIX: Add isModalOpen to props
    isModalOpen: boolean;
}
export const GlobalCanvasListeners: React.FC<GlobalCanvasListenersProps> = ({ onSaveWorkspace, onSaveWorkspaceAs, onLoadWorkspace, isModalOpen }) => {
    // Use a ref to always access the latest store state without re-registering listeners
    const storeRef = useRef(useCanvasStore.getState());
    useEffect(() => {
        return useCanvasStore.subscribe(state => { storeRef.current = state; });
    }, []);

    // Keep callbacks in a ref so the keydown effect doesn't need them as dependencies
    const callbacksRef = useRef({ onSaveWorkspace, onSaveWorkspaceAs, onLoadWorkspace });
    useEffect(() => { callbacksRef.current = { onSaveWorkspace, onSaveWorkspaceAs, onLoadWorkspace }; });

    const setIsShiftDown = useCanvasStore(state => state.setIsShiftDown);

    const lastSpaceTime = useRef<number>(0);
    const spaceCount = useRef<number>(0);

    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (isModalOpen || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const { deleteSelection, setSelectedImageIds, setSelectedGroupIds, clearRoleForSelection, clearActiveReferenceRole, boardImages, selectedImageIds, selectedGroupIds, activeReferenceIndex, groupEditModeId, setGroupEditModeId, alignSelection, groupSelection, ungroupSelection, undo, redo, memos, selectedMemoIds, updateMemo, deleteMemo, activeKeyboardContext, setMergeGroupsModalOpen } = storeRef.current;
            const { onSaveWorkspace, onSaveWorkspaceAs, onLoadWorkspace } = callbacksRef.current;

            // Triple Space Translation Logic
            if (e.key === ' ') {
                const now = Date.now();
                if (now - lastSpaceTime.current < 500) {
                    spaceCount.current += 1;
                } else {
                    spaceCount.current = 1;
                }
                lastSpaceTime.current = now;

                if (spaceCount.current === 3) {
                    e.preventDefault();
                    spaceCount.current = 0; // Reset

                    if (selectedMemoIds.size === 1) {
                        const memoId = Array.from(selectedMemoIds)[0];
                        const memo = memos.find(m => m.id === memoId);
                        if (memo && memo.text) {
                            try {
                                const translated = await translateToEnglish(memo.text);
                                updateMemo(memoId, { text: translated });
                            } catch (error) {
                                console.error("Translation failed via shortcut:", error);
                            }
                        }
                    }
                    return;
                }
            } else {
                // Reset if any other key is pressed
                spaceCount.current = 0;
            }

            if (isShortcut(e, 'editGroup')) {
                if (activeKeyboardContext !== 'canvas') return; // Context Check
                e.preventDefault();
                if (groupEditModeId) {
                    setGroupEditModeId(null);
                } else if (selectedGroupIds.size === 1) {
                    const groupId = Array.from(selectedGroupIds)[0];
                    setGroupEditModeId(groupId);
                }
            } else if (isShortcut(e, 'deleteSelection')) {
                if (activeKeyboardContext !== 'canvas') return; // Context Check
                if (selectedMemoIds.size > 0) {
                    selectedMemoIds.forEach(id => deleteMemo(id));
                }
                if (selectedImageIds.size > 0 || selectedGroupIds.size > 0) {
                    deleteSelection();
                }
            } else if (isShortcut(e, 'alignSelection')) {
                if (activeKeyboardContext !== 'canvas') return; // Context Check
                e.preventDefault();
                alignSelection();
            } else if (isShortcut(e, 'mergeGroups')) {
                if (activeKeyboardContext !== 'canvas') return;
                e.preventDefault();
                if (selectedGroupIds.size >= 2) {
                    setMergeGroupsModalOpen(true);
                }
            } else if (isShortcut(e, 'toggleGroup')) {
                if (activeKeyboardContext !== 'canvas') return; // Context Check
                e.preventDefault();
                if (selectedGroupIds.size > 0) {
                    ungroupSelection();
                } else {
                    groupSelection();
                }
            } else if (isShortcut(e, 'cancel')) {
                e.preventDefault();

                // 툴바 팝오버가 열려있으면 팝오버만 닫고 역할 해제는 하지 않음
                const { activeToolId, setActiveToolId } = useToolbarStore.getState();
                if (activeToolId !== null) {
                    setActiveToolId(null);
                    return;
                }

                if (groupEditModeId) {
                    setGroupEditModeId(null);
                    return;
                }
                const selectionHasRoles = Array.from(selectedImageIds).some(id => {
                    const img = boardImages.find(i => i.id === id);
                    return img && img.role !== 'none';
                });

                if (selectedImageIds.size > 0) {
                    if (selectionHasRoles) clearRoleForSelection();
                    else setSelectedImageIds(() => new Set());
                } else if (selectedGroupIds.size > 0) {
                    setSelectedGroupIds(() => new Set());
                } else if (activeReferenceIndex !== null) {
                    clearActiveReferenceRole();
                } else {
                    // 캔버스에 선택된 것이 없으면 생성 버튼 상태 초기화
                    const { selectedAiEditAction, editGuideImage, setSelectedAiEditAction, setEditGuideImage } = useGenerationStore.getState();
                    if (selectedAiEditAction || editGuideImage) {
                        setSelectedAiEditAction(null);
                        setEditGuideImage(null);
                    }
                }
            } else if (isShortcut(e, 'saveWorkspaceAs')) {
                e.preventDefault();
                onSaveWorkspaceAs();
            } else if (isShortcut(e, 'saveWorkspace')) {
                e.preventDefault();
                onSaveWorkspace();
            } else if (isShortcut(e, 'loadWorkspace')) {
                e.preventDefault();
                onLoadWorkspace();
            } else if (isShortcut(e, 'undoDrawing')) {
                if (activeKeyboardContext !== 'canvas') return; // Context Check
                if (useToolbarStore.getState().activeToolId === 'object') return; // ObjectTab handles its own undo
                e.preventDefault();
                undo();
            } else if (isShortcut(e, 'redoDrawing')) {
                if (activeKeyboardContext !== 'canvas') return; // Context Check
                if (useToolbarStore.getState().activeToolId === 'object') return; // ObjectTab handles its own redo
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isModalOpen]);
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftDown(true);
        };
        const handleGlobalKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftDown(false);
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
        };
    }, [setIsShiftDown]);

    return null; // This component does not render anything
};