export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                // The result includes the mime type prefix, e.g., "data:image/png;base64,..."
                // We only need the base64 part.
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file as a base64 string.'));
            }
        };
        reader.onerror = error => reject(error);
    });
};
