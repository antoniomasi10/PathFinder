import { describe, it, expect } from 'vitest';
import { extractAtsToken } from '../services/import/company-registry/loaders/commoncrawl-ats.loader';

describe('extractAtsToken', () => {
  it('extracts a Greenhouse board token', () => {
    expect(extractAtsToken('https://boards.greenhouse.io/acme/jobs/12345')).toEqual({ platform: 'greenhouse', token: 'acme' });
  });

  it('extracts a Lever board token', () => {
    expect(extractAtsToken('https://jobs.lever.co/acme/abc-123')).toEqual({ platform: 'lever', token: 'acme' });
  });

  it('extracts an Ashby board token', () => {
    expect(extractAtsToken('https://jobs.ashbyhq.com/acme')).toEqual({ platform: 'ashby', token: 'acme' });
  });

  it('extracts a Workable board token', () => {
    expect(extractAtsToken('https://apply.workable.com/acme/j/ABCDEF/')).toEqual({ platform: 'workable', token: 'acme' });
  });

  it('extracts a Recruitee subdomain token', () => {
    expect(extractAtsToken('https://acme.recruitee.com/o/software-engineer')).toEqual({ platform: 'recruitee', token: 'acme' });
  });

  it('rejects generic Recruitee subdomains that are not real board tokens', () => {
    expect(extractAtsToken('https://www.recruitee.com/about')).toBeNull();
    expect(extractAtsToken('https://api.recruitee.com/offers')).toBeNull();
  });

  it('is case-insensitive and normalizes to lowercase', () => {
    expect(extractAtsToken('https://boards.greenhouse.io/ACME')).toEqual({ platform: 'greenhouse', token: 'acme' });
  });

  it('returns null for URLs on unrelated hosts', () => {
    expect(extractAtsToken('https://example.com/careers')).toBeNull();
  });

  it('returns null for prohibited-ATS hosts (never in the platform list)', () => {
    expect(extractAtsToken('https://acme.myworkdayjobs.com/careers')).toBeNull();
  });
});
