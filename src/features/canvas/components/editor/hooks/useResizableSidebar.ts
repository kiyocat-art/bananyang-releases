import { useState, useRef, useCallback } from 'react';

const STORAGE_KEY = 'editor-sidebar-width';
const DEFAULT_WIDTH = 192;
const MIN_WIDTH = 160;
const MAX_WIDTH = 380;

export function useResizableSidebar() {
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
        } catch {
            return DEFAULT_WIDTH;
        }
    });

    const widthRef = useRef(sidebarWidth);
    widthRef.current = sidebarWidth;

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = widthRef.current;

        const onMove = (ev: MouseEvent) => {
            // 왼쪽 경계선 드래그: 마우스 왼쪽 이동 → 패널 넓어짐
            const delta = startX - ev.clientX;
            const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + delta));
            setSidebarWidth(newW);
        };

        const onUp = () => {
            try { localStorage.setItem(STORAGE_KEY, String(widthRef.current)); } catch { /* ignore */ }
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, []);

    return { sidebarWidth, handleResizeMouseDown };
}
