/**
 * Registry of all factory-driven ATS adapters. Add a new ATS here and it is
 * automatically covered by discovery, the scheduler cron, and the admin routes.
 */
import { AtsAdapter } from '../types';
import { greenhouseAdapter } from './greenhouse';
import { leverAdapter } from './lever';
import { ashbyAdapter } from './ashby';
import { workableAdapter } from './workable';
import { recruiteeAdapter } from './recruitee';

export const ATS_ADAPTERS: AtsAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workableAdapter,
  recruiteeAdapter,
];

export const ATS_ADAPTER_BY_PLATFORM: Record<string, AtsAdapter> =
  Object.fromEntries(ATS_ADAPTERS.map(a => [a.platform, a]));

export { greenhouseAdapter, leverAdapter, ashbyAdapter, workableAdapter, recruiteeAdapter };
