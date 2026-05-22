import { create } from 'zustand';
import { LightSource, ObjectInteractionType } from '../../types';
import { ObjectState, ObjectMemo, ObjectMode, PbrSourceImage } from '../canvas/components/editor/types';

// ── Crop ──────────────────────────────────────────────────────────────
interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// ── Editor Store ───────────────────────────────────────────────────────
interface EditorState {
    /** 현재 편집 중인 이미지 ID (null이면 편집 도구 비활성) */
    editingImageId: string | null;

    // ── Crop 탭 상태 ──
    cropBox: CropBox | null;
    cropPrompt: string;

    // ── Object 탭 상태 ──
    objectStates: ObjectState[];
    selectedObjectId: string | null;
    objectMode: ObjectMode;
    objectDrawTool: 'draw' | 'erase' | 'rectangle';
    objectDrawBrushSize: number;
    objectBrushColor: string;
    objectPrompt: string;
    objectInteractionType: ObjectInteractionType | null;
    objectMemos: ObjectMemo[];
    selectedObjectMemoId: string | null;
    objectHistory: ObjectState[][];
    objectHistoryIndex: number;

    // ── Relight 탭 상태 ──
    lightSources: LightSource[];
    selectedLightId: string | null;
    lightingPrompt: string;

    // ── PBR 탭 상태 ──
    pbrSourceImages: (PbrSourceImage | null)[];
    pbrPrompt: string;
    selectedMapIds: string[];

    // ── 공통: 뷰어 표시 크기 (crop/object 생성 시 좌표 스케일링에 사용) ──
    imageDisplaySize: { width: number; height: number; naturalWidth: number; naturalHeight: number } | null;

    // ── Actions ──
    setEditingImageId: (id: string | null) => void;

    // Crop
    setCropBox: (box: CropBox | null) => void;
    setCropPrompt: (prompt: string) => void;
    resetCrop: (imageWidth: number, imageHeight: number) => void;

    // Object
    setObjectStates: (states: ObjectState[] | ((prev: ObjectState[]) => ObjectState[])) => void;
    setSelectedObjectId: (id: string | null) => void;
    setObjectMode: (mode: ObjectMode) => void;
    setObjectDrawTool: (tool: 'draw' | 'erase' | 'rectangle') => void;
    setObjectDrawBrushSize: (size: number) => void;
    setObjectBrushColor: (color: string) => void;
    setObjectPrompt: (prompt: string) => void;
    setObjectInteractionType: (type: ObjectInteractionType | null) => void;
    setObjectMemos: (memos: ObjectMemo[] | ((prev: ObjectMemo[]) => ObjectMemo[])) => void;
    setSelectedObjectMemoId: (id: string | null) => void;
    updateObjectMemo: (id: string, updates: Partial<ObjectMemo>) => void;
    deleteObjectMemo: (id: string) => void;
    removeObject: (id: string) => void;
    flipObject: (id: string) => void;
    resetObjectEditor: () => void;
    saveObjectHistory: () => void;
    undoObjectTransform: () => void;
    redoObjectTransform: () => void;
    clearObjectHistory: () => void;

    // Relight
    setLightSources: (lights: LightSource[] | ((prev: LightSource[]) => LightSource[])) => void;
    setSelectedLightId: (id: string | null) => void;
    setLightingPrompt: (prompt: string) => void;
    addLight: () => void;
    updateLight: (id: string, updates: Partial<LightSource>) => void;
    deleteLight: (id: string) => void;
    pasteLights: (lights: LightSource[]) => void;
    resetLights: () => void;

    // PBR
    setPbrSourceImages: (images: (PbrSourceImage | null)[] | ((prev: (PbrSourceImage | null)[]) => (PbrSourceImage | null)[])) => void;
    setPbrPrompt: (prompt: string) => void;
    setSelectedMapIds: (ids: string[]) => void;
    toggleMapSelection: (id: string) => void;
    toggleAllMaps: () => void;
    resetPbr: () => void;

