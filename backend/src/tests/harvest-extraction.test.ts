import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('../services/import/company-watchlist.import', () => ({
  getClient: vi.fn(() => ({ chat: { completions: { create: mockCreate } } })),
  htmlLinksToText: (html: string) => html.replace(/<[^>]+>/g, ''),
}));

import {
  extractOpportunitiesFromPage,
  buildHarvestRecords,
  RawExtractedOpportunity,
} from '../services/import/discovery/extraction';
import { getClient } from '../services/import/company-watchlist.import';
import { resetDedupCache } from '../services/import/validation';

const mockedGetClient = vi.mocked(getClient);

function buildTarget(overrides: Partial<{ categoryHint: string | null; country: string | null }> = {}) {
  return {
    id: 'target-1',
    name: 'ESN Milano',
    url: 'https://esnmilano.it/events',
    sourceLabel: 'esn-locale',
    categoryHint: overrides.categoryHint ?? null,
    country: overrides.country ?? 'IT',
  } as any;
}

describe('extractOpportunitiesFromPage', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockedGetClient.mockReturnValue({ chat: { completions: { create: mockCreate } } } as any);
  });

  it('returns [] when no OpenAI client is configured', async () => {
    mockedGetClient.mockReturnValue(null);
    const items = await extractOpportunitiesFromPage('<main>content long enough to pass the length check</main>', {
      sourceLabel: 'esn-locale', organizer: 'ESN Milano', url: 'https://esnmilano.it/events',
    });
    expect(items).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('parses items from the { items: [...] } response shape', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ items: [{ title: 'Welcome Week', type: 'EVENT' }] }) } }],
    });

    const items = await extractOpportunitiesFromPage('<main>' + 'x'.repeat(60) + '</main>', {
      sourceLabel: 'esn-locale', organizer: 'ESN Milano', url: 'https://esnmilano.it/events',
    });

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Welcome Week');
  });

  it('includes the categoryHint bias line in the prompt when provided', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"items":[]}' } }] });

    await extractOpportunitiesFromPage('<main>' + 'x'.repeat(60) + '</main>', {
      sourceLabel: 'hackathon-org', organizer: 'Some Org', url: 'https://example.org', categoryHint: 'HACKATHON',
    });

    const userMessage = mockCreate.mock.calls[0][0].messages[1].content as string;
    expect(userMessage).toContain('HACKATHON');
  });

  it('filters out items with a missing or too-short title', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ items: [{ title: 'Hi' }, { title: 'A Real Title' }, {}] }) } }],
    });

    const items = await extractOpportunitiesFromPage('<main>' + 'x'.repeat(60) + '</main>', {
      sourceLabel: 'esn-locale', organizer: 'ESN Milano', url: 'https://esnmilano.it/events',
    });

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('A Real Title');
  });

  it('returns [] and does not throw when the LLM call fails', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    const items = await extractOpportunitiesFromPage('<main>' + 'x'.repeat(60) + '</main>', {
      sourceLabel: 'esn-locale', organizer: 'ESN Milano', url: 'https://esnmilano.it/events',
    });
    expect(items).toEqual([]);
  });

  it('returns [] for near-empty page content without calling the LLM', async () => {
    const items = await extractOpportunitiesFromPage('<main>short</main>', {
      sourceLabel: 'esn-locale', organizer: 'ESN Milano', url: 'https://esnmilano.it/events',
    });
    expect(items).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('buildHarvestRecords', () => {
  beforeEach(() => {
    resetDedupCache();
  });

  it('maps a well-formed item to an EVENT-type OpportunityRecord', () => {
    const raw: RawExtractedOpportunity[] = [{
      title: 'Welcome Week 2026',
      url: 'https://esnmilano.it/events/welcome-week',
      type: 'EVENT',
      startDate: '2026-09-15',
      endDate: '2026-09-20',
      location: 'Milano',
      format: 'IN_PERSON',
      cost: 0,
      description: 'A welcome week for international students.',
    }];

    const { records, skipped } = buildHarvestRecords(buildTarget(), raw, new Date());

    expect(skipped).toBe(0);
    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r.type).toBe('EVENT');
    expect(r.organizer).toBe('ESN Milano');
    expect(r.company).toBeNull();
    expect(r.source).toBe('HarvestTarget');
    expect(r.isRemote).toBe(false);
    expect(r.format).toBe('IN_PERSON');
  });

  it('falls back to the target categoryHint when the LLM omits/mis-types the field', () => {
    const raw: RawExtractedOpportunity[] = [{ title: 'Untyped Item', description: 'Something.' }];
    const { records } = buildHarvestRecords(buildTarget({ categoryHint: 'HACKATHON' }), raw, new Date());
    expect(records[0].type).toBe('HACKATHON');
  });

  it('defaults to EVENT when neither the item type nor categoryHint is set', () => {
    const raw: RawExtractedOpportunity[] = [{ title: 'Untyped Item', description: 'Something.' }];
    const { records } = buildHarvestRecords(buildTarget(), raw, new Date());
    expect(records[0].type).toBe('EVENT');
  });

  it('marks isRemote true for ONLINE and HYBRID formats', () => {
    const raw: RawExtractedOpportunity[] = [
      { title: 'Online Talk', format: 'ONLINE', description: 'An online talk for students.' },
      { title: 'Hybrid Meetup', format: 'HYBRID', description: 'A hybrid meetup, in person and online.' },
    ];
    const { records } = buildHarvestRecords(buildTarget(), raw, new Date());
    expect(records).toHaveLength(2);
    expect(records.every(r => r.isRemote)).toBe(true);
  });

  it('skips items with no title', () => {
    const raw: RawExtractedOpportunity[] = [{ description: 'no title here' } as any];
    const { records, skipped } = buildHarvestRecords(buildTarget(), raw, new Date());
    expect(records).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('produces a stable sourceId prefixed with harvest-<targetId>-', () => {
    const raw: RawExtractedOpportunity[] = [{ title: 'Some Event', url: 'https://x.org/e', description: 'A longer description of the event.' }];
    const { records } = buildHarvestRecords(buildTarget(), raw, new Date());
    expect(records).toHaveLength(1);
    expect(records[0].sourceId).toMatch(/^harvest-target-1-/);
  });
});
