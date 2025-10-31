/**
 * Convert a File object to base64 string
 * @param file The file to convert
 * @returns Promise that resolves to base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const parts = reader.result.split(',');
      const base64 = parts[1] || reader.result;
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
};