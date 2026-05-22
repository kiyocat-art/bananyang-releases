import React, { memo } from 'react';
import { Z_INDEX } from '../constants/zIndex';

export type SnapIndicatorKind = 'line' | 'rect-fill' | 'rect-outline';

export type SnapIndicatorState = {
    isVisible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    /** 인디케이터 모양 (옵션, 기본 'line').
     *  - 'line': 얇은 파란선 (사이드바 엣지 스냅, 스택 경계, 새 컬럼 가이드)
     *  - 'rect-fill': 반투명 파란 사각 (탭 그룹 드롭존, 향후)
     *  - 'rect-outline': 파란 테두리 사각 (탭 그룹 드롭존, 향후) */
    kind?: SnapIndicatorKind;
};

export const SnapIndicator: React.FC<SnapIndicatorState> = memo(({
    isVisible,
    x,
    y,
    width,
    height,
    kind = 'line',
}) => {
    if (!isVisible) return null;

    const baseStyle: React.CSSProperties = {
        position: 'fixed',
        left: x,
        top: y,
        width,
        height,
        zIndex: Z_INDEX.DROPDOWN,
        pointerEvents: 'none',
        transition: 'left 0.1s ease-out, top 0.1s ease-out, width 0.1s ease-out, height 0.1s ease-out, opacity 0.12s ease-out',
        opacity: isVisible ? 1 : 0,
    };

    if (kind === 'rect-fill') {
        return (
            <div
                style={{
                    ...baseStyle,
                    backgroundColor: 'rgba(255, 193, 7, 0.18)',
                    border: '2px solid var(--snap-color)',
                    borderRadius: 8,
                    boxShadow: '0 0 0 1px var(--snap-glow), 0 0 18px 4px var(--snap-glow)',
                }}
            />
        );
    }

    if (kind === 'rect-outline') {
        return (
            <div
                style={{
                    ...baseStyle,
                    backgroundColor: 'transparent',
                    border: '3px solid var(--snap-color)',
                    borderRadius: 8,
                    boxShadow: '0 0 0 1px var(--snap-glow), 0 0 18px 4px var(--snap-glow)',
                }}
            />
        );
    }

    // 'line' (default): 4px 두께 라인
    return (
        <div
            style={{
                ...baseStyle,
                backgroundColor: 'var(--snap-color)',
                borderRadius: 9999,
                boxShadow: '0 0 6px 2px var(--snap-glow), 0 0 18px 5px rgba(255, 193, 7, 0.2)',
            }}
        />
    );
});
