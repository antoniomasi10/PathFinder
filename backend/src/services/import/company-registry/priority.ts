import { RegistryEntity } from './types';

/** Sectors with above-average odds of having ATS-hosted job boards. */
const HIGH_YIELD_SECTORS = new Set([
  'ict', 'tech', 'technology', 'software', 'consulting', 'engineering', 'finance', 'fintech', 'pharma', 'pharmaceutical',
]);

const SOURCE_WEIGHT: Record<string, number> = {
  'registro-imprese-startup': 10, // curated, verified-active companies
  'wikidata': 5,
};

/**
 * Score a candidate for discovery-queue ordering (higher = processed sooner).
 * A resolved domain matters most (nothing else is actionable without one); a
 * pre-known ATS token (Common Crawl fast path) is scored highest since it skips
 * careers-page resolution entirely.
 */
export function computePriorityScore(source: string, e: RegistryEntity & { domain?: string | null }): number {
  let score = SOURCE_WEIGHT[source] ?? 0;
  if (e.atsType && e.atsToken) score += 100;
  if (e.domain) score += 40;

  switch (e.employeeBand) {
    case '250+': score += 25; break;
    case '50-249': score += 15; break;
    case '10-49': score += 5; break;
  }

  if (e.sector && HIGH_YIELD_SECTORS.has(e.sector.toLowerCase())) score += 10;

  return score;
}
