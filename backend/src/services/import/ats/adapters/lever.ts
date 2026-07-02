/**
 * Lever ATS adapter — public Postings API.
 * API: GET https://api.lever.co/v0/postings/{token}?limit=500
 */
import { stripHtml } from '../../utils';
import { AtsAdapter, AtsJob } from '../types';

const API_BASE = 'https://api.lever.co/v0/postings';

interface LeverPosting {
  id: string;
  text: string;
  descriptionPlain?: string;
  description?: string;
  categories: { commitment?: string; department?: string; location?: string; team?: string };
  lists?: { text: string; content: string }[];
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  country?: string;
}

export const LEVER_SEED_BOARDS: Record<string, string> = {
  'spotify': 'Spotify',
  'anchorage': 'Anchorage Digital',
  'dnb': 'Dun & Bradstreet',
  'shieldai': 'Shield AI',
  'weride': 'WeRide',
  'BestEgg': 'Best Egg',
  'rigetti': 'Rigetti Computing',
  'voleon': 'The Voleon Group',
  'theathletic': 'The Athletic',
  'aisafety': 'Center for AI Safety',
  'fehrandpeers': 'Fehr & Peers',
  'quincyinst': 'Quincy Institute',
  'solopulseco': 'SoloPulse',
  'palantir': 'Palantir',
  'bumbleinc': 'Bumble',
  'plaid': 'Plaid',
  'kraken': 'Kraken',
  'blablacar': 'BlaBlaCar',
};

export const leverAdapter: AtsAdapter = {
  platform: 'lever',
  sourceLabel: 'Lever',
  timeoutMs: 30000,
  seedBoards: LEVER_SEED_BOARDS,
  buildUrl: (token) => `${API_BASE}/${token}?limit=500`,
  parseJobs(raw) {
    if (!Array.isArray(raw)) return [];
    return (raw as LeverPosting[]).map<AtsJob>((job) => {
      const descParts = [stripHtml(job.descriptionPlain || job.description || '')];
      for (const list of job.lists || []) {
        descParts.push(`\n${list.text}:\n${stripHtml(list.content)}`);
      }
      return {
        externalId: job.id.slice(0, 20),
        title: job.text,
        url: job.hostedUrl || job.applyUrl || null,
        location: job.categories?.location || '',
        countryCode: job.country,
        isRemote: job.workplaceType === 'remote',
        description: descParts.join('\n').slice(0, 10000),
        tags: [job.categories?.department, job.categories?.team, job.categories?.commitment].filter(Boolean) as string[],
        postedAt: job.createdAt ? new Date(job.createdAt) : null,
      };
    });
  },
};
