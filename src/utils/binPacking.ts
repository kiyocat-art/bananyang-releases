import { BoardImage, BoardGroup } from '../types';

/**
 * Bin packing algorithm for space-efficient image layout
 * Uses shelf-based packing similar to PureRef
 */

interface PackableItem {
    id: string;
    width: number;
    height: number;
}

/**
 * Pack images with role-based priority and normalization:
 * 1. Role images (original, reference, costume, style, pose, background) arranged in order at top-left
 * 2. All images normalized to uniform size (including role images)
 * 3. Images arranged using bin packing
 * 
 * @param items - Items to pack (BoardImages)
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param spacing - Spacing between items
 * @param disableNormalization - If true, keep original sizes
 * @param standardSize - Standard size for normalization (default 512)
 * @returns Map of item IDs to their new positions AND sizes (for normalized images)
 */
export function packImagesWithRolePriority(
    items: BoardImage[],
    startX: number = 0,
    startY: number = 0,
    spacing: number = 20,
    disableNormalization: boolean = false,
    standardSize: number = 512
): Map<string, { x: number; y: number; width?: number; height?: number }> {
    if (items.length === 0) return new Map();


    const positions = new Map<string, { x: number; y: number; width?: number; height?: number }>();

    // Define role priority order
    const rolePriority: Record<string, number> = {
        'original': 1,
        'reference': 2,
        'generalRef': 2,
        'costumeRef': 3,
        'styleRef': 4,
        'poseRef': 5,
        'pose': 5,
        'background': 6,
    };

    // Separate images by role
    const roleImages = items.filter(img => img.role !== 'none').sort((a, b) => {
        const aPriority = rolePriority[a.role] || 999;
        const bPriority = rolePriority[b.role] || 999;
        if (aPriority !== bPriority) return aPriority - bPriority;
        // If same role, sort by refIndex
        if (a.refIndex !== undefined && b.refIndex !== undefined) {
            return a.refIndex - b.refIndex;
        }
        return 0;
    });

    const nonRoleImages = items.filter(img => img.role === 'none');

    if (disableNormalization) {
        // Keep original sizes - place role images first, then non-role images
        let currentX = startX;
        let currentY = startY;
        let maxHeightInRow = 0;

        // Place role images in a row from left to right (keep original sizes)
        for (const roleImage of roleImages) {
            positions.set(roleImage.id, {
                x: currentX,
                y: currentY,
                // Don't change size for role images
            });
            currentX += roleImage.width + spacing;
            maxHeightInRow = Math.max(maxHeightInRow, roleImage.height);
        }

        // Pack non-role images below role images
        if (nonRoleImages.length > 0) {
            const packStartY = roleImages.length > 0 ? currentY + maxHeightInRow + spacing : startY;
            const packedPositions = packImages(nonRoleImages, startX, packStartY, spacing);

            nonRoleImages.forEach(img => {
                const pos = packedPositions.get(img.id);
                if (pos) {
                    positions.set(img.id, {
                        x: pos.x,
                        y: pos.y,
                        // Keep original size
                    });
                }
            });
        }
    } else {
        // Normalize ALL images to standard size (including role images)
        const STANDARD_SIZE = standardSize;

        // Normalize role images
        const normalizedRoleImages = roleImages.map(img => {
            const aspect = img.width / img.height;
            let newWidth: number;
            let newHeight: number;

            if (aspect >= 1) { // Landscape or Square
                newWidth = STANDARD_SIZE;
                newHeight = STANDARD_SIZE / aspect;
            } else { // Portrait
                newHeight = STANDARD_SIZE;
                newWidth = STANDARD_SIZE * aspect;
            }

            return { ...img, width: newWidth, height: newHeight };
        });

        // Normalize non-role images
        const normalizedNonRoleImages = nonRoleImages.map(img => {
            const aspect = img.width / img.height;
            let newWidth: number;
            let newHeight: number;

            if (aspect >= 1) { // Landscape or Square
                newWidth = STANDARD_SIZE;
                newHeight = STANDARD_SIZE / aspect;
            } else { // Portrait
                newHeight = STANDARD_SIZE;
                newWidth = STANDARD_SIZE * aspect;
            }

            return { ...img, width: newWidth, height: newHeight };
        });

        // Place normalized role images in a row first
        let currentX = startX;
        let currentY = startY;
        let maxHeightInRow = 0;

        for (const roleImage of normalizedRoleImages) {
            positions.set(roleImage.id, {
                x: currentX,
                y: currentY,
                width: roleImage.width,
                height: roleImage.height
            });
            currentX += roleImage.width + spacing;
            maxHeightInRow = Math.max(maxHeightInRow, roleImage.height);
        }

        // Pack normalized non-role images below role images
        if (normalizedNonRoleImages.length > 0) {
            const packStartY = normalizedRoleImages.length > 0 ? currentY + maxHeightInRow + spacing : startY;
            const packedPositions = packImages(normalizedNonRoleImages, startX, packStartY, spacing);

            normalizedNonRoleImages.forEach(img => {
                const pos = packedPositions.get(img.id);
                if (pos) {
                    positions.set(img.id, {
                        x: pos.x,
                        y: pos.y,
                        width: img.width,
                        height: img.height
                    });
                }
            });
        }
    }

    return positions;
}



