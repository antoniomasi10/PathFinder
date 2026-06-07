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
import { parseOpportunityContent, extractContextualizedSkills } from './ai/opportunityParser';
import { logger } from '../utils/logger';

const CONCURRENCY = 5;
const DEFAULT_LIMIT = 500;
const CONTEXTUALIZED_SKILLS_NIGHTLY_LIMIT = 500;

export async function runStructuredContentBatch(limit = DEFAULT_LIMIT): Promise<{ processed: number; failed: number }> {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('[StructuredContentJob] OPENAI_API_KEY not set — skipping');
    return { processed: 0, failed: 0 };
  }

  const now = new Date();
  const opps = await prisma.opportunity.findMany({
    where: {
      structuredContent: { equals: Prisma.DbNull },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, title: true, description: true, about: true, company: true },
    take: limit,
    orderBy: { postedAt: 'desc' },
  });

  let processed = 0;
  let failed = 0;

  if (opps.length > 0) {
    logger.info(`[StructuredContentJob] Processing ${opps.length} structuredContent opportunities (concurrency=${CONCURRENCY})`);

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
    logger.info(`[StructuredContentJob] structuredContent done — processed=${processed} failed=${failed}`);
  } else {
    logger.info('[StructuredContentJob] No structuredContent to process');
  }

  // Backfill contextualizedSkills for TIROCINIO opportunities missing them
  const tirocinioOpps = await prisma.opportunity.findMany({
    where: {
      type: 'TIROCINIO',
      contextualizedSkills: { isEmpty: true },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, title: true, description: true, about: true, extractedSkills: true },
    take: CONTEXTUALIZED_SKILLS_NIGHTLY_LIMIT,
    orderBy: { postedAt: 'desc' },
  });

  let csProcessed = 0;
  let csFailed = 0;

  if (tirocinioOpps.length > 0) {
    logger.info(`[StructuredContentJob] Processing ${tirocinioOpps.length} contextualizedSkills opportunities`);

    for (let i = 0; i < tirocinioOpps.length; i += CONCURRENCY) {
      const chunk = tirocinioOpps.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (opp) => {
          const skills = (opp.extractedSkills as string[]) ?? [];
          const result = await extractContextualizedSkills(opp.title, opp.description, skills, opp.about ?? null).catch(() => null);
          if (!result || result.length === 0) {
            csFailed++;
            return;
          }
          try {
            await prisma.opportunity.update({
              where: { id: opp.id },
              data: { contextualizedSkills: result },
            });
            csProcessed++;
          } catch (err) {
            csFailed++;
            logger.warn(`[StructuredContentJob] contextualizedSkills DB update failed for ${opp.id}: ${err}`);
          }
        }),
      );
    }
    logger.info(`[StructuredContentJob] contextualizedSkills done — processed=${csProcessed} failed=${csFailed}`);
  } else {
    logger.info('[StructuredContentJob] No contextualizedSkills to process');
  }

  return { processed: processed + csProcessed, failed: failed + csFailed };
}

export function startStructuredContentScheduler() {
  // Every night at 03:00 server time (30 min after translation job)
  cron.schedule('0 3 * * *', () => {
    runStructuredContentBatch().catch((err) => logger.error('[StructuredContentJob] Nightly run failed:', err));
  });
  logger.info('[StructuredContentJob] Scheduler started (nightly 03:00)');
}
