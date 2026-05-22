/**
 * Spatial Index Utility (RBush-based R-tree)
 *
 * Provides O(log n) point and AABB queries over canvas objects.
 * Used by hitTest (click), viewport culling, and marquee selection.
 *
 * Analogy: Like a library's card catalog — instead of checking every book (O(n)),
 * we use an index to jump directly to the relevant section (O(log n)).
 */
import RBush from 'rbush';
import { BoardImage, BoardGroup } from '../types';

export interface SpatialItem {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    id: string;
    type: 'image' | 'group';
    zIndex: number;
}

/**
 * Build a fresh RBush tree from the current board state.
 * Uses bulk load (O(n log n)) which is faster than sequential inserts.
 */
export function buildSpatialIndex(
    boardImages: BoardImage[],
    boardGroups: BoardGroup[],
): RBush<SpatialItem> {
    const tree = new RBush<SpatialItem>();
    const items: SpatialItem[] = [];

    for (const img of boardImages) {
        items.push({
            minX: img.x,
            minY: img.y,
            maxX: img.x + img.width,
            maxY: img.y + img.height,
            id: img.id,
            type: 'image',
            zIndex: img.zIndex,
        });
    }

    for (const group of boardGroups) {
        items.push({
            minX: group.x,
            minY: group.y,
            maxX: group.x + group.width,
            maxY: group.y + group.height,
            id: group.id,
            type: 'group',
            zIndex: group.zIndex,
        });
    }

    tree.load(items);
    return tree;
}

/**
 * Hit-test a world-space point against the spatial index.
 * Returns the topmost (highest z-index) item under the point.
 */
export function hitTestPoint(
    tree: RBush<SpatialItem>,
    worldX: number,
    worldY: number,
): { type: 'image' | 'group'; id: string } | null {
    const results = tree.search({
        minX: worldX, minY: worldY,
        maxX: worldX, maxY: worldY,
    });

    if (results.length === 0) return null;

    // Sort descending by zIndex — topmost item wins
    results.sort((a, b) => b.zIndex - a.zIndex);
    return { type: results[0].type, id: results[0].id };
}

/**
 * Query all items whose bounding box intersects the given AABB.
 * Used for marquee selection and viewport culling.
 */
export function queryAABB(
    tree: RBush<SpatialItem>,
    minX: number, minY: number,
    maxX: number, maxY: number,
): SpatialItem[] {
    return tree.search({ minX, minY, maxX, maxY });
}
