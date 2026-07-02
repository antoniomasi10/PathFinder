/**
 * Recruitee ATS adapter — public offers API (NEW: added via the factory, no
 * bespoke import file needed). Common among European SMEs.
 * API: GET https://{token}.recruitee.com/api/offers/
 */
import { stripHtml } from '../../utils';
import { AtsAdapter, AtsJob } from '../types';

interface RecruiteeOffer {
  id: number;
  title: string;
  careers_url?: string;
  careers_apply_url?: string;
  location?: string;
  city?: string;
  country_code?: string;
  remote?: boolean;
  department?: string;
  employment_type_code?: string;
  category_code?: string;
  description?: string;
  published_at?: string;
}

/** Seed left intentionally empty — Recruitee boards are populated by discovery. */
export const RECRUITEE_SEED_BOARDS: Record<string, string> = {};

export const recruiteeAdapter: AtsAdapter = {
  platform: 'recruitee',
  sourceLabel: 'Recruitee',
  timeoutMs: 15000,
  seedBoards: RECRUITEE_SEED_BOARDS,
  buildUrl: (token) => `https://${token}.recruitee.com/api/offers/`,
  parseJobs(raw) {
    const offers = (raw as { offers?: RecruiteeOffer[] }).offers || [];
    return offers.map<AtsJob>((o) => ({
      externalId: String(o.id),
      title: o.title,
      url: o.careers_url || o.careers_apply_url || null,
      location: o.location || [o.city, o.country_code].filter(Boolean).join(', '),
      countryCode: o.country_code ? o.country_code.toUpperCase() : undefined,
      isRemote: o.remote,
      description: stripHtml(o.description || '').slice(0, 10000),
      tags: [o.department, o.employment_type_code, o.category_code].filter(Boolean) as string[],
      postedAt: o.published_at ? new Date(o.published_at) : null,
    }));
  },
};
