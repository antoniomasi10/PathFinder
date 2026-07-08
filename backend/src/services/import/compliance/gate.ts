/**
 * Generalized compliance gate (robots.txt + ToS), source-agnostic.
 *
 * Extracted from CompanyWatchlist's per-company compliance check so the same
 * gate can front any harvest source — CompanyWatchlist today via
 * `processCompanyCompliance` (see company-watchlist.import.ts), and the
 * upcoming `HarvestTarget` model (Fase 3) directly.
 *
 * Cache is a single `complianceCheckedAt` timestamp: when stale (or absent),
 * both robots.txt and ToS are (re-)checked together; otherwise the cached
 * verdict is returned as-is.
 */
import { checkRobotsTxt, findAndAnalyzeTos, daysSince } from '../compliance';

export const COMPLIANCE_CHECK_INTERVAL_DAYS = 30;

export interface ComplianceCache {
  robotsAllowed: boolean | null;
  tosAllowed: boolean | null;
  complianceCheckedAt: Date | null;
}

export interface ComplianceResult {
  allowed: boolean;
  robotsAllowed: boolean | null;
  tosAllowed: boolean | null;
  tosNotes?: string;
  tosPageNotFound?: boolean;
  /** True if this call performed a live check (cache was stale/absent). */
  checked: boolean;
}

export async function checkCompliance(
  url: string,
  cache: ComplianceCache,
  now: Date = new Date(),
): Promise<ComplianceResult> {
  const expired = !cache.complianceCheckedAt ||
    daysSince(cache.complianceCheckedAt, now) > COMPLIANCE_CHECK_INTERVAL_DAYS;

  if (!expired) {
    return {
      allowed: cache.robotsAllowed !== false && cache.tosAllowed !== false,
      robotsAllowed: cache.robotsAllowed,
      tosAllowed: cache.tosAllowed,
      checked: false,
    };
  }

  const [robotsAllowed, tos] = await Promise.all([
    checkRobotsTxt(url),
    findAndAnalyzeTos(url),
  ]);

  return {
    allowed: robotsAllowed !== false && tos.allowed !== false,
    robotsAllowed,
    tosAllowed: tos.allowed,
    tosNotes: tos.notes,
    tosPageNotFound: tos.pageNotFound,
    checked: true,
  };
}
