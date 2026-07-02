/**
 * Seed list of Italian company apex domains. This is the primary Fase 1 input for
 * the fingerprint-based discovery: for each domain we resolve the careers page,
 * fingerprint the ATS, and route (permitted ATS → tier A, prohibited → no-harvest,
 * custom → tier B/C). Deliberately a mix of large enterprises (often on Workday/
 * SuccessFactors) and scaleups (often on Greenhouse/Lever) to exercise every path.
 *
 * Expandable: this is a starter set. In Fase 2 it is grown from company registries
 * (Registro Imprese / OpenCorporates / ISTAT) and search discovery.
 */
export interface CompanyDomainSeed {
  domain: string;
  name: string;
  sector?: string;
}

export const ITALY_COMPANY_DOMAINS: CompanyDomainSeed[] = [
  // Large enterprises (frequently Workday / SuccessFactors → no-harvest expected)
  { domain: 'eni.com', name: 'Eni', sector: 'energy' },
  { domain: 'enel.com', name: 'Enel', sector: 'energy' },
  { domain: 'leonardo.com', name: 'Leonardo', sector: 'aerospace' },
  { domain: 'generali.com', name: 'Generali', sector: 'insurance' },
  { domain: 'pirelli.com', name: 'Pirelli', sector: 'automotive' },
  { domain: 'barilla.com', name: 'Barilla', sector: 'food' },
  { domain: 'lavazza.com', name: 'Lavazza', sector: 'food' },
  { domain: 'brembo.com', name: 'Brembo', sector: 'automotive' },
  { domain: 'moncler.com', name: 'Moncler', sector: 'fashion' },
  { domain: 'campari.com', name: 'Campari Group', sector: 'beverage' },
  { domain: 'ferrero.com', name: 'Ferrero', sector: 'food' },
  { domain: 'poste.it', name: 'Poste Italiane', sector: 'logistics' },
  // Scaleups / tech (frequently Greenhouse / Lever / Ashby → tier A expected)
  { domain: 'bendingspoons.com', name: 'Bending Spoons', sector: 'tech' },
  { domain: 'satispay.com', name: 'Satispay', sector: 'fintech' },
  { domain: 'scalapay.com', name: 'Scalapay', sector: 'fintech' },
  { domain: 'docebo.com', name: 'Docebo', sector: 'tech' },
  { domain: 'nexi.it', name: 'Nexi', sector: 'fintech' },
  { domain: 'musixmatch.com', name: 'Musixmatch', sector: 'tech' },
  { domain: 'cortilia.it', name: 'Cortilia', sector: 'ecommerce' },
  { domain: 'prima.it', name: 'Prima Assicurazioni', sector: 'insurance' },
];
