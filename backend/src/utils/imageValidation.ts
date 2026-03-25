const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB per image
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function validateDataUri(dataUri: string): boolean {
  if (typeof dataUri !== 'string') return false;

  // Must start with data:image/
  const match = dataUri.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  if (!match) return false;

  // Check MIME type
  const mimeType = match[1];
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return false;

  // Check size (base64 is ~33% larger than binary)
  const base64Data = dataUri.substring(dataUri.indexOf(',') + 1);
  const estimatedSize = (base64Data.length * 3) / 4;
  if (estimatedSize > MAX_IMAGE_SIZE) return false;

  return true;
}

export function validateImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img): img is string => {
      if (typeof img !== 'string') return false;
      // Passthrough already-uploaded HTTPS URLs
      if (img.startsWith('https://')) return true;
      return validateDataUri(img);
    })
    .slice(0, 5);
}
