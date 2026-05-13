import axios from 'axios';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

const CHECK_TIMEOUT_MS = 8000;
const RECHECK_INTERVAL_DAYS = 7;
const DELAY_MS = 300;

const BOT_UA = 'Mozilla/5.0 (compatible; PathFinder-Bot/1.0; +https://pathfinder.it)';

async function checkUrl(url: string): Promise<'ACTIVE' | 'BROKEN' | 'SKIP'> {
  try {
    const res = await axios({
      method: 'HEAD',
      url,
      timeout: CHECK_TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': BOT_UA },
    });

    if (res.status >= 200 && res.status < 400) return 'ACTIVE';

    // Some servers reject HEAD — fall back to GET
    if (res.status === 405) {
      const getRes = await axios({
        method: 'GET',
        url,
        timeout: CHECK_TIMEOUT_MS,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': BOT_UA },
      });
      return getRes.status >= 200 && getRes.status < 400 ? 'ACTIVE' : 'BROKEN';
    }

    return 'BROKEN';
  } catch {
    // Network error, DNS failure, timeout — skip this round
    return 'SKIP';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runUrlCheckBatch(limit = 200): Promise<{
  checked: number;
  active: number;
  broken: number;
  skipped: number;
}> {
  const cutoff = new Date(Date.now() - RECHECK_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

  const opps = await prisma.$queryRawUnsafe<{ id: string; url: string }[]>(
    `SELECT id, url FROM "Opportunity"
     WHERE url IS NOT NULL
       AND (
         "urlStatus" IS NULL
         OR "urlStatus" = 'UNCHECKED'
         OR ("urlCheckedAt" IS NOT NULL AND "urlCheckedAt" < $1)
       )
     ORDER BY
       CASE WHEN "urlStatus" IS NULL OR "urlStatus" = 'UNCHECKED' THEN 0 ELSE 1 END,
       "urlCheckedAt" ASC NULLS FIRST
     LIMIT $2`,
    cutoff,
    limit,
  );

  let checked = 0, active = 0, broken = 0, skipped = 0;

  for (const opp of opps) {
    const status = await checkUrl(opp.url);

    if (status !== 'SKIP') {
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { urlStatus: status, urlCheckedAt: new Date() },
      });
    }

    checked++;
    if (status === 'ACTIVE') active++;
    else if (status === 'BROKEN') broken++;
    else skipped++;

    if (checked < opps.length) await sleep(DELAY_MS);
  }

  logger.info('[URLChecker] Batch complete', { checked, active, broken, skipped });
  return { checked, active, broken, skipped };
}
