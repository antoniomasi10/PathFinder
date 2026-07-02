/**
 * Ashby ATS — public Job Board API import.
 *
 * Thin wrapper over the generic ATS connector factory (see ats/ats-connector.ts
 * and ats/adapters/ashby.ts). Tokens come from the DB registry + adapter seed.
 */
import { runAtsConnector } from './ats/ats-connector';
import { ashbyAdapter } from './ats/adapters/ashby';

export function importAshbyOpportunities(options?: { boards?: Record<string, string> }) {
  return runAtsConnector(ashbyAdapter, options);
}
