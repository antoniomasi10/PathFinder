const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB per image
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB per video

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

/**
 * Magic-byte signatures for allowed file types.
 * We decode the first few bytes of the base64 payload and compare against known signatures.
 * This prevents MIME-type spoofing (e.g. attacker declares "image/png" but sends a script).
 */
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP (checked separately)
  { mime: 'video/mp4',  bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp box at byte 4
  { mime: 'video/webm', bytes: [0x1A, 0x45, 0xDF, 0xA3] },
];

function checkMagicBytes(mimeType: string, buffer: Buffer): boolean {
  const sigs = MAGIC_BYTES.filter((s) => s.mime === mimeType);
  if (sigs.length === 0) return true; // no signature defined — trust MIME (quicktime/mov)

  for (const sig of sigs) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;

    const match = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (!match) continue;

    // Extra check for WebP: bytes 8-11 must be "WEBP"
    if (mimeType === 'image/webp') {
      const webp = buffer.slice(8, 12).toString('ascii');
      if (webp !== 'WEBP') continue;
    }

    return true;
  }

  return false;
}

export function validateDataUri(dataUri: string): boolean {
  if (typeof dataUri !== 'string') return false;

  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+);base64,/);
  if (!match) return false;

  const mimeType = match[1];
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return false;

  const base64Data = dataUri.substring(dataUri.indexOf(',') + 1);
  const estimatedSize = (base64Data.length * 3) / 4;

  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (estimatedSize > maxSize) return false;

  // Verify magic bytes against actual file content
  const headerB64 = base64Data.slice(0, 24); // first ~18 raw bytes is enough
  const headerBuf = Buffer.from(headerB64, 'base64');
  if (!checkMagicBytes(mimeType, headerBuf)) return false;

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
