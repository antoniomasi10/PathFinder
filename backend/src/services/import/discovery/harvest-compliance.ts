/**
 * Compliance check for HarvestTarget — thin wrapper around the generalized
 * `checkCompliance` gate (compliance/gate.ts), which already fronts
 * CompanyWatchlist via `processCompanyCompliance`. Same shape, adapted to
 * HarvestTarget's own compliance columns.
 */
import { HarvestTarget } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { logger } from '../../../utils/logger';
import { checkCompliance } from '../compliance/gate';

/**
 * Checks and updates compliance state (robots.txt + ToS) for a harvest target.
 * Returns true if the target is allowed to be scraped. Re-checks every 30 days
 * (via checkCompliance's own interval); uses cached values otherwise.
 */
export async function processTargetCompliance(target: HarvestTarget, now: Date): Promise<boolean> {
  const cachedAt = target.robotsCheckedAt && target.tosAnalyzedAt
    ? new Date(Math.min(target.robotsCheckedAt.getTime(), target.tosAnalyzedAt.getTime()))
    : null;

  const result = await checkCompliance(target.url, {
    robotsAllowed: target.robotsAllowed,
    tosAllowed: target.tosAllowed,
    complianceCheckedAt: cachedAt,
  }, now);

  if (result.checked) {
    const updates: Partial<HarvestTarget> = {
      robotsAllowed: result.robotsAllowed,
      robotsCheckedAt: now,
      tosAllowed: result.tosAllowed,
      tosAnalyzedAt: now,
      tosNotes: result.tosNotes ?? null,
      tosPageNotFound: result.tosPageNotFound ?? false,
    };
    await prisma.harvestTarget.update({
      where: { id: target.id },
      data: updates as any,
    });
    Object.assign(target, updates);

    if (result.robotsAllowed === false) {
      logger.info(`[HarvestTarget] ${target.name}: robots.txt disallows scraping`);
    }
    if (result.tosAllowed === false) {
      logger.info(`[HarvestTarget] ${target.name}: ToS prohibits scraping — ${result.tosNotes}`);
    } else if (result.tosAllowed === null) {
      logger.info(`[HarvestTarget] ${target.name}: ToS status unknown — ${result.tosNotes}`);
    }
  }

  return result.allowed;
}
