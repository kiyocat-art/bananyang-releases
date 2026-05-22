import { BoardImage } from '../types';

/**
 * Calculate which images are visible in the current viewport
 * Used for priority loading during workspace load
 */
export function getVisibleImageIndices(
    images: Array<{ x: number; y: number; width: number; height: number }>,
    viewport: { x: number; y: number; width: number; height: number },
    padding: number = 500
): Set<number> {
    const visibleIndices = new Set<number>();

    const viewLeft = viewport.x - padding;
    const viewTop = viewport.y - padding;
    const viewRight = viewport.x + viewport.width + padding;
    const viewBottom = viewport.y + viewport.height + padding;

    images.forEach((img, index) => {
        if (
            img.x < viewRight &&
            img.x + img.width > viewLeft &&
            img.y < viewBottom &&
            img.y + img.height > viewTop
        ) {
            visibleIndices.add(index);
        }
    });

    return visibleIndices;
}

/**
 * Calculate viewport bounds from canvas state
 */
export function getViewportBounds(
    pan: { x: number; y: number },
    zoom: number,
    canvasSize: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
    return {
        x: -pan.x / zoom,
        y: -pan.y / zoom,
        width: canvasSize.width / zoom,
        height: canvasSize.height / zoom
    };
}
