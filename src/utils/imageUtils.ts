import { BoardImage } from '../types';
import { blobManager } from './blobManager';

export const generateThumbnail = (file: File, maxDim = 256): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (typeof e.target?.result !== 'string') {
                return reject('Failed to read file as data URL');
            }
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('Could not get canvas context');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (err) => reject(err);
            img.src = e.target.result as string;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

// Optimized thumbnail generation from Data URL (skips FileReader step)
export const generateThumbnailFromDataURL = (dataUrl: string, maxDim = 256): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > height) {
                if (width > maxDim) {
                    height *= maxDim / width;
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width *= maxDim / height;
                    height = maxDim;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (err) => reject(err);
        img.src = dataUrl;
    });
};

export const ensureBoardImageFile = async (image: BoardImage, type: 'display' | 'original' = 'display'): Promise<File | undefined> => {
    // 1. Check existing file object
    if (type === 'display' && image.file) return image.file;
    if (type === 'original' && image.originalFile) return image.originalFile;
    if (type === 'original' && !image.originalFile && image.file) return image.file; // Fallback to display file

    // 2. Check file path (try file:// fetch first, then IPC fallback)
    const path = type === 'display'
        ? (image.filePath || image.originalFilePath)
        : (image.originalFilePath || image.filePath);

    if (path) {
        // 2a. Try file:// protocol fetch
        try {
            const response = await fetch(`file://${path}`);
            const blob = await response.blob();
            const filename = path.split(/[/\\]/).pop() || 'image.png';
            return new File([blob], filename, { type: blob.type });
        } catch (e) {
            console.warn(`[ensureBoardImageFile] file:// fetch failed for path: ${path}`, e);
        }

        // 2b. [FIX STALE-BLOB] Fallback: Electron IPC readBinaryFile (more reliable than file:// fetch)
        if (window.electronAPI?.readBinaryFile) {
            try {
                const base64 = await window.electronAPI.readBinaryFile(path);
                if (base64) {
                    const ext = path.split('.').pop()?.toLowerCase();
                    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                    const res = await fetch(`data:${mimeType};base64,${base64}`);
                    const blob = await res.blob();
                    const filename = path.split(/[/\\]/).pop() || 'image.png';
                    return new File([blob], filename, { type: mimeType });
                }
            } catch (e) {
                console.warn(`[ensureBoardImageFile] IPC readBinaryFile failed for path: ${path}`, e);
            }
        }
    }

    // 3. Try blob URL fetch (may fail if blob was revoked)
    const src = type === 'display' ? image.src : (image.originalSrc || image.src);
    if (src && src.startsWith('blob:')) {
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            return new File([blob], 'recovered.png', { type: blob.type });
        } catch (e) {
            console.warn(`[ensureBoardImageFile] Failed to load file from blob src: ${src}`, e);
        }
    }

    // 4. [FIX STALE-BLOB] Try file:// URL src via IPC (disk-offloaded images)
    const fileSrc = type === 'display' ? image.src : (image.originalSrc || image.src);
    if (fileSrc && fileSrc.startsWith('file://') && window.electronAPI?.readBinaryFile) {
        try {
            let filePath = fileSrc.replace('file:///', '');
            if (!(filePath.length > 2 && filePath[1] === ':')) {
                filePath = fileSrc.replace('file://', '');
            }
            filePath = decodeURIComponent(filePath);
            const base64 = await window.electronAPI.readBinaryFile(filePath);
            if (base64) {
                const ext = filePath.split('.').pop()?.toLowerCase();
                const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                const res = await fetch(`data:${mimeType};base64,${base64}`);
                const blob = await res.blob();
                const filename = filePath.split(/[/\\]/).pop() || 'image.png';
                return new File([blob], filename, { type: mimeType });
            }
        } catch (e) {
            console.warn(`[ensureBoardImageFile] IPC fallback for file:// src failed: ${fileSrc}`, e);
        }
    }

    // 5. [FIX STALE-BLOB] Last resort: try other LOD sources (lower quality is better than nothing)
    const lodSources = type === 'original'
        ? [image.src, image.proxySrc, image.previewSrc, image.tinySrc]
        : [image.proxySrc, image.previewSrc, image.tinySrc];

    for (const lodSrc of lodSources) {
        if (!lodSrc || lodSrc === src || lodSrc === fileSrc) continue; // Already tried

        try {
            if (lodSrc.startsWith('blob:')) {
                const response = await fetch(lodSrc);
                if (response.ok) {
                    const blob = await response.blob();
                    console.warn(`[ensureBoardImageFile] Recovered from LOD fallback (blob): ${lodSrc}`);
                    return new File([blob], 'recovered-lod.png', { type: blob.type });
                }
            } else if (lodSrc.startsWith('file://') && window.electronAPI?.readBinaryFile) {
                let filePath = lodSrc.replace('file:///', '');
                if (!(filePath.length > 2 && filePath[1] === ':')) {
                    filePath = lodSrc.replace('file://', '');
                }
                filePath = decodeURIComponent(filePath);
                const base64 = await window.electronAPI.readBinaryFile(filePath);
                if (base64) {
                    const ext = filePath.split('.').pop()?.toLowerCase();
                    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                    const res = await fetch(`data:${mimeType};base64,${base64}`);
                    const blob = await res.blob();
                    console.warn(`[ensureBoardImageFile] Recovered from LOD fallback (file://): ${lodSrc}`);
                    return new File([blob], 'recovered-lod.png', { type: mimeType });
                }
            }
        } catch {
            // Continue to next LOD source
        }
    }

    console.error(`[ensureBoardImageFile] All recovery attempts failed for image ${image.id} (type: ${type})`);
    return undefined;
};

export const dataURLtoFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
};

/**
 * Generate a tiny proxy image (128px) as Blob URL for efficient GPU texture loading
 * Unlike generateThumbnail which returns data URL, this returns Blob URL for better VRAM efficiency
 */
export const generateTinySrc = (file: File, maxDim = 128): Promise<{ tinySrc: string; tinyFile: File; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);

            const { naturalWidth: originalWidth, naturalHeight: originalHeight } = img;
            let width = originalWidth;
            let height = originalHeight;

            // Scale down to fit within maxDim
            if (width > height) {
                if (width > maxDim) {
                    height = Math.round(height * maxDim / width);
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width = Math.round(width * maxDim / height);
                    height = maxDim;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to create blob'));
                    return;
                }

                const tinyFile = new File([blob], 'tiny.jpg', { type: 'image/jpeg' });
                const tinySrc = blobManager.create(blob);
                resolve({ tinySrc, tinyFile, width: originalWidth, height: originalHeight });
            }, 'image/jpeg', 0.8);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
};

/**
 * Generate a proxy image (1K) as Blob URL for medium zoom levels
 */
export const generateProxySrc = (file: File, maxDim = 1024): Promise<{ proxySrc: string; proxyFile: File }> => {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { naturalWidth: width, naturalHeight: height } = img;

            // If already smaller than maxDim, return original
            if (width <= maxDim && height <= maxDim) {
                const proxySrc = blobManager.create(file);
                resolve({ proxySrc, proxyFile: file });
                return;
            }

            // Scale down to fit within maxDim
            if (width > height) {
                height = Math.round(height * maxDim / width);
                width = maxDim;
            } else {
                width = Math.round(width * maxDim / height);
                height = maxDim;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to create blob'));
                    return;
                }

                const proxyFile = new File([blob], 'proxy.jpg', { type: 'image/jpeg' });
                const proxySrc = blobManager.create(blob);
                resolve({ proxySrc, proxyFile });
            }, 'image/jpeg', 0.85);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
};
