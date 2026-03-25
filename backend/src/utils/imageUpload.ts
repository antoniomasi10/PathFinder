import cloudinary from '../lib/cloudinary';
import { logger } from './logger';

const CLOUDINARY_CONFIGURED =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

/**
 * Upload a single base64 data URI to Cloudinary.
 * If Cloudinary is not configured, returns the data URI as-is (dev fallback).
 */
export async function uploadImage(dataUri: string, folder: string): Promise<string> {
  // Already a URL (e.g. previously uploaded or Google avatar) — passthrough
  if (dataUri.startsWith('https://')) return dataUri;

  if (!CLOUDINARY_CONFIGURED) return dataUri;

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
 * Upload multiple base64 data URIs to Cloudinary.
 */
export async function uploadImages(dataUris: string[], folder: string): Promise<string[]> {
  if (dataUris.length === 0) return [];
  return Promise.all(dataUris.map((uri) => uploadImage(uri, folder)));
}
