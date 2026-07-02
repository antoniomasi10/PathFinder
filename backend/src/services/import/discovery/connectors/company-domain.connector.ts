/**
 * Company-domain discovery connector (Fase 1 primary engine).
 *
 * Emits company candidates identified only by apex domain. The orchestrator
 * resolves each company's own careers page and fingerprints the ATS to decide
 * the harvest path — so the ATS is used as a *signal*, never scraped when
 * prohibited.
 */
import { CompanyCandidate, DiscoveryConnector } from '../types';
import { ITALY_COMPANY_DOMAINS } from '../seeds/italy-company-domains';

export const companyDomainConnector: DiscoveryConnector = {
  name: 'domain:seed-italy',
  async discover(): Promise<CompanyCandidate[]> {
    return ITALY_COMPANY_DOMAINS.map(c => ({
      name: c.name,
      domain: c.domain,
      country: 'IT',
      source: 'domain:seed-italy',
      sector: c.sector,
    }));
  },
};
