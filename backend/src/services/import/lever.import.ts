/**
 * Lever ATS — public Postings API import.
 *
 * Thin wrapper over the generic ATS connector factory (see ats/ats-connector.ts
 * and ats/adapters/lever.ts). Tokens come from the DB registry + adapter seed.
 */
import { runAtsConnector } from './ats/ats-connector';
import { leverAdapter } from './ats/adapters/lever';

export function importLeverOpportunities(options?: { boards?: Record<string, string> }) {
  return runAtsConnector(leverAdapter, options);
}