    // 공통
    setImageDisplaySize: (size: { width: number; height: number; naturalWidth: number; naturalHeight: number } | null) => void;
}

const PBR_ALL_MAP_IDS = ['albedo', 'normal', 'roughness', 'metallic', 'height', 'ao'];

export const useEditorStore = create<EditorState>((set, get) => ({
    editingImageId: null,

    // Crop defaults
    cropBox: null,
    cropPrompt: '',

    // Object defaults
    objectStates: [],
    selectedObjectId: null,
    objectMode: 'transform',
    objectDrawTool: 'draw',
    objectDrawBrushSize: 20,
    objectBrushColor: '#ffffff',
    objectPrompt: '',
    objectInteractionType: null,
    objectMemos: [],
    selectedObjectMemoId: null,
    objectHistory: [],
    objectHistoryIndex: -1,

    // Relight defaults
    lightSources: [],
    selectedLightId: null,
    lightingPrompt: '',

    // PBR defaults
    pbrSourceImages: [null, null, null],
    pbrPrompt: '',
    selectedMapIds: ['albedo', 'normal', 'roughness'],

    // 공통
    imageDisplaySize: null,

    // ── Setters ───────────────────────────────────────────────────────

    setEditingImageId: (id) => set({ editingImageId: id }),

    // Crop
    setCropBox: (box) => set({ cropBox: box }),
    setCropPrompt: (prompt) => set({ cropPrompt: prompt }),
    resetCrop: (imageWidth, imageHeight) => set({
        cropBox: { x: 0, y: 0, width: imageWidth, height: imageHeight },
        cropPrompt: '',
    }),

    // Object
    setObjectStates: (states) => set((s) => ({
        objectStates: typeof states === 'function' ? states(s.objectStates) : states,
    })),
    setSelectedObjectId: (id) => set({ selectedObjectId: id }),
    setObjectMode: (mode) => set({ objectMode: mode }),
    setObjectDrawTool: (tool) => set({ objectDrawTool: tool }),
    setObjectDrawBrushSize: (size) => set({ objectDrawBrushSize: size }),
    setObjectBrushColor: (color) => set({ objectBrushColor: color }),
    setObjectPrompt: (prompt) => set({ objectPrompt: prompt }),
    setObjectInteractionType: (type) => set({ objectInteractionType: type }),
    setObjectMemos: (memos) => set((s) => ({
        objectMemos: typeof memos === 'function' ? memos(s.objectMemos) : memos,
    })),
    setSelectedObjectMemoId: (id) => set({ selectedObjectMemoId: id }),
    updateObjectMemo: (id, updates) => set((s) => ({
        objectMemos: s.objectMemos.map((m) => m.id === id ? { ...m, ...updates } : m),
    })),
    deleteObjectMemo: (id) => set((s) => ({
        objectMemos: s.objectMemos.filter((m) => m.id !== id),
        selectedObjectMemoId: s.selectedObjectMemoId === id ? null : s.selectedObjectMemoId,
    })),
    removeObject: (id) => set((s) => ({
        objectStates: s.objectStates.filter((o) => o.id !== id),
        selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
    })),
    flipObject: (id) => set((s) => ({
        objectStates: s.objectStates.map((o) => o.id === id ? { ...o, flipped: !o.flipped } : o),
    })),
    resetObjectEditor: () => set({
        objectStates: [],
        selectedObjectId: null,
        objectMode: 'transform',
        objectPrompt: '',
        objectInteractionType: null,
        objectMemos: [],
        selectedObjectMemoId: null,
        objectHistory: [],
        objectHistoryIndex: -1,
    }),
    saveObjectHistory: () => set((s) => {
        const snapshot = s.objectStates.map((o) => ({ ...o, transform: { ...o.transform } }));
        const newHistory = s.objectHistory.slice(0, s.objectHistoryIndex + 1);
        newHistory.push(snapshot);
        if (newHistory.length > 30) newHistory.shift();
        return { objectHistory: newHistory, objectHistoryIndex: newHistory.length - 1 };
    }),
    undoObjectTransform: () => set((s) => {
        if (s.objectHistoryIndex < 0) return s; // 이미 빈 상태
        if (s.objectHistoryIndex === 0) {
            // 첫 번째 히스토리 → 진짜 빈 상태(index -1)로 복귀
            return { objectStates: [], objectHistoryIndex: -1 };
        }
        const newIndex = s.objectHistoryIndex - 1;
        return {
            objectStates: s.objectHistory[newIndex].map((o) => ({ ...o, transform: { ...o.transform } })),
            objectHistoryIndex: newIndex,
        };
    }),
    redoObjectTransform: () => set((s) => {
        if (s.objectHistoryIndex >= s.objectHistory.length - 1) return s;
        const newIndex = s.objectHistoryIndex + 1;
        return {
            objectStates: s.objectHistory[newIndex].map((o) => ({ ...o, transform: { ...o.transform } })),
            objectHistoryIndex: newIndex,
        };
    }),
    clearObjectHistory: () => set({ objectHistory: [], objectHistoryIndex: -1 }),

    // Relight
    setLightSources: (lights) => set((s) => ({
        lightSources: typeof lights === 'function' ? lights(s.lightSources) : lights,
    })),
    setSelectedLightId: (id) => set({ selectedLightId: id }),
    setLightingPrompt: (prompt) => set({ lightingPrompt: prompt }),
    addLight: () => {
        const newLight: LightSource = {
            id: crypto.randomUUID(),
            type: 'omni',
            color: '#ffffff',
            intensity: 100,
            position: { x: 0.5, y: 0.5 },
            direction: 0,
            colorTemperature: 0,
            radius: 50,
            specularIntensity: 30,
            shadowSoftness: 50,
            affectedArea: 'full',
            atmosphericEffect: 'none',
        };
        set((s) => ({
            lightSources: [...s.lightSources, newLight],
            selectedLightId: newLight.id,
        }));
    },
    updateLight: (id, updates) => set((s) => ({
        lightSources: s.lightSources.map((l) => l.id === id ? { ...l, ...updates } : l),
    })),
    deleteLight: (id) => set((s) => ({
        lightSources: s.lightSources.filter((l) => l.id !== id),
        selectedLightId: s.selectedLightId === id ? null : s.selectedLightId,
    })),
    pasteLights: (lights) => {
        const newLights = lights.map((l) => ({ ...l, id: crypto.randomUUID() }));
        set((s) => ({
            lightSources: [...s.lightSources, ...newLights],
            selectedLightId: newLights.length > 0 ? newLights[newLights.length - 1].id : s.selectedLightId,
        }));
    },
    resetLights: () => set({ lightSources: [], selectedLightId: null }),

    // PBR
    setPbrSourceImages: (images) => set((s) => ({
        pbrSourceImages: typeof images === 'function' ? images(s.pbrSourceImages) : images,
    })),
    setPbrPrompt: (prompt) => set({ pbrPrompt: prompt }),
    setSelectedMapIds: (ids) => set({ selectedMapIds: ids }),
    toggleMapSelection: (id) => set((s) => ({
        selectedMapIds: s.selectedMapIds.includes(id)
            ? s.selectedMapIds.filter((m) => m !== id)
            : [...s.selectedMapIds, id],
    })),
    toggleAllMaps: () => set((s) => ({
        selectedMapIds: s.selectedMapIds.length === PBR_ALL_MAP_IDS.length
            ? []
            : [...PBR_ALL_MAP_IDS],
    })),
    resetPbr: () => set({ pbrSourceImages: [null, null, null], pbrPrompt: '' }),

    // 공통
    setImageDisplaySize: (size) => set({ imageDisplaySize: size }),
}));
