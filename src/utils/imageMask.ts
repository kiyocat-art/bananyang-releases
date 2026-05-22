/**
 * Applies a white/black mask to an image using alpha compositing.
 * White mask pixels = keep, black mask pixels = transparent.
 * Returns a new PNG File containing only the unmasked (white) region.
 */
export async function applyAlphaCut(imageFile: File, maskFile: File): Promise<File> {
    const [imgBitmap, maskBitmap] = await Promise.all([
        createImageBitmap(imageFile),
        createImageBitmap(maskFile),
    ]);

    const canvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context for alpha cut');

    // First draw mask as grayscale, convert white=opaque / black=transparent via channel ops
    const maskCanvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) throw new Error('Failed to get mask context for alpha cut');

    maskCtx.drawImage(maskBitmap, 0, 0, imgBitmap.width, imgBitmap.height);
    const maskImageData = maskCtx.getImageData(0, 0, imgBitmap.width, imgBitmap.height);

    // Convert white pixels to fully opaque, black pixels to transparent
    const { data } = maskImageData;
    for (let i = 0; i < data.length; i += 4) {
        const luminance = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i + 3] = Math.round(luminance); // alpha = luminance (white=255, black=0)
    }
    maskCtx.putImageData(maskImageData, 0, 0);

    // Draw original image, then apply mask as alpha
    ctx.drawImage(imgBitmap, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const baseName = imageFile.name.replace(/\.\w+$/, '');
    return new File([blob], `${baseName}_masked.png`, { type: 'image/png' });
}
