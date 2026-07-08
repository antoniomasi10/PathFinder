/**
 * Student-orgs harvest-discovery connector (Fase 3 first connector).
 *
 * Emits harvest candidates for Italian ESN local sections, identified only by
 * apex domain. The orchestrator resolves each section's events page and
 * fingerprints the feed kind — same pattern as company-domain.connector.ts.
 */
import { HarvestCandidate, HarvestConnector } from '../harvest-types';
import { ITALY_STUDENT_ORGS } from '../seeds/italy-student-orgs';

export const studentOrgsConnector: HarvestConnector = {
  name: 'harvest:seed-italy-student-orgs',
  async discover(): Promise<HarvestCandidate[]> {
    return ITALY_STUDENT_ORGS.map(o => ({
      name: o.name,
      domain: o.domain,
      categoryHint: 'EVENT',
      country: 'IT',
      region: o.region,
      sourceLabel: 'esn-locale',
      source: 'harvest:seed-italy-student-orgs',
    }));
  },
};
