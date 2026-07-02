/**
 * Greenhouse ATS adapter — public Job Board API.
 * API: GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 */
import { stripHtml } from '../../utils';
import { AtsAdapter, AtsJob } from '../types';

const API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

interface GHJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location: { name: string };
  content?: string;
  departments: { name: string }[];
  offices: { name: string }[];
}

/** Curated seed boards (token → display name). Migrated into CompanyWatchlist. */
export const GREENHOUSE_SEED_BOARDS: Record<string, string> = {
  'cloudflare': 'Cloudflare',
  'databricks': 'Databricks',
  'stripe': 'Stripe',
  'airbnb': 'Airbnb',
  'doordashusa': 'DoorDash',
  'anthropic': 'Anthropic',
  'scaleai': 'Scale AI',
  'coinbase': 'Coinbase',
  'asana': 'Asana',
  'okta': 'Okta',
  'datadog': 'Datadog',
  'imc': 'IMC Trading',
  'pinterest': 'Pinterest',
  'figma': 'Figma',
  'duolingo': 'Duolingo',
  'robinhood': 'Robinhood',
  'dropbox': 'Dropbox',
  'waymo': 'Waymo',
  'nuro': 'Nuro',
  'lyft': 'Lyft',
  'brex': 'Brex',
  'reddit': 'Reddit',
  'cockroachlabs': 'Cockroach Labs',
  'instacart': 'Instacart',
  'twitch': 'Twitch',
  'discord': 'Discord',
  'epicgames': 'Epic Games',
  'riotgames': 'Riot Games',
  'roblox': 'Roblox',
  'unity3d': 'Unity',
  'twilio': 'Twilio',
  'zscaler': 'Zscaler',
  'toast': 'Toast',
  'udemy': 'Udemy',
  'verkada': 'Verkada',
  'coupang': 'Coupang',
  'squarespace': 'Squarespace',
  'intercom': 'Intercom',
  'gitlab': 'GitLab',
  'airtable': 'Airtable',
  'janestreet': 'Jane Street',
  'flowtraders': 'Flow Traders',
  'elastic': 'Elastic',
  'wolt': 'Wolt',
  'adyen': 'Adyen',
  'celonis': 'Celonis',
  'hellofresh': 'HelloFresh',
  'getyourguide': 'GetYourGuide',
  'doctolib': 'Doctolib',
  'contentful': 'Contentful',
  'trivago': 'Trivago',
  'monzo': 'Monzo',
  'sumup': 'SumUp',
  'n26': 'N26',
  'toogoodtogo': 'Too Good To Go',
  'realtimeboardglobal': 'Miro',
  'parloa': 'Parloa',
  'gropyus': 'GROPYUS',
  'remotecom': 'Remote',
  'clara': 'Clara',
};

export const greenhouseAdapter: AtsAdapter = {
  platform: 'greenhouse',
  sourceLabel: 'Greenhouse',
  timeoutMs: 15000,
  seedBoards: GREENHOUSE_SEED_BOARDS,
  buildUrl: (token) => `${API_BASE}/${token}/jobs?content=true`,
  parseJobs(raw) {
    const jobs = (raw as { jobs?: GHJob[] }).jobs || [];
    return jobs.map<AtsJob>((job) => ({
      externalId: String(job.id),
      title: job.title,
      url: job.absolute_url,
      location: job.location?.name || '',
      description: stripHtml(job.content || ''),
      tags: [...(job.departments || []).map(d => d.name), ...(job.offices || []).map(o => o.name)],
      postedAt: job.updated_at ? new Date(job.updated_at) : null,
    }));
  },
};
