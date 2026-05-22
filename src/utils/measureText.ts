/**
 * Measures the dimensions of text based on font properties
 * @param text - The text content to measure
 * @param fontSize - Font size in pixels
 * @param fontFamily - Font family (default: 'Arial, sans-serif')
 * @param maxWidth - Maximum width before wrapping (optional)
 * @returns Object containing width and height of the text
 */
export function measureText(
    text: string,
    fontSize: number,
    fontFamily: string = 'Arial, sans-serif',
    maxWidth?: number
): { width: number; height: number } {
    // Create a temporary canvas for text measurement
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        // Fallback if canvas context is not available
        return { width: 200, height: 100 };
    }

    context.font = `${fontSize}px ${fontFamily}`;

    // Split text by explicit line breaks
    const explicitLines = text.split('\n');
    const allLines: string[] = [];

    // If maxWidth is provided, handle word wrapping
    if (maxWidth) {
        explicitLines.forEach(line => {
            if (line === '') {
                allLines.push('');
                return;
            }

            const words = line.split(' ');
            let currentLine = '';

            words.forEach((word, index) => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const metrics = context.measureText(testLine);

                if (metrics.width > maxWidth - 16 && currentLine) {
                    allLines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }

                if (index === words.length - 1) {
                    allLines.push(currentLine);
                }
            });
        });
    } else {
        allLines.push(...explicitLines);
    }

    let maxLineWidth = 0;

    // Measure each line
    allLines.forEach((line) => {
        const metrics = context.measureText(line);
        maxLineWidth = Math.max(maxLineWidth, metrics.width);
    });

    // Calculate total height based on number of lines
    const lineHeight = fontSize * 1.2; // 1.2 is line height multiplier
    const totalHeight = allLines.length * lineHeight;

    // Add padding
    const padding = 16; // 8px padding on each side
    const width = Math.max(100, maxLineWidth + padding); // Minimum width of 100
    const height = Math.max(40, totalHeight + padding); // Minimum height of 40

    return { width, height };
}
