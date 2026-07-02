/**
 * ATS-index discovery connector (Fase 1).
 *
 * Emits Italian-company ATS board candidates from the curated seed list. Each
 * candidate already carries atsType+atsToken, so the orchestrator only has to
 * validate the board exists before registering it as a tier-A source.
 */
import { CompanyCandidate, DiscoveryConnector } from '../types';
import { ITALY_ATS_SEED } from '../seeds/italy-ats-seed';

export const atsSeedConnector: DiscoveryConnector = {
  name: 'ats-index:seed-italy',
  async discover(): Promise<CompanyCandidate[]> {
    return ITALY_ATS_SEED.map(e => ({
      name: e.name,
      atsType: e.platform,
      atsToken: e.token,
      country: 'IT',
      source: 'ats-index:seed-italy',
    }));
  },
};
