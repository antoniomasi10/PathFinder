/**
 * Ashby ATS adapter — public Job Board API.
 * API: GET https://api.ashbyhq.com/posting-api/job-board/{token}
 */
import { stripHtml } from '../../utils';
import { AtsAdapter, AtsJob } from '../types';

const API_BASE = 'https://api.ashbyhq.com/posting-api/job-board';

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  publishedAt?: string;
}

export const ASHBY_SEED_BOARDS: Record<string, string> = {
  'openai': 'OpenAI',
  'perplexity': 'Perplexity',
  'cohere': 'Cohere',
  'replit': 'Replit',
  'snowflake': 'Snowflake',
  'ramp': 'Ramp',
  'vanta': 'Vanta',
  'notion': 'Notion',
  'backmarket': 'Back Market',
  'alan': 'Alan',
  'mollie': 'Mollie',
  'linear': 'Linear',
  'supabase': 'Supabase',
  'cursor': 'Cursor',
  'posthog': 'PostHog',
  'vercel': 'Vercel',
  'retool': 'Retool',
  'deel': 'Deel',
  'n8n': 'n8n',
  'elevenlabs': 'ElevenLabs',
};

export const ashbyAdapter: AtsAdapter = {
  platform: 'ashby',
  sourceLabel: 'Ashby',
  timeoutMs: 15000,
  seedBoards: ASHBY_SEED_BOARDS,
  buildUrl: (token) => `${API_BASE}/${token}`,
  parseJobs(raw) {
    const jobs = (raw as { jobs?: AshbyJob[] }).jobs || [];
    return jobs.map<AtsJob>((job) => ({
      externalId: job.id.slice(0, 20),
      title: job.title,
      url: job.jobUrl || job.applyUrl || null,
      location: job.location || '',
      isRemote: job.isRemote || job.workplaceType === 'Remote',
      description: stripHtml(job.descriptionPlain || job.descriptionHtml || '').slice(0, 10000),
      tags: [job.department, job.team, job.employmentType].filter(Boolean) as string[],
      postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
    }));
  },
};
