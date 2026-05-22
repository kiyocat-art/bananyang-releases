/**
 * Image Optimization Utilities
 * 
 * Provides functions to optimize images for canvas display while preserving originals.
 * - Automatically resizes large images to 1k for canvas display
 * - Preserves original files for AI-generated images
 * - Reduces memory usage and improves performance
 */

/** 무한캔버스 최대 이미지 해상도 (px, 긴 변 기준). 초과 시 자동 다운사이즈 후 원본 제거. */
export const MAX_CANVAS_RESOLUTION = 4096;
/** 무한캔버스 업로드 파일 크기 한도 (bytes). 초과 파일은 업로드 거부. */
export const MAX_UPLOAD_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

export interface ImageOptimizationResult {
    displayFile: File;        // Canvas display file (max 4k)
    originalFile: File;       // Original file
    displaySrc: string;       // Canvas display URL
    proxySrc: string;         // Proxy URL (WebP)
    width: number;            // Display width
    height: number;           // Display height
    originalSrc?: string;     // Original URL (if resized)
    isResized: boolean;       // Whether image was resized
    originalDimensions: {
        width: number;
        height: number;
    };
    displayDimensions: {
        width: number;
        height: number;
    };
    // Tiling support
    highResSrc?: string;
    highResDimensions?: {
        width: number;
        height: number;
    };
}

import { TileData } from '../types';
import { blobManager } from './blobManager';

/**
 * Get image dimensions from a File
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Resize an image to fit within maxSize while maintaining aspect ratio
 */
export async function resizeImage(
    file: File,
    maxSize: number,
    quality: number = 0.9
): Promise<File> {
    const dimensions = await getImageDimensions(file);

    // If image is already smaller than maxSize, return original
    if (dimensions.width <= maxSize && dimensions.height <= maxSize) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calculate new dimensions maintaining aspect ratio
            let newWidth = dimensions.width;
            let newHeight = dimensions.height;

            if (newWidth > newHeight) {
                if (newWidth > maxSize) {
                    newHeight = (newHeight * maxSize) / newWidth;
                    newWidth = maxSize;
                }
            } else {
                if (newHeight > maxSize) {
                    newWidth = (newWidth * maxSize) / newHeight;
                    newHeight = maxSize;
                }
            }

            // Create canvas and resize
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Use high-quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Draw resized image
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // Convert to blob
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create blob'));
                        return;
                    }

                    // Create new file with resized image
                    const resizedFile = new File(
                        [blob],
                        file.name,
                        { type: file.type || 'image/png' }
                    );

                    // [FIX ML-3] 임시 DOM 객체 메모리 즉시 해제
                    canvas.width = 0;
                    canvas.height = 0;

                    resolve(resizedFile);
                },
                file.type || 'image/png',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image for resizing'));
        };

        img.src = url;
    });
}

/**
 * Optimize image for canvas display
 * 
 * @param file - Original image file
 * @param maxDisplaySize - Maximum size for canvas display (default: 2048)
 * @param preserveOriginal - Whether to preserve original for download (default: false)
 * @returns Optimization result with display and original files
 */
/**
 * Optimize image for canvas display
 * 
 * @param file - Original image file
 * @param maxDisplaySize - Maximum size for canvas display (default: 2048)
 * @param preserveOriginal - Whether to preserve original for download (default: false)
 * @returns Optimization result with display and original files
 */
