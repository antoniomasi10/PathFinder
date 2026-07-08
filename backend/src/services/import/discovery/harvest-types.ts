/**
 * Harvest-discovery layer types — twin of discovery/types.ts, for
 * HarvestTarget (organizer opportunity pages) instead of CompanyWatchlist.
 */
import { OpportunityType } from '@prisma/client';

export interface HarvestCandidate {
  name: string;
  domain: string;
  categoryHint?: OpportunityType;
  country?: string;
  region?: string;
  sourceLabel: string;
  /** Provenance label, e.g. "harvest:seed-italy-student-orgs". */
  source: string;
}

export interface HarvestConnector {
  name: string;
  discover(): Promise<HarvestCandidate[]>;
}
