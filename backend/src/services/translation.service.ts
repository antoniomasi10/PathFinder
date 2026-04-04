/**
 * DeepL Translation Service
 *
 * Translates opportunity content (title, description) to Italian at import time.
 * Translation happens only once per new opportunity — existing records are never
 * re-translated, so API credit is consumed only on first discovery.
 *
 * If DEEPL_API_KEY is not set, all functions return the original text unchanged.
 * Free tier: 500,000 characters/month (≈ 500–1,000 typical opportunities).
 */

import * as deepl from 'deepl-node';
import { logger } from '../utils/logger';

let _translator: deepl.Translator | null = null;

function getTranslator(): deepl.Translator | null {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;
  if (!_translator) _translator = new deepl.Translator(key);
  return _translator;
}

/**
 * Translates an array of strings to Italian in a single API call.
 * - Source language is auto-detected by DeepL.
 * - Already-Italian text is returned as-is by DeepL (no double-translation cost).
 * - On any error (network, quota, invalid key) returns the original strings.
 *
 * @param texts Array of strings to translate (pass empty strings to skip slots)
 * @returns Translated strings in the same order
 */
export async function translateToItalian(texts: string[]): Promise<string[]> {
  const translator = getTranslator();

  if (!translator) {
    logger.debug('[Translation] DEEPL_API_KEY not set — skipping translation');
    return texts;
  }

  const nonEmpty = texts.filter(Boolean);
  if (nonEmpty.length === 0) return texts;

  try {
    const results = await translator.translateText(
      texts.map(t => t || ' '), // DeepL rejects empty strings
      null,                      // source language: auto-detect
      'it',
    );
    return results.map((r, i) => (texts[i] ? r.text : ''));
  } catch (err) {
    logger.warn(`[Translation] DeepL call failed, keeping originals: ${err}`);
    return texts;
  }
}

/**
 * Convenience wrapper for translating a single { title, description } pair.
 * Uses one batched API call (2 strings) to minimise character consumption.
 */
export async function translateOpportunity(
  title: string,
  description: string,
): Promise<{ title: string; description: string }> {
  const [t, d] = await translateToItalian([title, description]);
  return { title: t, description: d };
}
