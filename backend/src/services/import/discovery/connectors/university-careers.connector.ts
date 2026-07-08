/**
 * University career-service discovery connector (Fase 1, Step 1.3 — PF-118).
 *
 * Gemello of companyDomainConnector: emits Italian university apex domains as
 * candidates. The orchestrator resolves each university's careers/placement
 * page and fingerprints it same as any company domain — universities rarely
 * run a commercial ATS, so most will route to a tier B/C custom scrape target.
 *
 * In Fase 3 these become `HarvestTarget` rows with feed-detection (JSON-LD/ICS/
 * RSS from career-service event calendars); for now they enter the existing
 * CompanyWatchlist flow like any other custom domain (design spec §Fase 1.3).
 */
import { CompanyCandidate, DiscoveryConnector } from '../types';
import { ITALY_UNIVERSITY_DOMAINS } from '../seeds/italy-university-careers';

export const universityCareersConnector: DiscoveryConnector = {
  name: 'domain:seed-university-it',
  async discover(): Promise<CompanyCandidate[]> {
    return ITALY_UNIVERSITY_DOMAINS.map(u => ({
      name: u.name,
      domain: u.domain,
      country: 'IT',
      source: 'domain:seed-university-it',
      sector: 'university-careers',
    }));
  },
};
