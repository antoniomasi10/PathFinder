import axios from 'axios';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

const CHECK_TIMEOUT_MS = 8000;
const RECHECK_INTERVAL_DAYS = 7;
const DELAY_MS = 300;

const BOT_UA = 'Mozilla/5.0 (compatible; PathFinder-Bot/1.0; +https://pathfinder.it)';

// Statuses that definitively mean "resource gone" — safe to mark BROKEN even for curated.
const HARD_GONE_STATUSES = new Set([404, 410]);
// Statuses likely caused by anti-bot protection — not a signal the page is gone.
const ANTI_BOT_STATUSES = new Set([403, 429]);
// Consecutive hard-gone hits required before marking BROKEN.
const BROKEN_STREAK_THRESHOLD = 3;

// 'GONE' = 404/410 this round (increment streak, only BROKEN at threshold).
// 'BROKEN' here is no longer returned directly by checkUrl — kept for type clarity.
async function checkUrl(url: string): Promise<'ACTIVE' | 'GONE' | 'SKIP'> {
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
      if (getRes.status >= 200 && getRes.status < 400) return 'ACTIVE';
      if (ANTI_BOT_STATUSES.has(getRes.status)) return 'SKIP';
      if (HARD_GONE_STATUSES.has(getRes.status)) return 'GONE';
      return 'SKIP';
    }

    if (ANTI_BOT_STATUSES.has(res.status)) return 'SKIP';
    if (HARD_GONE_STATUSES.has(res.status)) return 'GONE';
    // Other 4xx/5xx: ambiguous — don't mark broken, retry next cycle
    return 'SKIP';
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

  // Curated rows are excluded: they're manually verified annually by the team,
  // and the urlChecker produces too many false positives on Italian event sites
  // (CDN/anti-bot/seasonal redirects). The seed re-run is the source of truth for these.
  const opps = await prisma.$queryRawUnsafe<{ id: string; url: string; source: string | null; urlBrokenStreak: number }[]>(
    `SELECT id, url, source, "urlBrokenStreak" FROM "Opportunity"
     WHERE url IS NOT NULL
       AND (source IS NULL OR source != 'curated')
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

  let checked = 0, active = 0, broken = 0, gonePending = 0, skipped = 0;

  for (const opp of opps) {
    const status = await checkUrl(opp.url);

    const updateData: any = { urlCheckedAt: new Date() };
    if (status === 'ACTIVE') {
      updateData.urlStatus = 'ACTIVE';
      updateData.urlBrokenStreak = 0;
      active++;
    } else if (status === 'GONE') {
      const newStreak = (opp.urlBrokenStreak ?? 0) + 1;
      updateData.urlBrokenStreak = newStreak;
      if (newStreak >= BROKEN_STREAK_THRESHOLD) {
        updateData.urlStatus = 'BROKEN';
        if (opp.source === 'curated') {
          logger.warn(`[URLChecker] Curated marked BROKEN after ${newStreak} consecutive hard-gone checks: ${opp.id} ${opp.url}`);
        }
        broken++;
      } else {
        gonePending++;
      }
    } else {
      // 'SKIP': leave urlStatus and urlBrokenStreak as-is, only update urlCheckedAt.
      skipped++;
    }

    await prisma.opportunity.update({ where: { id: opp.id }, data: updateData });

    checked++;
    if (checked < opps.length) await sleep(DELAY_MS);
  }

  logger.info('[URLChecker] Batch complete', { checked, active, broken, gonePending, skipped });
  return { checked, active, broken, skipped };
}
