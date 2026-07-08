import { describe, it, expect } from 'vitest';
import { buildDedupKey } from '../services/import/utils';

describe('buildDedupKey', () => {
  it('returns null for too-short title/company', () => {
    expect(buildDedupKey('ab', 'Acme')).toBeNull();
    expect(buildDedupKey('Software Engineer', 'A')).toBeNull();
  });

  it('normalizes case, accents, and role decoration', () => {
    const a = buildDedupKey('Ingegnere Software (m/f/d)', 'Società Perché');
    const b = buildDedupKey('INGEGNERE SOFTWARE', 'societa perche');
    expect(a).toEqual(b);
  });

  it('produces the same key without a startDate (backward compatible)', () => {
    const key = buildDedupKey('Summer School AI', 'ESN Italia');
    expect(key).toBe('summer school ai|esn italia');
  });

  it('appends startDate when provided, keeping non-dated calls unaffected', () => {
    const withoutDate = buildDedupKey('Hackathon Milano', 'HackClub');
    const withDate = buildDedupKey('Hackathon Milano', 'HackClub', new Date('2026-09-12T10:00:00Z'));
    expect(withoutDate).toBe('hackathon milano|hackclub');
    expect(withDate).toBe('hackathon milano|hackclub|2026-09-12');
    expect(withDate).not.toBe(withoutDate);
  });

  it('distinguishes recurring instances of the same event by startDate', () => {
    const instance1 = buildDedupKey('ESN Winter Trip', 'ESN Italia', new Date('2026-01-10'));
    const instance2 = buildDedupKey('ESN Winter Trip', 'ESN Italia', new Date('2027-01-09'));
    expect(instance1).not.toBe(instance2);
  });

  it('treats a null/undefined startDate the same as omitting it', () => {
    const a = buildDedupKey('Fellowship EU', 'EURAXESS', null);
    const b = buildDedupKey('Fellowship EU', 'EURAXESS');
    expect(a).toBe(b);
  });
});
