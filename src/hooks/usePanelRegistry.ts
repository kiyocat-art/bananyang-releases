import { useRef } from 'react';
import type { PanelState, SnapCandidate } from './useDockingSystem';

export type PanelAdapter = {
    getId: () => string;
    getState: () => PanelState;
    setState: (state: Partial<PanelState>) => void;
    applyDelta: (dx: number, dy: number) => void;
    applyHeightDelta: (delta: number) => void;
    getSnapRef: () => React.MutableRefObject<SnapCandidate[]>;
    getIsSnappedRef: () => React.MutableRefObject<boolean>;
    getVisibleRef: () => { current: boolean };
};

export type PanelRegistry = {
    register: (id: string, adapter: PanelAdapter) => void;
    unregister: (id: string) => void;
    get: (id: string) => PanelAdapter | undefined;
    getAll: () => PanelAdapter[];
};

/**
 * 패널 어댑터 레지스트리.
 * 각 패널을 ID로 등록하면 applyDelta, applyHeightDelta, refreshSnapRefs 등
 * 패널별 분기 로직이 모두 어댑터 호출 1줄로 줄어든다.
 *
 * 새 패널 추가 시: App.tsx에서 register() 한 번만 호출하면 됨.
 */
export function usePanelRegistry(): PanelRegistry {
    const mapRef = useRef<Map<string, PanelAdapter>>(new Map());

    // registryRef는 렌더 간 동일 참조를 보장 (useDockLayout 등에 안전하게 전달 가능)
    const registryRef = useRef<PanelRegistry>({
        register: (id, adapter) => { mapRef.current.set(id, adapter); },
        unregister: (id) => { mapRef.current.delete(id); },
        get: (id) => mapRef.current.get(id),
        getAll: () => Array.from(mapRef.current.values()),
    });

    return registryRef.current;
}
