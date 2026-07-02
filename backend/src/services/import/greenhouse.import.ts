/**
 * Greenhouse ATS — public Job Board API import.
 *
 * Thin wrapper over the generic ATS connector factory. Board tokens are read
 * from the DB registry (CompanyWatchlist) merged with the adapter seed, so
 * discovery-found Greenhouse companies are imported with no code change.
 * See ats/ats-connector.ts and ats/adapters/greenhouse.ts.
 */
import { runAtsConnector } from './ats/ats-connector';
import { greenhouseAdapter } from './ats/adapters/greenhouse';

export function importGreenhouseOpportunities(options?: { boards?: Record<string, string> }) {
  return runAtsConnector(greenhouseAdapter, options);
}
