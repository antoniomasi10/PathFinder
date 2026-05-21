/**
 * Nightly structured-content backfill job.
 *
 * Finds opportunities missing `structuredContent` and populates them
 * via OpenAI (gpt-4o-mini). Idempotent: re-running only processes rows
 * still missing the field. Originals (title/description) are never touched.
 */

import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { parseOpportunityContent } from './ai/opportunityParser';
import { logger } from '../utils/logger';

const CONCURRENCY = 5;
const DEFAULT_LIMIT = 500;

export async function runStructuredContentBatch(limit = DEFAULT_LIMIT): Promise<{ processed: number; failed: number }> {
  if (!process.env.OPENAI_API_KEY) {
    logger.debug('[StructuredContentJob] OPENAI_API_KEY not set — skipping');
    return { processed: 0, failed: 0 };
  }

  const now = new Date();
  const opps = await prisma.opportunity.findMany({
    where: {
      structuredContent: { equals: Prisma.JsonNull },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, title: true, description: true, about: true, company: true },
    take: limit,
    orderBy: { postedAt: 'desc' },
  });

  if (!opps.length) {
    logger.info('[StructuredContentJob] Nothing to process');
    return { processed: 0, failed: 0 };
  }

  logger.info(`[StructuredContentJob] Processing ${opps.length} opportunities (concurrency=${CONCURRENCY})`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < opps.length; i += CONCURRENCY) {
    const chunk = opps.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (opp) => {
        const result = await parseOpportunityContent(opp.title, opp.description, opp.about ?? null, opp.company ?? null);
        if (!result) {
          failed++;
          return;
        }
        try {
          await prisma.opportunity.update({
            where: { id: opp.id },
            data: { structuredContent: result as any },
          });
          processed++;
        } catch (err) {
          failed++;
          logger.warn(`[StructuredContentJob] DB update failed for ${opp.id}: ${err}`);
        }
      }),
    );
  }

  logger.info(`[StructuredContentJob] Done — processed=${processed} failed=${failed}`);
  return { processed, failed };
}

export function startStructuredContentScheduler() {
  // Every night at 03:00 server time (30 min after translation job)
  cron.schedule('0 3 * * *', () => {
    runStructuredContentBatch().catch((err) => logger.error('[StructuredContentJob] Nightly run failed:', err));
  });
  logger.info('[StructuredContentJob] Scheduler started (nightly 03:00)');
}
