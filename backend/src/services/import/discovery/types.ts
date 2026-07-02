/**
 * Discovery layer types.
 *
 * A DiscoveryConnector emits candidate companies (optionally already resolved to
 * an ATS board). The orchestrator validates ATS candidates and registers them
 * in the CompanyWatchlist registry so the ATS factory imports them automatically.
 *
 * Fase 1 ships ATS-index connectors (candidates carry atsType+atsToken). Fase 2
 * adds registry/search connectors whose candidates have only a domain and go
 * through resolve → fingerprint → compliance before becoming tier B/C rows.
 */
export interface CompanyCandidate {
  name: string;
  atsType?: string;   // set when the connector already knows the ATS (tier A)
  atsToken?: string;
  domain?: string;    // apex domain — triggers resolve → fingerprint → route
  country?: string;   // ISO-3166 alpha-2
  sector?: string;    // optional hint carried into the registry
  /** Provenance label, e.g. "ats-index:seed-italy". */
  source: string;
}

export interface DiscoveryConnector {
  name: string;
  discover(): Promise<CompanyCandidate[]>;
}
