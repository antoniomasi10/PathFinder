import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import r2Client, { R2_BUCKET, R2_CONFIGURED } from '../lib/r2';
import cloudinary from '../lib/cloudinary';
import { logger } from './logger';

const CLOUDINARY_CONFIGURED =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

/** Already-uploaded URLs that should be passed through without re-uploading. */
const PASSTHROUGH_PREFIXES = [
  'https://res.cloudinary.com/',
  'https://lh3.googleusercontent.com/',
  `https://${process.env.R2_BUCKET_NAME}.`,
];

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

function isPassthroughUrl(value: string): boolean {
  return PASSTHROUGH_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/**
 * Parse a data URI into its MIME type and raw buffer.
 */
function parseDataUri(dataUri: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

/**
 * Upload a single base64 data URI to Cloudflare R2.
 * Falls back to Cloudinary, then to returning the data URI as-is.
 */
export async function uploadToR2(dataUri: string, folder: string): Promise<string> {
  if (isPassthroughUrl(dataUri)) return dataUri;

  const parsed = parseDataUri(dataUri);
  if (!parsed) throw new Error('Formato file non valido');

  const ext = MIME_TO_EXT[parsed.mimeType];
  if (!ext) throw new Error(`Tipo file non supportato: ${parsed.mimeType}`);

  const key = `${folder}/${randomUUID()}.${ext}`;

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: parsed.buffer,
        ContentType: parsed.mimeType,
      }),
    );

    // Build public URL from R2 endpoint
    // R2 public URLs follow the pattern: https://<custom-domain>/<key>
    // or https://pub-<hash>.r2.dev/<key>
    const endpoint = process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT || '';
    return `${endpoint.replace(/\/$/, '')}/${key}`;
  } catch (err) {
    logger.error('R2 upload failed', { error: String(err), folder, key });
    throw new Error('Upload file fallito');
  }
}

/**
 * Upload a single base64 data URI to Cloudinary (images only).
 */
async function uploadToCloudinary(dataUri: string, folder: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `pathfinder/${folder}`,
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    });
    return result.secure_url;
  } catch (err) {
    logger.error('Cloudinary upload failed', { error: String(err), folder });
    throw new Error('Upload immagine fallito');
  }
}

/**
 * Upload a single base64 data URI.
 * Priority: R2 → Cloudinary → passthrough (dev fallback).
 */
export async function uploadImage(dataUri: string, folder: string): Promise<string> {
  if (isPassthroughUrl(dataUri)) return dataUri;

  if (R2_CONFIGURED) return uploadToR2(dataUri, folder);
  if (CLOUDINARY_CONFIGURED) return uploadToCloudinary(dataUri, folder);

  // Dev fallback: return data URI as-is
  return dataUri;
}

/**
 * Upload multiple base64 data URIs.
 */
export async function uploadImages(dataUris: string[], folder: string): Promise<string[]> {
  if (dataUris.length === 0) return [];
  return Promise.all(dataUris.map((uri) => uploadImage(uri, folder)));
}
