import { BoardImage, BoardGroup } from '../types';
import { blobManager } from './blobManager';

export const revokeImageResources = (img: BoardImage) => {
    // Use blob manager for centralized cleanup
    blobManager.revoke(img.src);
    blobManager.revoke(img.thumbnailSrc);
    blobManager.revoke(img.maskSrc);
    // [FIX] Revoke LOD and optimization blobs
    blobManager.revoke(img.tinySrc);
    blobManager.revoke(img.previewSrc);
    blobManager.revoke(img.proxySrc);
    blobManager.revoke(img.ktx2Src);
    blobManager.revoke(img.highResSrc);
    // [FIX B-1] originalSrc was missing - memory leak
    blobManager.revoke(img.originalSrc);
};

export const updateActiveReferenceIndex = (boardImages: BoardImage[], selectedImageIds: Set<string>): number | null => {
    if (selectedImageIds.size === 1) {
        const selectedId = Array.from(selectedImageIds)[0];
        const selectedImage = boardImages.find(img => img.id === selectedId);
        if (selectedImage && (selectedImage.role === 'reference' || selectedImage.role === 'costumeRef' || selectedImage.role === 'poseRef' || selectedImage.role === 'generalRef') && selectedImage.refIndex !== undefined) {
            return selectedImage.refIndex;
        }
    }

    // Find first reference
    const validReferences = boardImages.filter(img => img.role === 'reference' || img.role === 'costumeRef' || img.role === 'poseRef' || img.role === 'generalRef');
    if (validReferences.length > 0) {
        // Sort by refIndex to find the "first" one
        validReferences.sort((a, b) => (a.refIndex ?? 0) - (b.refIndex ?? 0));
        return validReferences[0].refIndex ?? null;
    }

    return null;
};

export const alignGrid = (itemsToAlign: (BoardImage | BoardGroup)[], startX?: number, startY?: number): Map<string, { x: number, y: number }> => {
    if (itemsToAlign.length === 0) return new Map();

    const SPACING = 20;
    const minX = startX ?? Math.min(...itemsToAlign.map(i => i.x));
    const minY = startY ?? Math.min(...itemsToAlign.map(i => i.y));

    const numCols = Math.max(1, Math.round(Math.sqrt(itemsToAlign.length)));
    const colHeights = Array(numCols).fill(minY);
    const itemsInCols: (BoardImage | BoardGroup)[][] = Array.from({ length: numCols }, () => []);

    itemsToAlign.forEach(item => {
        const shortestColIndex = colHeights.indexOf(Math.min(...colHeights));
        itemsInCols[shortestColIndex].push(item);
        colHeights[shortestColIndex] += item.height + SPACING;
    });

    const colMaxWidths = itemsInCols.map(col => Math.max(0, ...col.map(img => img.width)));
    const colXOffsets: number[] = [];
    let currentX = minX;
    for (let i = 0; i < numCols; i++) {
        colXOffsets.push(currentX);
        currentX += colMaxWidths[i] + SPACING;
    }

    const updates = new Map<string, { x: number, y: number }>();
    for (let i = 0; i < numCols; i++) {
        let currentY = minY;
        const columnX = colXOffsets[i];
        const columnWidth = colMaxWidths[i];
        itemsInCols[i].forEach(item => {
            const itemX = columnX + (columnWidth - item.width) / 2;
            updates.set(item.id, { x: itemX, y: currentY });
            currentY += item.height + SPACING;
        });
    }
    return updates;
};

export const resizeGroup = (groupId: string, boardImages: BoardImage[], boardGroups: BoardGroup[]): { boardGroups: BoardGroup[] } => {
    const group = boardGroups.find(g => g.id === groupId);
    if (!group) return { boardGroups };

    const imagesInGroup = boardImages.filter(img => img.groupId === groupId);
    if (imagesInGroup.length === 0) {
        return { boardGroups: boardGroups.filter(g => g.id !== groupId) };
    }

    const PADDING = 20;
    const minX = Math.min(...imagesInGroup.map(i => i.x));
    const minY = Math.min(...imagesInGroup.map(i => i.y));
    const maxX = Math.max(...imagesInGroup.map(i => i.x + i.width));
    const maxY = Math.max(...imagesInGroup.map(i => i.y + i.height));

    const updatedGroups = boardGroups.map(g => {
        if (g.id === groupId) {
            return {
                ...g,
                x: minX - PADDING,
                y: minY - PADDING,
                width: (maxX - minX) + PADDING * 2,
                height: (maxY - minY) + PADDING * 2,
            };
        }
        return g;
    });

    return { boardGroups: updatedGroups };
};
