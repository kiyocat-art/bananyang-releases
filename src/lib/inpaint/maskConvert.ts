/**
 * OpenAI Images Edit API mask format:
 * - RGBA PNG where alpha=0 (transparent) = edit this area
 * - alpha=255 (opaque) = preserve
 *
 * Bananyang grayscale mask format:
 * - Grayscale PNG where white(255) = edit, black(0) = preserve
 *
 * This function converts grayscale → OpenAI RGBA.
 */
export function convertMaskToOpenAIFormat(grayscaleBase64: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('canvas 2d context unavailable')); return; }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imageData.data;
            for (let i = 0; i < d.length; i += 4) {
                const gray = d[i];
                d[i] = 0;
                d[i + 1] = 0;
                d[i + 2] = 0;
                d[i + 3] = 255 - gray;
            }
            ctx.putImageData(imageData, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl.split(',')[1] ?? '');
        };
        img.onerror = () => reject(new Error('mask image load failed'));
        img.src = `data:image/png;base64,${grayscaleBase64}`;
    });
}
