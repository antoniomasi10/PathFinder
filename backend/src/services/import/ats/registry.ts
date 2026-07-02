/**
 * DB-backed ATS board registry.
 *
 * ATS boards live in `CompanyWatchlist` rows tagged with `atsType` + `atsToken`
 * (scrapeTier = "A"). This is the seam that makes the expansion data-driven:
 * discovering an ATS company = inserting a row here, after which the ATS factory
 * picks it up automatically on the next run — no code change per company.
 */
import prisma from '../../../lib/prisma';

/**
 * Canonical public board URL for a given ATS platform + token. Used as the
 * unique `careersUrl` key when registering ATS boards in CompanyWatchlist.
 */
export function buildBoardUrl(platform: string, token: string): string {
  switch (platform) {
    case 'greenhouse': return `https://boards.greenhouse.io/${token}`;
    case 'lever': return `https://jobs.lever.co/${token}`;
    case 'ashby': return `https://jobs.ashbyhq.com/${token}`;
    case 'workable': return `https://apply.workable.com/${token}`;
    case 'recruitee': return `https://${token}.recruitee.com`;
    case 'personio': return `https://${token}.jobs.personio.com`;
    case 'smartrecruiters': return `https://jobs.smartrecruiters.com/${token}`;
    default: return `https://${token}`;
  }
}

/** Returns { atsToken → companyName } for every active board of a platform. */
export async function getRegistryBoards(platform: string): Promise<Record<string, string>> {
  const rows = await prisma.companyWatchlist.findMany({
    where: { atsType: platform, isActive: true, atsToken: { not: null } },
    select: { atsToken: true, name: true },
  });
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.atsToken) out[r.atsToken] = r.name;
  }
  return out;
}

export interface RegisterBoardInput {
  platform: string;
  token: string;
  name: string;
  discoverySource: string;
  sector?: string;
  tier?: string;
  domain?: string | null;
  country?: string | null;
}

/**
 * Idempotently register (or refresh) an ATS board in CompanyWatchlist as a
 * tier-A source. Keyed on the canonical board URL so re-running is a no-op.
 * Returns whether a new row was created. Shared by the seed migration and by
 * discovery connectors.
 */
export async function registerAtsBoard(input: RegisterBoardInput): Promise<{ created: boolean }> {
  const careersUrl = buildBoardUrl(input.platform, input.token);
  const existing = await prisma.companyWatchlist.findUnique({ where: { careersUrl }, select: { id: true } });
  const data = {
    name: input.name,
    sector: input.sector ?? 'unknown',
    tier: input.tier ?? 'large',
    atsType: input.platform,
    atsToken: input.token,
    scrapeTier: 'A',
    discoverySource: input.discoverySource,
    domain: input.domain ?? null,
    country: input.country ?? undefined,
  };
  if (existing) {
    await prisma.companyWatchlist.update({ where: { careersUrl }, data });
    return { created: false };
  }
  await prisma.companyWatchlist.create({ data: { careersUrl, ...data } });
  return { created: true };
}

export interface RegisterTargetInput {
  name: string;
  careersUrl: string;          // the company's own careers page (unique key)
  discoverySource: string;
  atsType?: string | null;     // 'custom-static' | 'custom-js' | prohibited platform | null
  scrapeTier?: string | null;  // 'B' | 'C' for harvestable custom pages; null for no-harvest
  domain?: string | null;
  country?: string | null;
  blocked?: boolean;           // true → prohibited ATS, register as known but no-harvest
  sector?: string;
  tier?: string;
}

/**
 * Idempotently register a non-ATS-API scrape target (custom career page) or a
 * prohibited-ATS company (blocked = no-harvest). Keyed on the careers URL.
 * Custom pages get scrapeTier B/C so the queue picks them up; blocked companies
 * get scrapeTier null + atsType set so BOTH scrapers naturally skip them.
 */
export async function registerScrapeTarget(input: RegisterTargetInput): Promise<{ created: boolean }> {
  const existing = await prisma.companyWatchlist.findUnique({
    where: { careersUrl: input.careersUrl }, select: { id: true },
  });
  const data = {
    name: input.name,
    sector: input.sector ?? 'unknown',
    tier: input.tier ?? 'large',
    atsType: input.atsType ?? null,
    atsToken: null,
    scrapeTier: input.blocked ? null : (input.scrapeTier ?? null),
    discoverySource: input.discoverySource,
    domain: input.domain ?? null,
    country: input.country ?? undefined,
    ...(input.blocked ? { lastScrapeStatus: 'no-harvest' } : {}),
  };
  if (existing) {
    await prisma.companyWatchlist.update({ where: { careersUrl: input.careersUrl }, data });
    return { created: false };
  }
  await prisma.companyWatchlist.create({ data: { careersUrl: input.careersUrl, ...data } });
  return { created: true };
}
