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

export interface ImageDataUrlOptions {
  maxDimension?: number;
  quality?: number;
  maxBytes?: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function dimensionsFor(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const largest = Math.max(width, height);
  if (largest <= maxDimension) return { width, height };
  const scale = maxDimension / largest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function imageFileToDataUrl(
  file: File,
  options: ImageDataUrlOptions = {},
): Promise<string> {
  const maxDimension = options.maxDimension ?? 1400;
  const maxBytes = options.maxBytes ?? 1_600_000;
  let quality = options.quality ?? 0.82;

  if (!file.type.startsWith('image/')) {
    return readFileAsDataUrl(file);
  }

  const original = await readFileAsDataUrl(file);

  try {
    const image = await loadImage(original);
    const canvas = document.createElement('canvas');
    const size = dimensionsFor(image.naturalWidth || image.width, image.naturalHeight || image.height, maxDimension);
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');
    if (!context) return original;

    context.drawImage(image, 0, 0, size.width, size.height);

    let compressed = canvas.toDataURL('image/jpeg', quality);
    while (compressed.length > maxBytes && quality > 0.45) {
      quality -= 0.1;
      compressed = canvas.toDataURL('image/jpeg', quality);
    }

    return compressed.length < original.length ? compressed : original;
  } catch {
    return original;
  }
}
