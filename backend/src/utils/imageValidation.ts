const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB per image
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB per video

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export function validateDataUri(dataUri: string): boolean {
  if (typeof dataUri !== 'string') return false;

  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+);base64,/);
  if (!match) return false;

  const mimeType = match[1];
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return false;

  // Check size (base64 is ~33% larger than binary)
  const base64Data = dataUri.substring(dataUri.indexOf(',') + 1);
  const estimatedSize = (base64Data.length * 3) / 4;

  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (estimatedSize > maxSize) return false;

  return true;
}

const PASSTHROUGH_PREFIXES = [
  'https://res.cloudinary.com/',
  'https://lh3.googleusercontent.com/',
];

export function validateImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img): img is string => {
      if (typeof img !== 'string') return false;
      // Passthrough already-uploaded URLs
      if (PASSTHROUGH_PREFIXES.some((p) => img.startsWith(p))) return true;
      // Passthrough R2 URLs
      if (process.env.R2_PUBLIC_URL && img.startsWith(process.env.R2_PUBLIC_URL)) return true;
      return validateDataUri(img);
    })
    .slice(0, 5);
}