export async function optimizeImageForCanvas(
    file: File,
    maxDisplaySize: number = 2048,
    preserveOriginal: boolean = false
): Promise<ImageOptimizationResult> {
    // Get original dimensions
    const originalDimensions = await getImageDimensions(file);

    // Calculate new dimensions (max 2k)
    let newWidth = originalDimensions.width;
    let newHeight = originalDimensions.height;

    const needsResize = originalDimensions.width > maxDisplaySize || originalDimensions.height > maxDisplaySize;

    if (needsResize) {
        const scale = Math.min(maxDisplaySize / originalDimensions.width, maxDisplaySize / originalDimensions.height);
        newWidth = Math.round(originalDimensions.width * scale);
        newHeight = Math.round(originalDimensions.height * scale);
    }

    // Optimization: If already WebP and no resize needed, return immediately
    if (!needsResize && file.type === 'image/webp') {
        const displaySrc = blobManager.create(file);
        const originalSrc = preserveOriginal ? blobManager.create(file) : undefined;

        return {
            displayFile: file,
            originalFile: file,
            displaySrc,
            proxySrc: displaySrc,
            width: originalDimensions.width,
            height: originalDimensions.height,
            originalSrc,
            isResized: false,
            originalDimensions,
            displayDimensions: originalDimensions
        };
    }

    // Always convert to WebP for memory optimization, even if not resizing
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Use high-quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // Export as WebP with 80% quality
            canvas.toBlob((blob) => {
                if (blob) {
                    // Change extension to .webp
                    const fileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                    const displayFile = new File([blob], fileName, { type: "image/webp" });
                    const displaySrc = blobManager.create(displayFile);

                    // Preserve original for editor and downloads
                    const originalSrc = preserveOriginal ? blobManager.create(file) : undefined;

                    // [FIX ML-3] 임시 DOM 객체 메모리 즉시 해제
                    canvas.width = 0;
                    canvas.height = 0;

                    resolve({
                        displayFile,
                        proxySrc: displaySrc,
                        width: newWidth,
                        height: newHeight,
                        originalFile: file,
                        displaySrc,
                        originalSrc,
                        isResized: true, // Always true effectively since we changed format
                        originalDimensions,
                        displayDimensions: { width: newWidth, height: newHeight }
                    });
                } else {
                    reject(new Error('Failed to create WebP blob'));
                }
            }, "image/webp", 0.8);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
        };

        img.src = objectUrl;
    });
}



/**
 * Calculate display dimensions for canvas while maintaining aspect ratio
 */
export function calculateDisplayDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
    }

    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
    }

    return { width, height };
}

/**
 * Estimate memory usage of an image in MB
 */
export function estimateImageMemoryUsage(width: number, height: number): number {
    // Each pixel uses 4 bytes (RGBA)
    const bytes = width * height * 4;
    return bytes / (1024 * 1024); // Convert to MB
}

/**
 * Get file size in MB
 */
export function getFileSizeMB(file: File): number {
    return file.size / (1024 * 1024);
}

/**
 * Convert any image blob to PNG format
 */
export const convertToPng = (sourceBlob: Blob): Promise<Blob> =>
    createImageBitmap(sourceBlob).then(bitmap => {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
        bitmap.close();
        return new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(b => {
                // [FIX ML-3] 임시 DOM 객체 메모리 즉시 해제
                canvas.width = 0;
                canvas.height = 0;
                b ? resolve(b) : reject(new Error('PNG conversion failed'));
            }, 'image/png')
        );
    });

/**
 * Convert file to WebP format for better compression
 */
export async function convertToWebP(file: File, quality: number = 0.9): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create WebP blob'));
                        return;
                    }

                    // Replace extension with .webp
                    const name = file.name.replace(/\.[^/.]+$/, "") + ".webp";

                    const webpFile = new File(
                        [blob],
                        name,
                        { type: 'image/webp' }
                    );

                    // [FIX ML-3] 임시 DOM 객체 메모리 즉시 해제
                    canvas.width = 0;
                    canvas.height = 0;

                    resolve(webpFile);
                },
                'image/webp',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image for WebP conversion'));
        };

        img.src = url;
    });
}

/**
 * Batch optimize multiple images with progress callback
 */
export async function batchOptimizeImages(
    files: File[],
    maxDisplaySize: number = 512,
    preserveOriginal: boolean = false,
    onProgress?: (current: number, total: number) => void
): Promise<ImageOptimizationResult[]> {
    const results: ImageOptimizationResult[] = [];

    for (let i = 0; i < files.length; i++) {
        const result = await optimizeImageForCanvas(files[i], maxDisplaySize, preserveOriginal);
        results.push(result);

        if (onProgress) {
            onProgress(i + 1, files.length);
        }
    }

    return results;
}

/**
 * Generate workspace thumbnail with bananyang logo overlay
 * Renders ALL images in the workspace (not just visible viewport) with the app logo
 * 
 * @param boardImages - Array of all images in the workspace
 * @param logoSrc - URL or path to the logo image
 * @param maxSize - Maximum thumbnail size (default: 256)
 * @returns Base64 string of the thumbnail image for embedding in .rfy file
 */
