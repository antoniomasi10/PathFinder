/**
 * Workable ATS adapter — public widget API (metadata only, no description).
 * API: GET https://apply.workable.com/api/v1/widget/accounts/{token}
 */
import { AtsAdapter, AtsJob } from '../types';

const API_BASE = 'https://apply.workable.com/api/v1/widget/accounts';

interface WorkableJob {
  title: string;
  shortcode: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  url?: string;
  application_url?: string;
  published_on?: string;
  country?: string;
  city?: string;
  state?: string;
  industry?: string;
  locations?: { country: string; countryCode: string; city: string; region: string; hidden: boolean }[];
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  italy: 'IT', 'united states': 'US', 'united kingdom': 'GB', germany: 'DE',
  france: 'FR', netherlands: 'NL', spain: 'ES', canada: 'CA', sweden: 'SE',
};

function workableCountryCode(job: WorkableJob): string | undefined {
  if (job.locations?.[0]?.countryCode) return job.locations[0].countryCode;
  return COUNTRY_NAME_TO_CODE[(job.country || '').toLowerCase()];
}

export const WORKABLE_SEED_BOARDS: Record<string, string> = {
  'interactive-investor': 'Interactive Investor',
  'caxton': 'Caxton Associates',
  'coldquanta': 'Infleqtion',
  'f-dot-h-paschen-1': 'F.H. Paschen',
  'treatwell': 'Treatwell',
  'neon-rated': 'NEON Rated',
  'thorlabs': 'Thorlabs',
  'campusink': 'Campus Ink',
  'degy': 'Degy Booking International',
  'al-warren-oil-company-inc': 'Al Warren Oil Company',
  'upstream': 'Upstream',
  'garmin-cluj': 'Garmin',
};

export const workableAdapter: AtsAdapter = {
  platform: 'workable',
  sourceLabel: 'Workable',
  timeoutMs: 15000,
  seedBoards: WORKABLE_SEED_BOARDS,
  buildUrl: (token) => `${API_BASE}/${token}`,
  parseJobs(raw, ctx) {
    const jobs = (raw as { jobs?: WorkableJob[] }).jobs || [];
    return jobs.map<AtsJob>((job) => {
      const location = [job.city, job.state, job.country].filter(Boolean).join(', ');
      const descParts = [`${job.title} at ${ctx.companyName}`];
      if (job.department) descParts.push(`Department: ${job.department}`);
      if (location) descParts.push(`Location: ${location}`);
      if (job.employment_type) descParts.push(`Type: ${job.employment_type}`);
      if (job.industry) descParts.push(`Industry: ${job.industry}`);
      if (job.url) descParts.push(`Apply: ${job.url}`);
      return {
        externalId: job.shortcode,
        title: job.title,
        url: job.url || job.application_url || null,
        location,
        countryCode: workableCountryCode(job),
        isRemote: job.telecommuting || false,
        description: descParts.join('\n'),
        tags: [job.department, job.employment_type, job.industry].filter(Boolean) as string[],
        postedAt: job.published_on ? new Date(job.published_on) : null,
      };
    });
  },
};
