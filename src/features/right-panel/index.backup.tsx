import React, { useEffect, useRef, useMemo, memo } from 'react';
import { GenerationTask } from '../../types';
import { t, Language, TranslationKey } from '../../localization';
import { Tooltip } from '../../components/Tooltip';
import {
    CameraIcon, BodyIcon, PaintBrushIcon, HangerIcon
} from '../../components/icons';
import { useCanvasStore } from '../../store/canvasStore';
import { useGenerationStore } from '../../store/generationStore';
import { AiEditPanel } from './components/AiEditPanel';
import { ConceptTab } from './components/tabs/ConceptTab';
import { CameraTab } from './components/tabs/CameraTab';
import { PoseTab } from './components/tabs/PoseTab';
import { PaintingTab } from './components/tabs/PaintingTab';

interface RightPanelProps {
    language: Language;
    onNotification: (message: string, type: 'success' | 'error') => void;
    queueGeneration: (task: GenerationTask) => void;
}

// Memoized to prevent re-renders during canvas zoom/pan operations
export const RightPanel = memo<RightPanelProps>(({ language, onNotification, queueGeneration }) => {
    const {
        activeRightPanelTab, setActiveRightPanelTab,
        isCameraViewActive, isLightDirectionActive, setIsCameraViewActive, setIsLightDirectionActive,
        bodyPartReferenceMap, setBodyPartReferenceMap,
        updateDerivedOutfitState,
        poseControlImage, setPoseControlImage, setSelectedActionPose,
        isAutoColoringActive, isVariationActive,
    } = useGenerationStore();

    const { activeReferenceIndex, setBoardImages, boardImages } = useCanvasStore();
    const referenceImages = boardImages.filter(img =>
        img.role === 'reference' ||
        img.role === 'generalRef' ||
        img.role === 'costumeRef' ||
        img.role === 'poseRef'
    ).sort((a, b) => (a.refIndex ?? Infinity) - (b.refIndex ?? Infinity));

    // Check for original image and pose reference image
    const hasOriginalImage = useMemo(() => boardImages.some(img => img.role === 'original'), [boardImages]);
    const hasPoseRefImage = useMemo(() => boardImages.some(img => img.role === 'poseRef' || img.role === 'pose'), [boardImages]);

    // Pose tab is only enabled when there's an original image and NO pose reference image
    // and camera is not active
    const isPoseTabEnabled = hasOriginalImage && !hasPoseRefImage && !isCameraViewActive;

    // Camera tab is disabled when pose drawing is active
    const isCameraTabEnabled = !poseControlImage;

    const prevRefImageCount = useRef(referenceImages.length);
    useEffect(() => {
        if (referenceImages.length > 0 && prevRefImageCount.current === 0) {
            if (activeRightPanelTab !== 'concept') {
                setActiveRightPanelTab('concept');
            }
        }
        prevRefImageCount.current = referenceImages.length;
    }, [referenceImages.length, activeRightPanelTab, setActiveRightPanelTab]);


    useEffect(() => {
        const activeRefIndices = new Set(referenceImages.map(img => img.refIndex).filter(i => i !== undefined));
        const currentAssignedIndices = new Set(Object.values(bodyPartReferenceMap));

        let changed = false;
        const newMap = { ...bodyPartReferenceMap };

        for (const index of currentAssignedIndices) {
            if (index !== undefined && !activeRefIndices.has(index)) {
                // This ref index no longer exists, remove all parts assigned to it
                for (const part in newMap) {
                    // @ts-ignore
                    if (newMap[part] === index) {
                        // @ts-ignore
                        delete newMap[part];
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            setBodyPartReferenceMap(newMap);
        }
    }, [referenceImages, bodyPartReferenceMap, setBodyPartReferenceMap]);


    const prevIsCamOrLightActive = useRef(isCameraViewActive || isLightDirectionActive);
    useEffect(() => {
        const isActiveNow = isCameraViewActive || isLightDirectionActive;
        if (isActiveNow && !prevIsCamOrLightActive.current) {
            // autoColoring/variation 활성 상태에서 카메라 켜면 참조 이미지 유지
            if (!isAutoColoringActive && !isVariationActive) {
                // Just became active, clear roles.
                setBoardImages(prev => {
                    const rolesToClear = ['reference', 'pose', 'costumeRef', 'poseRef', 'generalRef'];
                    const needsUpdate = prev.some(img => rolesToClear.includes(img.role as string));
                    if (!needsUpdate) return prev;

                    return prev.map(img => {
                        if (rolesToClear.includes(img.role as string)) {
                            return { ...img, role: 'none', refIndex: undefined };
                        }
                        return img;
                    });
                });
            }
            // Also clear pose drawing when camera becomes active
            if (poseControlImage) {
                setPoseControlImage(null);
                setSelectedActionPose(null);
            }
        }
        prevIsCamOrLightActive.current = isActiveNow;
    }, [isCameraViewActive, isLightDirectionActive, isAutoColoringActive, isVariationActive, setBoardImages, poseControlImage, setPoseControlImage, setSelectedActionPose]);

    useEffect(() => {
        updateDerivedOutfitState(bodyPartReferenceMap, activeReferenceIndex);
    }, [bodyPartReferenceMap, activeReferenceIndex, updateDerivedOutfitState]);

    // Handle tab click with mutual exclusivity rules
    const handlePoseTabClick = () => {
        if (!isPoseTabEnabled) return;
        // Clear camera when switching to pose
        if (isCameraViewActive) {
            setIsCameraViewActive(false);
        }
        if (isLightDirectionActive) {
            setIsLightDirectionActive(false);
        }
        setActiveRightPanelTab('pose');
    };

    const handleCameraTabClick = () => {
        if (!isCameraTabEnabled) return;
        // Clear pose drawing when switching to camera
        if (poseControlImage) {
            setPoseControlImage(null);
            setSelectedActionPose(null);
        }
        setActiveRightPanelTab('camera');
    };

    // Generate tooltip message for disabled pose tab
    const getPoseTabTooltip = () => {
        if (!hasOriginalImage) {
            return t('rightPanel.onlyWithOriginal' as TranslationKey, language);
        }
        if (hasPoseRefImage) {
            return t('rightPanel.onlyWithoutPoseRef' as TranslationKey, language);
        }
        if (isCameraViewActive) {
            return t('rightPanel.cannotWithCamera' as TranslationKey, language);
        }
        return t('rightPanel.poseDrawing' as TranslationKey, language);
    };

    // Generate tooltip message for disabled camera tab
    const getCameraTabTooltip = () => {
        if (poseControlImage) {
            return t('rightPanel.cannotWithPoseDrawing' as TranslationKey, language);
        }
        return t('rightPanelTab.camera', language);
    };

    return (
        <div className="flex flex-col h-full break-keep">
            <div className="flex-shrink-0 p-1 bg-black/20 border-b border-white/10">
                <div className="flex items-center bg-black/20 rounded-lg p-0.5 gap-0.5">
                    <Tooltip tip={t('tooltip.section.conceptDesign', language)} position="bottom" className="flex-1">
                        <button onClick={() => setActiveRightPanelTab('concept')} className={`relative w-full py-1 lg:py-1.5 rounded-md transition-all flex justify-center items-center ${activeRightPanelTab === 'concept' ? 'text-key bg-key/10 shadow-[0_0_15px_var(--key-glow)]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                            <HangerIcon className="w-[24px] h-[24px]" />
                            {activeRightPanelTab === 'concept' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-key rounded-full shadow-[0_0_8px_var(--key-glow)]" />}
                        </button>
                    </Tooltip>
                    <Tooltip tip={t('aiEdit.title', language)} position="bottom" className="flex-1">
                        <button onClick={() => setActiveRightPanelTab('aiEdit')} className={`relative w-full py-1 lg:py-1.5 rounded-md transition-all flex justify-center items-center ${activeRightPanelTab === 'aiEdit' ? 'text-key bg-key/10 shadow-[0_0_15px_var(--key-glow)]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                            <span className="text-[33px] font-bold leading-none">AI</span>
                            {activeRightPanelTab === 'aiEdit' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-key rounded-full shadow-[0_0_8px_var(--key-glow)]" />}
                        </button>
                    </Tooltip>
                    <Tooltip tip={getCameraTabTooltip()} position="bottom" className="flex-1">
                        <button
                            onClick={handleCameraTabClick}
                            disabled={!isCameraTabEnabled}
                            className={`relative w-full py-1 lg:py-1.5 rounded-md transition-all flex justify-center items-center ${!isCameraTabEnabled
                                    ? 'text-zinc-600 cursor-not-allowed opacity-50'
                                    : activeRightPanelTab === 'camera'
                                        ? 'text-key bg-key/10 shadow-[0_0_15px_var(--key-glow)]'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                }`}
                        >
                            <CameraIcon className="w-[24px] h-[24px]" />
                            {activeRightPanelTab === 'camera' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-key rounded-full shadow-[0_0_8px_var(--key-glow)]" />}
                        </button>
                    </Tooltip>
                    <Tooltip tip={getPoseTabTooltip()} position="bottom" className="flex-1">
                        <button
                            onClick={handlePoseTabClick}
                            disabled={!isPoseTabEnabled}
                            className={`relative w-full py-1 lg:py-1.5 rounded-md transition-all flex justify-center items-center ${!isPoseTabEnabled
                                    ? 'text-zinc-600 cursor-not-allowed opacity-50'
                                    : activeRightPanelTab === 'pose'
                                        ? 'text-key bg-key/10 shadow-[0_0_15px_var(--key-glow)]'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                }`}
                        >
                            <BodyIcon className="w-[24px] h-[24px]" />
                            {activeRightPanelTab === 'pose' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-key rounded-full shadow-[0_0_8px_var(--key-glow)]" />}
                        </button>
                    </Tooltip>
                    <Tooltip tip={t('tooltip.painting', language)} position="bottom" className="flex-1">
                        <button onClick={() => setActiveRightPanelTab('painting')} className={`relative w-full py-1 lg:py-1.5 rounded-md transition-all flex justify-center items-center ${activeRightPanelTab === 'painting' ? 'text-key bg-key/10 shadow-[0_0_15px_var(--key-glow)]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                            <PaintBrushIcon className="w-[24px] h-[24px]" />
                            {activeRightPanelTab === 'painting' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-key rounded-full shadow-[0_0_8px_var(--key-glow)]" />}
                        </button>
                    </Tooltip>
                </div>
            </div>
            <div className="flex-grow p-2 space-y-2 overflow-y-auto custom-scrollbar">
                {activeRightPanelTab === 'concept' && (
                    <ConceptTab language={language} onNotification={onNotification} />
                )}
                {activeRightPanelTab === 'aiEdit' && (
                    <AiEditPanel language={language} onNotification={onNotification} queueGeneration={queueGeneration} />
                )}
                {activeRightPanelTab === 'camera' && (
                    <CameraTab language={language} />
                )}
                {activeRightPanelTab === 'pose' && (
                    <PoseTab language={language} />
                )}
                {activeRightPanelTab === 'painting' && (
                    <PaintingTab language={language} />
                )}
            </div>
        </div>
    )
});