export async function generateWorkspaceThumbnail(
    boardImages: Array<{ x: number; y: number; width: number; height: number; src: string }>,
    logoSrc: string,
    maxSize: number = 512
): Promise<string | null> {
    return new Promise(async (resolve) => {
        try {
            if (boardImages.length === 0) {
                const emptyCanvas = document.createElement('canvas');
                emptyCanvas.width = maxSize;
                emptyCanvas.height = maxSize;
                const emptyCtx = emptyCanvas.getContext('2d');
                if (!emptyCtx) { resolve(null); return; }
                emptyCtx.fillStyle = '#1a1a1a';
                emptyCtx.fillRect(0, 0, maxSize, maxSize);
                const emptyLogoImg = await new Promise<HTMLImageElement | null>((res) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => res(img);
                    img.onerror = () => res(null);
                    img.src = logoSrc;
                });
                if (emptyLogoImg) {
                    const logoSize = maxSize * 0.30;
                    const logoX = (maxSize - logoSize) / 2;
                    const logoY = (maxSize - logoSize) / 2;
                    emptyCtx.save();
                    emptyCtx.globalAlpha = 1;
                    emptyCtx.drawImage(emptyLogoImg, logoX, logoY, logoSize, logoSize);
                    emptyCtx.restore();
                }
                resolve(emptyCanvas.toDataURL('image/png'));
                return;
            }

            // Calculate bounds of all images
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const img of boardImages) {
                minX = Math.min(minX, img.x);
                minY = Math.min(minY, img.y);
                maxX = Math.max(maxX, img.x + img.width);
                maxY = Math.max(maxY, img.y + img.height);
            }

            const contentWidth = maxX - minX;
            const contentHeight = maxY - minY;

            // Add padding around content (10%)
            const padding = Math.max(contentWidth, contentHeight) * 0.1;
            const totalWidth = contentWidth + padding * 2;
            const totalHeight = contentHeight + padding * 2;

            // Calculate thumbnail dimensions maintaining aspect ratio
            const aspectRatio = totalWidth / totalHeight;
            let thumbWidth = maxSize;
            let thumbHeight = maxSize;

            if (aspectRatio > 1) {
                thumbHeight = maxSize / aspectRatio;
            } else {
                thumbWidth = maxSize * aspectRatio;
            }

            // Create thumbnail canvas
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = thumbWidth;
            thumbCanvas.height = thumbHeight;
            const ctx = thumbCanvas.getContext('2d');

            if (!ctx) {
                console.error('Failed to get thumbnail canvas context');
                resolve(null);
                return;
            }

            // Fill with dark background
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, thumbWidth, thumbHeight);

            // Calculate scale to fit all content
            const scale = Math.min(thumbWidth / totalWidth, thumbHeight / totalHeight);

            // Load and draw all images
            const loadImage = (src: string): Promise<HTMLImageElement | null> => {
                return new Promise((res) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => res(img);
                    img.onerror = () => res(null);
                    img.src = src;
                });
            };

            // Load all images in parallel
            const loadedImages = await Promise.all(
                boardImages.map(async (imgData) => ({
                    ...imgData,
                    element: await loadImage(imgData.src)
                }))
            );

            // Draw each image at scaled position
            for (const imgData of loadedImages) {
                if (imgData.element) {
                    const drawX = (imgData.x - minX + padding) * scale;
                    const drawY = (imgData.y - minY + padding) * scale;
                    const drawWidth = imgData.width * scale;
                    const drawHeight = imgData.height * scale;

                    ctx.drawImage(imgData.element, drawX, drawY, drawWidth, drawHeight);
                }
            }

            // 중앙 로고 오버레이 (썸네일 짧은 변의 30%, alpha 0.75)
            const logoImg = await loadImage(logoSrc);
            if (logoImg) {
                const logoSize = Math.min(thumbWidth, thumbHeight) * 0.30;
                const logoX = (thumbWidth - logoSize) / 2;
                const logoY = (thumbHeight - logoSize) / 2;
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
                ctx.restore();
            }

            const base64 = thumbCanvas.toDataURL('image/png');
            resolve(base64);
        } catch (error) {
            console.error('Failed to generate thumbnail:', error);
            resolve(null);
        }
    });
}
