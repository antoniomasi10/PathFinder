/**
 * Translation service — LibreTranslate (Argos) for IT → other languages.
 *
 * Italian-language translation of opportunities is handled by OpenAI in
 * `ai/opportunityParser.translateOpportunityToItalian`. This file now only
 * exposes `translateBatch`, used by `opportunityTranslation.service` to
 * render Italian content into other UI languages on demand.
 */

import { logger } from '../utils/logger';

const LIBRE_URL = process.env.LIBRETRANSLATE_URL || 'http://libretranslate:5000';

/**
 * Translate an array of Italian strings to `targetLang` via self-hosted
 * LibreTranslate. Falls back to the original strings on any error.
 */
export async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  if (targetLang === 'it' || texts.length === 0) return texts;
  const CHUNK = 5;
  if (texts.length > CHUNK) {
    const results: string[] = [];
    for (let i = 0; i < texts.length; i += CHUNK) {
      const chunk = await translateBatch(texts.slice(i, i + CHUNK), targetLang);
      results.push(...chunk);
    }
    return results;
  }
  try {
    const res = await fetch(`${LIBRE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, source: 'en', target: targetLang, format: 'text' }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return texts;
    const data = await res.json() as { translatedText?: string[] };
    return Array.isArray(data.translatedText) ? data.translatedText : texts;
  } catch (err) {
    logger.debug(`[Translation] LibreTranslate failed: ${err}`);
    return texts;
  }
}
