/**
 * Nightly translation job
 *
 * Finds opportunities missing titleIt or descriptionIt and populates them
 * via OpenAI (gpt-4o-mini). Idempotent: re-running only translates rows
 * still missing the Italian columns. Originals (title/description) are
 * never touched.
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import { translateOpportunityToItalian } from './ai/opportunityParser';
import { logger } from '../utils/logger';

const CONCURRENCY = 5;
const DEFAULT_LIMIT = 500;

export async function runTranslationBatch(limit = DEFAULT_LIMIT): Promise<{ translated: number; failed: number }> {
  if (!process.env.OPENAI_API_KEY) {
    logger.debug('[TranslationJob] OPENAI_API_KEY not set — skipping');
    return { translated: 0, failed: 0 };
  }

  const now = new Date();
  const opps = await prisma.opportunity.findMany({
    where: {
      OR: [{ titleIt: null }, { descriptionIt: null }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    select: { id: true, title: true, description: true },
    take: limit,
    orderBy: { postedAt: 'desc' },
  });

  if (!opps.length) {
    logger.info('[TranslationJob] Nothing to translate');
    return { translated: 0, failed: 0 };
  }

  logger.info(`[TranslationJob] Translating ${opps.length} opportunities (concurrency=${CONCURRENCY})`);

  let translated = 0;
  let failed = 0;

  for (let i = 0; i < opps.length; i += CONCURRENCY) {
    const chunk = opps.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (opp) => {
        const result = await translateOpportunityToItalian(opp.title, opp.description);
        if (!result) {
          failed++;
          return;
        }
        try {
          await prisma.opportunity.update({
            where: { id: opp.id },
            data: { titleIt: result.title, descriptionIt: result.description },
          });
          translated++;
        } catch (err) {
          failed++;
          logger.warn(`[TranslationJob] DB update failed for ${opp.id}: ${err}`);
        }
      }),
    );
  }

  logger.info(`[TranslationJob] Done — translated=${translated} failed=${failed}`);
  return { translated, failed };
}

export function startTranslationScheduler() {
  // Every night at 02:30 server time
  cron.schedule('30 2 * * *', () => {
    runTranslationBatch().catch((err) => logger.error('[TranslationJob] Nightly run failed:', err));
  });
  logger.info('[TranslationJob] Scheduler started (nightly 02:30)');
}
