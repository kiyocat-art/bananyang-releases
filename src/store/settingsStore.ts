import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '../localization';
import type { AxisMode } from '../services/aiSortService';

export interface AutoSaveSettings {
    // Time interval trigger only
    enabled: boolean;
    intervalMinutes: number; // Auto-save every N minutes

    // Tracking
    lastAutoSaveTime: number; // Timestamp of last auto-save
    lastActivityTime: number; // Timestamp of last user activity
}

// Glass effect: transparent = light blur, sunglasses = default dark blur, off = opaque
export type GlassEffectLevel = 'transparent' | 'sunglasses' | 'off';

// Image limit configuration
export interface ImageLimitConfig {
    softLimit: number;           // Warning threshold (default: 700 = 70% of hardLimit)
    strongLimit: number;         // Strong warning threshold (default: 900 = 90% of hardLimit)
    hardLimit: number;           // Block threshold (default: 1000)
    warningEnabled: boolean;     // Show warning when approaching limit
    warningDismissedUntil: number | null; // Timestamp when warning was dismissed
    lastShownAtCount: number;    // Track last shown count for 5-image interval popup
}

// Warning level for image count (3-stage: soft 700-899, strong 900-999, hard 1000+)
export type ImageWarningLevel = 'none' | 'soft' | 'strong' | 'hard';

interface SettingsState {
    // Language
    language: Language;

    // Auto-save settings
    autoSave: AutoSaveSettings;

    // Glass effect settings
    glassEffectLevel: GlassEffectLevel;

    // Left panel visibility
    showCreditInLeftPanel: boolean;

    // Auto-download settings
    autoDownloadEnabled: boolean;
    autoDownloadPath: string | null;

    // Image limit settings
    imageLimitConfig: ImageLimitConfig;

    // Auto login setting
    autoLogin: boolean;

    // Group auto add setting
    groupAutoAdd: boolean;

    // Auto add generated images to infinite canvas
    autoAddToCanvas: boolean;

    // Undo/Redo history size
    undoHistorySize: number;

    // Auto-resume generation after 429 rate limit
    autoResumeOnRateLimit: boolean;

    // Auto-close popover panel when generate button is clicked
    autoClosePopoverOnGenerate: boolean;

    // Auto-open editor when original image role is assigned
    autoOpenEditorOnOriginal: boolean;

    // Auto-bind toolbar to original image selection bar
    autoBindToolbarToOriginal: boolean;

    // Toolbar binding side preference
    toolbarBindingSide: 'left' | 'right';

    // WebGPU renderer activation (experimental — default false)
    enableWebGPU: boolean;

    // Developer mode — exposes advanced texture stats in memory panel
    developerMode: boolean;

    // AI auto-sort: last-selected maximum groups (2-6) or 'auto'
    aiSortMaxGroups: number | 'auto';

    // AI auto-sort: classification axis (shape | concept | color)
    aiSortAxis: AxisMode;

    // AI auto-sort: 2-pass Gemini cluster verification
    aiSortVerifyClusters: boolean;

    // AI auto-sort: default mode for menu-bar / shortcut triggers (context menu picks per click)
    defaultAiSortMode: 'similar' | 'thematic';

    // Flick panning (inertia on pan release, like Photoshop)
    flickPanning: boolean;

    // Auto-group generated images (source + results) into a single group
    autoGroupGenerated: boolean;

    // OTA auto-update: ON = silent background install on next quit, OFF = prompt user
    autoUpdateEnabled: boolean;

    // Actions
    setLanguage: (lang: Language) => void;
    setAutoSaveEnabled: (enabled: boolean) => void;
    setIntervalMinutes: (minutes: number) => void;
    setGlassEffectLevel: (level: GlassEffectLevel) => void;
    setShowCreditInLeftPanel: (show: boolean) => void;
    setAutoDownloadEnabled: (enabled: boolean) => void;
    setAutoDownloadPath: (path: string | null) => void;
    setAutoLogin: (enabled: boolean) => void;
    setGroupAutoAdd: (enabled: boolean) => void;
    setAutoAddToCanvas: (enabled: boolean) => void;
    setUndoHistorySize: (size: number) => void;
    setAutoResumeOnRateLimit: (enabled: boolean) => void;
    setAutoClosePopoverOnGenerate: (enabled: boolean) => void;
    setAutoOpenEditorOnOriginal: (enabled: boolean) => void;
    setAutoBindToolbarToOriginal: (enabled: boolean) => void;
    setToolbarBindingSide: (side: 'left' | 'right') => void;
    setEnableWebGPU: (enabled: boolean) => void;
    setDeveloperMode: (enabled: boolean) => void;
    setAiSortMaxGroups: (count: number | 'auto') => void;
    setAiSortAxis: (axis: AxisMode) => void;
    setAiSortVerifyClusters: (enabled: boolean) => void;
    setDefaultAiSortMode: (mode: 'similar' | 'thematic') => void;
    setFlickPanning: (enabled: boolean) => void;
    setAutoGroupGenerated: (enabled: boolean) => void;
    setAutoUpdateEnabled: (enabled: boolean) => void;