/**
 * Pack items using shelf-based bin packing algorithm
 * Prioritizes space efficiency over semantic ordering
 * 
 * @param items - Items to pack (images or groups)
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param spacing - Spacing between items
 * @returns Map of item IDs to their new positions
 */
export function packImages(
    items: (BoardImage | BoardGroup)[],
    startX: number = 0,
    startY: number = 0,
    spacing: number = 20
): Map<string, { x: number; y: number }> {
    if (items.length === 0) return new Map();

    // Sort by height descending for better packing efficiency
    const sortedItems = [...items].sort((a, b) => b.height - a.height);

    const positions = new Map<string, { x: number; y: number }>();

    // Shelf packing algorithm
    let currentShelfY = startY;
    let currentShelfX = startX;
    let currentShelfHeight = 0;
    let currentShelfWidth = 0;

    // Calculate a reasonable max width for shelves
    // Use the total width of all items divided by sqrt of count as a heuristic
    const totalWidth = sortedItems.reduce((sum, item) => sum + item.width, 0);
    const avgWidth = totalWidth / sortedItems.length;
    const maxShelfWidth = Math.max(
        avgWidth * Math.ceil(Math.sqrt(sortedItems.length) * 1.5),
        sortedItems[0]?.width || 0
    );

    for (const item of sortedItems) {
        // Check if item fits on current shelf
        if (currentShelfX > startX && currentShelfX + item.width > startX + maxShelfWidth) {
            // Start new shelf
            currentShelfY += currentShelfHeight + spacing;
            currentShelfX = startX;
            currentShelfHeight = 0;
            currentShelfWidth = 0;
        }

        // Place item on current shelf
        positions.set(item.id, {
            x: currentShelfX,
            y: currentShelfY
        });

        // Update shelf tracking
        currentShelfX += item.width + spacing;
        currentShelfWidth += item.width + spacing;
        currentShelfHeight = Math.max(currentShelfHeight, item.height);
    }

    return positions;
}

/**
 * Alternative: Guillotine bin packing for even tighter packing
 * This is more complex but can achieve better space utilization
 */
export function packImagesGuillotine(
    items: (BoardImage | BoardGroup)[],
    startX: number = 0,
    startY: number = 0,
    spacing: number = 20
): Map<string, { x: number; y: number }> {
    if (items.length === 0) return new Map();

    // Sort by area descending (larger items first)
    const sortedItems = [...items].sort((a, b) =>
        (b.width * b.height) - (a.width * a.height)
    );

    const positions = new Map<string, { x: number; y: number }>();

    // Free rectangles (available spaces)
    interface FreeRect {
        x: number;
        y: number;
        width: number;
        height: number;
    }

    // Start with one large free rectangle
    const totalArea = sortedItems.reduce((sum, item) => sum + item.width * item.height, 0);
    const estimatedWidth = Math.sqrt(totalArea * 1.5); // 1.5 factor for spacing

    const freeRects: FreeRect[] = [{
        x: startX,
        y: startY,
        width: estimatedWidth,
        height: estimatedWidth
    }];

    for (const item of sortedItems) {
        // Find best fit rectangle
        let bestRect: FreeRect | null = null;
        let bestRectIndex = -1;
        let minWaste = Infinity;

        for (let i = 0; i < freeRects.length; i++) {
            const rect = freeRects[i];

            // Check if item fits
            if (rect.width >= item.width + spacing && rect.height >= item.height + spacing) {
                const waste = (rect.width * rect.height) - (item.width * item.height);
                if (waste < minWaste) {
                    minWaste = waste;
                    bestRect = rect;
                    bestRectIndex = i;
                }
            }
        }

        if (!bestRect) {
            // Fallback: extend the canvas
            const maxY = Math.max(...Array.from(positions.values()).map(p => p.y), startY);
            positions.set(item.id, { x: startX, y: maxY + spacing });
            continue;
        }

        // Place item in best rectangle
        positions.set(item.id, {
            x: bestRect.x,
            y: bestRect.y
        });

        // Remove used rectangle and add new free rectangles (guillotine split)
        freeRects.splice(bestRectIndex, 1);

        // Horizontal split
        if (bestRect.width > item.width + spacing) {
            freeRects.push({
                x: bestRect.x + item.width + spacing,
                y: bestRect.y,
                width: bestRect.width - item.width - spacing,
                height: item.height + spacing
            });
        }

        // Vertical split
        if (bestRect.height > item.height + spacing) {
            freeRects.push({
                x: bestRect.x,
                y: bestRect.y + item.height + spacing,
                width: bestRect.width,
                height: bestRect.height - item.height - spacing
            });
        }
    }

    return positions;
}

