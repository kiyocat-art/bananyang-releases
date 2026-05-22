import { useEffect, useRef } from 'react';

const popoverImageCounts = new Map<string, number>();

export function registerPopoverImages(ids: string[]): () => void {
    for (const id of ids) {
        popoverImageCounts.set(id, (popoverImageCounts.get(id) ?? 0) + 1);
    }
    return () => {
        for (const id of ids) {
            const count = popoverImageCounts.get(id);
            if (count === undefined) continue;
            if (count <= 1) {
                popoverImageCounts.delete(id);
            } else {
                popoverImageCounts.set(id, count - 1);
            }
        }
    };
}

export function getPopoverImageIds(): Set<string> {
    return new Set(popoverImageCounts.keys());
}

export function useRegisterPopoverImages(ids: string[]): void {
    const idsRef = useRef<string[]>(ids);
    idsRef.current = ids;

    const releaseRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        releaseRef.current?.();
        releaseRef.current = registerPopoverImages(idsRef.current);
        return () => {
            releaseRef.current?.();
            releaseRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ids.join(',')]);
}