    // Image limit actions
    setImageLimitConfig: (config: Partial<ImageLimitConfig>) => void;
    dismissImageWarning: (durationMs?: number) => void;
    getImageWarningLevel: (imageCount: number) => ImageWarningLevel;

    // Tracking actions
    resetAutoSaveTracking: () => void;
    updateLastActivityTime: () => void;

    // Check if auto-save should trigger
    // Returns: { shouldSave: boolean, reason: 'interval' | 'idle' | null }
    shouldAutoSave: () => { shouldSave: boolean; reason: 'interval' | 'idle' | null };
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            language: 'en' as Language,

            autoSave: {
                enabled: true,
                intervalMinutes: 10, // Default: save every 10 minutes
                lastAutoSaveTime: Date.now(),
                lastActivityTime: Date.now(),
            },

            glassEffectLevel: 'sunglasses',

            showCreditInLeftPanel: false,

            // Auto-download settings
            autoDownloadEnabled: false,
            autoDownloadPath: null,

            autoLogin: true,
            groupAutoAdd: true,
            autoAddToCanvas: true,
            undoHistorySize: 10,
            autoResumeOnRateLimit: false,
            autoClosePopoverOnGenerate: false,
            autoOpenEditorOnOriginal: true,
            autoBindToolbarToOriginal: true,
            toolbarBindingSide: 'right' as const,
            enableWebGPU: false,
            developerMode: false,
            aiSortMaxGroups: 'auto' as const,
            aiSortAxis: 'concept' as AxisMode,
            aiSortVerifyClusters: true,
            defaultAiSortMode: 'similar' as const,
            flickPanning: true,
            autoGroupGenerated: false,
            autoUpdateEnabled: true,

            // Image limit settings (v13: 500장으로 조정 — WebGPU 안정성 확보)
            imageLimitConfig: {
                softLimit: 250,    // 50% of hardLimit - show yellow warning at 250+
                strongLimit: 400,  // 80% of hardLimit - show orange warning at 400+
                hardLimit: 500,    // [STABILITY FIX] Reduced from 1000 for WebGPU stability
                warningEnabled: true,
                warningDismissedUntil: null,
                lastShownAtCount: 0,  // Track last shown count for warning interval
            },

            setLanguage: (lang) => set({ language: lang }),

            setAutoSaveEnabled: (enabled) => set(state => ({
                autoSave: { ...state.autoSave, enabled }
            })),

            setIntervalMinutes: (minutes) => set(state => ({
                autoSave: { ...state.autoSave, intervalMinutes: Math.max(1, minutes) }
            })),

            setGlassEffectLevel: (level) => set({ glassEffectLevel: level }),

            setShowCreditInLeftPanel: (show) => set({ showCreditInLeftPanel: show }),

            setAutoDownloadEnabled: (enabled) => set({ autoDownloadEnabled: enabled }),
            setAutoDownloadPath: (path) => set({ autoDownloadPath: path }),
            setAutoLogin: (enabled) => set({ autoLogin: enabled }),
            setGroupAutoAdd: (enabled) => set({ groupAutoAdd: enabled }),
            setAutoAddToCanvas: (enabled) => set({ autoAddToCanvas: enabled }),
            setUndoHistorySize: (size) => set({ undoHistorySize: Math.min(50, Math.max(1, size)) }),
            setAutoResumeOnRateLimit: (enabled) => set({ autoResumeOnRateLimit: enabled }),
            setAutoClosePopoverOnGenerate: (enabled) => set({ autoClosePopoverOnGenerate: enabled }),
            setAutoOpenEditorOnOriginal: (enabled) => set({ autoOpenEditorOnOriginal: enabled }),
            setAutoBindToolbarToOriginal: (enabled) => set({ autoBindToolbarToOriginal: enabled }),
            setToolbarBindingSide: (side) => set({ toolbarBindingSide: side }),
            setEnableWebGPU: (enabled) => set({ enableWebGPU: enabled }),
            setDeveloperMode: (enabled) => set({ developerMode: enabled }),
            setAiSortMaxGroups: (count) => set({
                aiSortMaxGroups: count === 'auto' ? 'auto' : Math.min(6, Math.max(2, count as number)),
            }),
            setAiSortAxis: (axis) => set({ aiSortAxis: axis }),
            setAiSortVerifyClusters: (enabled) => set({ aiSortVerifyClusters: enabled }),
            setDefaultAiSortMode: (mode) => set({ defaultAiSortMode: mode === 'thematic' ? 'thematic' : 'similar' }),
            setFlickPanning: (enabled) => set({ flickPanning: enabled }),
            setAutoGroupGenerated: (enabled) => set({ autoGroupGenerated: enabled }),
            setAutoUpdateEnabled: (enabled) => set({ autoUpdateEnabled: enabled }),