/**
 * Result of packing grouped images for AI sort.
 */
export interface GroupPackResult {
    /** Map of image ID → new position & size */
    imagePositions: Map<string, { x: number; y: number; width: number; height: number }>;
    /** Array of generated group bounds */
    groupBounds: { name: string; x: number; y: number; width: number; height: number; imageIds: string[] }[];
}

/**
 * Pack images organized into concept groups, arranging each group
 * internally and then positioning all groups in a roughly square layout.
 * Images retain their original sizes — only positions are computed.
 */
export function packGroupedImages(
    groups: Map<string, BoardImage[]>,
    startX: number = 0,
    startY: number = 0,
    innerSpacing: number = 20,
    outerSpacing: number = 60,
    _standardSize?: number
): GroupPackResult {
    const imagePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    const groupBounds: GroupPackResult['groupBounds'] = [];

    if (groups.size === 0) return { imagePositions, groupBounds };

    // Step 1: For each group, use original image sizes and compute internal layout
    const groupBlocks: {
        name: string;
        width: number;
        height: number;
        imageIds: string[];
        internalPositions: Map<string, { x: number; y: number; width: number; height: number }>;
    }[] = [];

    const LABEL_HEIGHT = 30;

    const standardSize = _standardSize ?? 512;

    for (const [groupName, images] of groups) {
        if (images.length === 0) continue;

        // Use packImagesWithRolePriority for internal layout (role images first row)
        const rawPositions = packImagesWithRolePriority(
            images, 0, LABEL_HEIGHT, innerSpacing, false, standardSize
        );

        const internalPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
        for (const img of images) {
            const pos = rawPositions.get(img.id);
            if (pos) {
                internalPositions.set(img.id, {
                    x: pos.x ?? 0,
                    y: pos.y ?? LABEL_HEIGHT,
                    width: pos.width ?? img.width,
                    height: pos.height ?? img.height,
                });
            }
        }

        let blockWidth = 0;
        let blockHeight = 0;
        for (const pos of internalPositions.values()) {
            blockWidth = Math.max(blockWidth, pos.x + pos.width);
            blockHeight = Math.max(blockHeight, pos.y + pos.height);
        }

        groupBlocks.push({ name: groupName, width: blockWidth, height: blockHeight, imageIds: images.map(img => img.id), internalPositions });
    }

    // Step 2: Arrange group blocks in a roughly square layout
    groupBlocks.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    const totalGroupArea = groupBlocks.reduce((sum, g) => sum + (g.width + outerSpacing) * (g.height + outerSpacing), 0);
    const targetOverallWidth = Math.sqrt(totalGroupArea) * 1.1;

    let currentRowX = startX;
    let currentRowY = startY;
    let currentRowHeight = 0;

    for (const block of groupBlocks) {
        if (currentRowX > startX && currentRowX + block.width > startX + targetOverallWidth) {
            currentRowY += currentRowHeight + outerSpacing;
            currentRowX = startX;
            currentRowHeight = 0;
        }

        for (const [imgId, localPos] of block.internalPositions) {
            imagePositions.set(imgId, {
                x: currentRowX + localPos.x,
                y: currentRowY + localPos.y,
                width: localPos.width,
                height: localPos.height
            });
        }

        groupBounds.push({
            name: block.name,
            x: currentRowX - innerSpacing / 2,
            y: currentRowY - innerSpacing / 2,
            width: block.width + innerSpacing,
            height: block.height + innerSpacing,
            imageIds: block.imageIds
        });

        currentRowX += block.width + outerSpacing;
        currentRowHeight = Math.max(currentRowHeight, block.height);
    }

    return { imagePositions, groupBounds };
}
