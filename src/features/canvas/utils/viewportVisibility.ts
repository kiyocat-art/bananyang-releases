/**
 * Viewport Visibility Utilities
 * 
 * Calculates which images are visible, in buffer, or hidden
 * for On-Demand texture loading system.
 */

import { BoardImage } from '../../../types';

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface VisibilityState {
    /** Images fully or partially in the viewport - load full resolution */
    fullyVisible: Set<string>;
    /** Images in the buffer zone - load TINY only */
    inBuffer: Set<string>;
    /** Images outside buffer - unload candidates */
    hidden: Set<string>;
}

export interface VisibilityResult {
    state: VisibilityState;
    /** Images with their calculated priority (1 = highest, 0 = lowest) */
    priorities: Map<string, number>;
}

/**
 * Check if an image intersects with a rectangle
 */
function imageIntersectsRect(image: BoardImage, rect: Rect): boolean {
    return (
        image.x < rect.x + rect.width &&
        image.x + image.width > rect.x &&
        image.y < rect.y + rect.height &&
        image.y + image.height > rect.y
    );
}

/**
 * Calculate loading priority based on distance from viewport center.
 * Priority is between 0 (furthest) and 1 (closest to center).
 */
function calculatePriority(image: BoardImage, viewport: Rect): number {
    const viewportCenterX = viewport.x + viewport.width / 2;
    const viewportCenterY = viewport.y + viewport.height / 2;
    
    const imageCenterX = image.x + image.width / 2;
    const imageCenterY = image.y + image.height / 2;
    
    const distance = Math.hypot(imageCenterX - viewportCenterX, imageCenterY - viewportCenterY);
    
    // Normalize by viewport diagonal for consistent priority scaling
    const viewportDiagonal = Math.hypot(viewport.width, viewport.height);
    const normalizedDistance = distance / (viewportDiagonal || 1);
    
    // Inverse relationship: closer = higher priority (capped at 1)
    return Math.max(0, 1 - normalizedDistance);
}

/**
 * Calculate visibility state for all images based on viewport position.
 * 
 * @param images - All board images
 * @param viewport - Current viewport rectangle (in world coordinates)
 * @param bufferMultiplier - How much to extend buffer zone (1.5 = 50% beyond viewport)
 */
export function calculateVisibility(
    images: BoardImage[],
    viewport: Rect,
    bufferMultiplier: number = 1.5
): VisibilityResult {
    const state: VisibilityState = {
        fullyVisible: new Set(),
        inBuffer: new Set(),
        hidden: new Set(),
    };
    
    const priorities = new Map<string, number>();
    
    // Calculate buffer zone (viewport extended by buffer multiplier)
    const bufferPaddingX = (viewport.width * (bufferMultiplier - 1)) / 2;
    const bufferPaddingY = (viewport.height * (bufferMultiplier - 1)) / 2;
    
    const bufferRect: Rect = {
        x: viewport.x - bufferPaddingX,
        y: viewport.y - bufferPaddingY,
        width: viewport.width + bufferPaddingX * 2,
        height: viewport.height + bufferPaddingY * 2,
    };
    
    for (const image of images) {
        const inViewport = imageIntersectsRect(image, viewport);
        const inBuffer = imageIntersectsRect(image, bufferRect);
        
        if (inViewport) {
            state.fullyVisible.add(image.id);
            priorities.set(image.id, calculatePriority(image, viewport));
        } else if (inBuffer) {
            state.inBuffer.add(image.id);
            // Lower priority for buffer zone images
            priorities.set(image.id, calculatePriority(image, viewport) * 0.5);
        } else {
            state.hidden.add(image.id);
            // Zero priority for hidden images (don't load)
            priorities.set(image.id, 0);
        }
    }
    
    return { state, priorities };
}

/**
 * Get world-space viewport from pan/zoom and screen dimensions.
 */
export function getWorldViewport(
    pan: { x: number; y: number },
    zoom: number,
    screenWidth: number,
    screenHeight: number
): Rect {
    return {
        x: -pan.x / zoom,
        y: -pan.y / zoom,
        width: screenWidth / zoom,
        height: screenHeight / zoom,
    };
}