            // Image limit actions
            setImageLimitConfig: (config) => set(state => ({
                imageLimitConfig: { ...state.imageLimitConfig, ...config }
            })),

            dismissImageWarning: (durationMs = 3600000) => set(state => ({
                imageLimitConfig: {
                    ...state.imageLimitConfig,
                    warningDismissedUntil: Date.now() + durationMs, // Default: 1 hour
                }
            })),

            getImageWarningLevel: (imageCount: number): ImageWarningLevel => {
                const { imageLimitConfig } = get();
                const { softLimit, strongLimit, hardLimit, warningEnabled, warningDismissedUntil, lastShownAtCount } = imageLimitConfig;

                // Hard limit exceeded or reached - always show red warning (cannot dismiss)
                if (imageCount >= hardLimit) return 'hard';

                // Strong limit zone (900-999): show orange warning every image add
                if (imageCount >= strongLimit) {
                    // Check if warning is temporarily dismissed
                    if (warningDismissedUntil && Date.now() < warningDismissedUntil) {
                        return 'none';
                    }
                    // Update last shown count for strong warnings
                    if (imageCount > lastShownAtCount) {
                        set(state => ({
                            imageLimitConfig: {
                                ...state.imageLimitConfig,
                                lastShownAtCount: imageCount
                            }
                        }));
                    }
                    return 'strong';
                }

                // Check if warning is temporarily dismissed (for soft warnings)
                if (warningDismissedUntil && Date.now() < warningDismissedUntil) {
                    return 'none';
                }

                // Below soft limit - no warning
                if (imageCount < softLimit || !warningEnabled) {
                    return 'none';
                }

                // Soft limit zone (700-899): show warning every 5 images
                // Show at: 700, 705, 710, ... 895
                const WARNING_INTERVAL = 5;
                const imagesOverSoftLimit = imageCount - softLimit;
                const shouldShowAtInterval = imagesOverSoftLimit % WARNING_INTERVAL === 0;

                // Also show if this is the first time reaching a new milestone
                const currentMilestone = Math.floor(imageCount / WARNING_INTERVAL) * WARNING_INTERVAL;
                const lastMilestone = Math.floor(lastShownAtCount / WARNING_INTERVAL) * WARNING_INTERVAL;
                const isNewMilestone = currentMilestone > lastMilestone && imageCount >= softLimit;

                if (shouldShowAtInterval || isNewMilestone) {
                    // Update last shown count
                    set(state => ({
                        imageLimitConfig: {
                            ...state.imageLimitConfig,
                            lastShownAtCount: imageCount
                        }
                    }));
                    return 'soft';
                }

                return 'none';
            },

            resetAutoSaveTracking: () => set(state => ({
                autoSave: {
                    ...state.autoSave,
                    lastAutoSaveTime: Date.now()
                }
            })),

            updateLastActivityTime: () => set(state => ({
                autoSave: {
                    ...state.autoSave,
                    lastActivityTime: Date.now()
                }
            })),

