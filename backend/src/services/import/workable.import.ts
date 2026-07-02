/**
 * Workable ATS — public widget API import.
 *
 * Thin wrapper over the generic ATS connector factory (see ats/ats-connector.ts
 * and ats/adapters/workable.ts). Tokens come from the DB registry + adapter seed.
 */
import { runAtsConnector } from './ats/ats-connector';
import { workableAdapter } from './ats/adapters/workable';

export function importWorkableOpportunities(options?: { boards?: Record<string, string> }) {
  return runAtsConnector(workableAdapter, options);
}
