import { generateThumbnail } from '../utils/imageUtils';
import { blobManager } from '../utils/blobManager';
// @ts-ignore
import { readPsd } from 'ag-psd/dist/bundle.js';
import * as EXR from 'parse-exr';

export interface ProcessedImage {
    src: string;
    file?: File;
    width: number;
    height: number;
    thumbnailSrc: string;
    bitmap: ImageBitmap;
}

class ImageLoaderService {
    private static instance: ImageLoaderService;

    private constructor() { }

    public static getInstance(): ImageLoaderService {
        if (!ImageLoaderService.instance) {
            ImageLoaderService.instance = new ImageLoaderService();
        }
        return ImageLoaderService.instance;
    }

    public async processImage(file: File, customId?: string, skipThumbnail: boolean = false): Promise<ProcessedImage> {
        const extension = file.name.split('.').pop()?.toLowerCase();
        let bitmap: ImageBitmap;
        let src: string;

        if (extension === 'psd') {
            const buffer = await file.arrayBuffer();
            const psd = readPsd(buffer);

            const canvas = document.createElement('canvas');
            canvas.width = psd.width;
            canvas.height = psd.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            const imageData = ctx.createImageData(psd.width, psd.height);

            if (psd.imageData) {
                imageData.data.set(psd.imageData);
                ctx.putImageData(imageData, 0, 0);
            } else {
                console.warn('PSD parsing: No composite image data found.');
            }

            bitmap = await createImageBitmap(canvas);

            // Create a blob URL for the src
            const blob = await new Promise<Blob | null>(r => canvas.toBlob(r));
            if (blob) src = blobManager.create(blob);
            else src = blobManager.create(file);

        } else if (extension === 'exr') {
            const buffer = await file.arrayBuffer();
            // @ts-ignore
            const exrData = EXR.parse(buffer);

            const canvas = document.createElement('canvas');
            canvas.width = exrData.width;
            canvas.height = exrData.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            const imageData = ctx.createImageData(exrData.width, exrData.height);
            const data = imageData.data;
            const srcData = exrData.data; // Float32Array

            // Simple Gamma 2.2 Tone Mapping
            for (let i = 0, j = 0; i < data.length; i += 4, j += 4) {
                let r = srcData[j];
                let g = srcData[j + 1];
                let b = srcData[j + 2];
                let a = srcData[j + 3] ?? 1.0;

                r = Math.pow(Math.max(0, r), 1.0 / 2.2);
                g = Math.pow(Math.max(0, g), 1.0 / 2.2);
                b = Math.pow(Math.max(0, b), 1.0 / 2.2);

                data[i] = Math.min(255, r * 255);
                data[i + 1] = Math.min(255, g * 255);
                data[i + 2] = Math.min(255, b * 255);
                data[i + 3] = Math.min(255, a * 255);
            }

            ctx.putImageData(imageData, 0, 0);
            bitmap = await createImageBitmap(canvas);

            const blob = await new Promise<Blob | null>(r => canvas.toBlob(r));
            if (blob) src = blobManager.create(blob);
            else src = blobManager.create(file);

        } else {
            // Normal images - use direct blob URL for better performance
            bitmap = await createImageBitmap(file);
            src = blobManager.create(file);
        }

        let { width, height } = bitmap;
        const MAX_DIM = 800;
        if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) { height = (height / width) * MAX_DIM; width = MAX_DIM; }
            else { width = (width / height) * MAX_DIM; height = MAX_DIM; }
        }

        // Generate thumbnail (or use placeholder if skipped)
        let thumbnailSrc: string;
        if (skipThumbnail) {
            // Use a simple placeholder data URL
            thumbnailSrc = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256"%3E%3Crect fill="%23333" width="256" height="256"/%3E%3C/svg%3E';
        } else if (extension === 'psd' || extension === 'exr') {
            const thumbCanvas = document.createElement('canvas');
            const thumbScale = Math.min(256 / width, 256 / height, 1);
            thumbCanvas.width = width * thumbScale;
            thumbCanvas.height = height * thumbScale;
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCtx?.drawImage(bitmap, 0, 0, thumbCanvas.width, thumbCanvas.height);
            thumbnailSrc = thumbCanvas.toDataURL();
        } else {
            thumbnailSrc = await generateThumbnail(file);
        }

        // Dispatch event for worker
        // Use customId if provided (for restoring sessions), otherwise use the new src
        window.dispatchEvent(new CustomEvent('canvas-add-resource', { detail: { id: customId || src, bitmap } }));

        // [FIX BLOB-LEAK #5] When customId is provided, the worker registers the texture under
        // customId — the newly-created blob URL (src) is never referenced by any image object
        // and becomes an orphan. Release it immediately so it doesn't accumulate.
        if (customId && src !== customId && src.startsWith('blob:')) {
            blobManager.release(src);
            src = customId;
        }

        return {
            src,
            file,
            width,
            height,
            thumbnailSrc,
            bitmap
        };
    }

    public async processUrl(url: string, id: string): Promise<ProcessedImage> {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], `generated-${id}.png`, { type: blob.type });

        // Pass the original ID (url) to processImage so it dispatches the event with the correct ID
        return this.processImage(file, id);
    }
}

export const imageLoader = ImageLoaderService.getInstance();