            shouldAutoSave: () => {
                const { autoSave } = get();

                if (!autoSave.enabled) return { shouldSave: false, reason: null };

                const now = Date.now();
                const minutesSinceLastSave = (now - autoSave.lastAutoSaveTime) / 60000;
                const minutesSinceLastActivity = (now - autoSave.lastActivityTime) / 60000;

                // Skip if interval hasn't elapsed
                if (minutesSinceLastSave < autoSave.intervalMinutes) {
                    return { shouldSave: false, reason: null };
                }

                // Skip if user hasn't done any work since last save
                // (lastActivityTime is before lastAutoSaveTime means no activity after last save)
                if (autoSave.lastActivityTime <= autoSave.lastAutoSaveTime) {
                    return { shouldSave: false, reason: 'idle' };
                }

                // Interval elapsed AND user has been active since last save
                return { shouldSave: true, reason: 'interval' };
            }
        }),
        {
            name: 'bananyang-settings',
            version: 38,  // v38: aiSortAxis, aiSortVerifyClusters 추가; aiSortMaxGroups 'auto' 지원.
            migrate: (persistedState: any, version: number) => {
                // [FIX B-2] Safely merge persisted state with defaults
                // This prevents settings loss when version changes add/remove fields
                const defaults = {
                    language: 'en' as Language,
                    autoSave: {
                        enabled: true,
                        intervalMinutes: 10,
                        lastAutoSaveTime: Date.now(),
                        lastActivityTime: Date.now(),
                    },
                    glassEffectLevel: 'sunglasses' as const,
                    showCreditInLeftPanel: false,
                    autoDownloadEnabled: false,
                    autoDownloadPath: null,
                    autoLogin: true,
                    groupAutoAdd: true,
                    autoAddToCanvas: true,
                    undoHistorySize: 10,
                    autoResumeOnRateLimit: false,
                    autoClosePopoverOnGenerate: false,
                    autoOpenEditorOnOriginal: true,
                    autoBindToolbarToOriginal: true,
                    toolbarBindingSide: 'right' as const,
                    enableWebGPU: false,
                    developerMode: false,
                    aiSortMaxGroups: 'auto' as const,
                    aiSortAxis: 'concept' as AxisMode,
                    aiSortVerifyClusters: true,
                    defaultAiSortMode: 'similar' as const,
                    flickPanning: true,
                    autoGroupGenerated: false,
                    autoUpdateEnabled: true,
                    imageLimitConfig: {
                        softLimit: 250,     // 50% of hardLimit
                        strongLimit: 400,   // 80% of hardLimit
                        hardLimit: 500,     // [STABILITY FIX] Reduced for WebGPU stability
                        warningEnabled: true,
                        warningDismissedUntil: null,
                        lastShownAtCount: 0,
                    },
                };
                if (!persistedState || typeof persistedState !== 'object') {
                    return defaults as unknown as SettingsState;
                }
                // Deep merge autoSave to preserve nested fields
                const mergedAutoSave = {
                    ...defaults.autoSave,
                    ...(persistedState.autoSave || {}),
                };
                // Deep merge imageLimitConfig — v12: 이전 한도(300)를 새 한도(1000)로 강제 업데이트
                const persistedImageConfig = persistedState.imageLimitConfig || {};
                const mergedImageLimitConfig = {
                    ...defaults.imageLimitConfig,
                    ...persistedImageConfig,
                };
                // v11→v12 마이그레이션: 이전 기본값(300/270)이면 새 기본값으로 변경
                if (version <= 11) {
                    if (mergedImageLimitConfig.hardLimit <= 300) {
                        mergedImageLimitConfig.hardLimit = defaults.imageLimitConfig.hardLimit;
                    }
                    if (mergedImageLimitConfig.softLimit <= 270) {
                        mergedImageLimitConfig.softLimit = defaults.imageLimitConfig.softLimit;
                    }
                    mergedImageLimitConfig.warningDismissedUntil = null;
                    mergedImageLimitConfig.lastShownAtCount = 0;
                }
                // v12→v13 마이그레이션: 1000장 제한을 500장으로 하향 (WebGPU 안정성)
                if (version <= 12) {
                    mergedImageLimitConfig.hardLimit = defaults.imageLimitConfig.hardLimit; // 500
                    mergedImageLimitConfig.softLimit = defaults.imageLimitConfig.softLimit; // 250
                    mergedImageLimitConfig.strongLimit = defaults.imageLimitConfig.strongLimit; // 400
                    mergedImageLimitConfig.warningDismissedUntil = null;
                    mergedImageLimitConfig.lastShownAtCount = 0;
                }
                // v13→v14 마이그레이션: language 필드 추가
                const language = persistedState.language || defaults.language;
                // v14→v15 마이그레이션: autoLogin 필드 추가
                const autoLogin = persistedState.autoLogin !== undefined ? persistedState.autoLogin : defaults.autoLogin;
                // v15→v16 마이그레이션: groupAutoAdd 필드 추가
                const groupAutoAdd = persistedState.groupAutoAdd !== undefined ? persistedState.groupAutoAdd : defaults.groupAutoAdd;
                // v17→v18 마이그레이션: undoHistorySize 필드 추가
                const undoHistorySize = persistedState.undoHistorySize ?? 10;
                // v20→v21 마이그레이션: autoResumeOnRateLimit 필드 추가
                const autoResumeOnRateLimit: boolean = persistedState.autoResumeOnRateLimit ?? false;
                // v21→v22 마이그레이션: autoClosePopoverOnGenerate 필드 추가
                const autoClosePopoverOnGenerate: boolean = persistedState.autoClosePopoverOnGenerate ?? false;
                // v22→v23 마이그레이션: autoOpenEditorOnOriginal 필드 추가
                const autoOpenEditorOnOriginal: boolean = persistedState.autoOpenEditorOnOriginal ?? true;
                // v23→v24 마이그레이션: autoBindToolbarToOriginal 필드 추가
                const autoBindToolbarToOriginal: boolean = persistedState.autoBindToolbarToOriginal ?? true;
                // v25→v26 마이그레이션: toolbarBindingSide 필드 추가
                const toolbarBindingSide: 'left' | 'right' = persistedState.toolbarBindingSide ?? 'right';
                // v26→v27 마이그레이션: enableWebGPU 필드 추가 (측정 전용, default false)
                const enableWebGPU: boolean = persistedState.enableWebGPU ?? false;
                // v27→v28 마이그레이션: developerMode 필드 추가 (메모리 진단 패널)
                const developerMode: boolean = persistedState.developerMode ?? false;
                // v29→v30 마이그레이션: flickPanning 필드 추가 (플릭 패닝 관성)
                const flickPanning: boolean = persistedState.flickPanning ?? true;
                // v30→v31 마이그레이션: autoGroupGenerated 필드 추가 (생성이미지 자동 그룹화)
                const autoGroupGenerated: boolean = persistedState.autoGroupGenerated ?? false;
                // v34→v35 마이그레이션: uiFontScale/scaleUiToFont/toolbarOrientation 제거.
                // persistedState에서 strip — spread 후 명시적으로 다시 덮어쓰지 않음.
                const { uiFontScale: _uiFontScale, scaleUiToFont: _scaleUiToFont, toolbarOrientation: _toolbarOrientation, ...rest } = persistedState;
                // v35→v36 마이그레이션: autoUpdateEnabled 필드 추가 (기본 ON = silent).
                const autoUpdateEnabled: boolean = persistedState.autoUpdateEnabled ?? defaults.autoUpdateEnabled;
                // v36→v37 마이그레이션: defaultAiSortMode 필드 추가 (기본 'similar' — 기존 동작과 호환).
                const defaultAiSortMode: 'similar' | 'thematic' =
                    persistedState.defaultAiSortMode === 'thematic' ? 'thematic' : 'similar';
                // v37→v38 마이그레이션: aiSortAxis, aiSortVerifyClusters 추가; aiSortMaxGroups 'auto' 지원.
                const aiSortAxis: AxisMode =
                    (persistedState.aiSortAxis === 'shape' || persistedState.aiSortAxis === 'color')
                        ? persistedState.aiSortAxis : 'concept';
                const aiSortVerifyClusters: boolean = persistedState.aiSortVerifyClusters ?? true;
                const persistedMax = persistedState.aiSortMaxGroups;
                const aiSortMaxGroups: number | 'auto' =
                    persistedMax === 'auto'
                        ? 'auto'
                        : (typeof persistedMax === 'number' && persistedMax >= 2 && persistedMax <= 6)
                            ? persistedMax
                            : 'auto';

                return {
                    ...defaults,
                    ...rest,
                    language,
                    autoLogin,
                    groupAutoAdd,
                    undoHistorySize,
                    autoResumeOnRateLimit,
                    autoClosePopoverOnGenerate,
                    autoOpenEditorOnOriginal,
                    autoBindToolbarToOriginal,
                    toolbarBindingSide,
                    enableWebGPU,
                    developerMode,
                    flickPanning,
                    autoGroupGenerated,
                    autoUpdateEnabled,
                    defaultAiSortMode,
                    aiSortAxis,
                    aiSortVerifyClusters,
                    aiSortMaxGroups,
                    autoSave: mergedAutoSave,
                    imageLimitConfig: mergedImageLimitConfig,
                } as SettingsState;
            },
        }
    )
);
