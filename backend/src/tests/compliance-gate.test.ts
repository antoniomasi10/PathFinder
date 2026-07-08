import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/import/compliance', () => ({
  checkRobotsTxt: vi.fn(),
  findAndAnalyzeTos: vi.fn(),
  daysSince: (date: Date, now: Date) => (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000),
}));

import { checkRobotsTxt, findAndAnalyzeTos } from '../services/import/compliance';
import { checkCompliance } from '../services/import/compliance/gate';

const mockedCheckRobotsTxt = vi.mocked(checkRobotsTxt);
const mockedFindAndAnalyzeTos = vi.mocked(findAndAnalyzeTos);

describe('checkCompliance', () => {
  beforeEach(() => {
    mockedCheckRobotsTxt.mockReset();
    mockedFindAndAnalyzeTos.mockReset();
  });

  it('blocks when robots.txt disallows scraping', async () => {
    mockedCheckRobotsTxt.mockResolvedValue(false);
    mockedFindAndAnalyzeTos.mockResolvedValue({ allowed: true, notes: 'ok', pageNotFound: false });

    const result = await checkCompliance('https://example.com/careers', {
      robotsAllowed: null, tosAllowed: null, complianceCheckedAt: null,
    });

    expect(result.checked).toBe(true);
    expect(result.allowed).toBe(false);
    expect(result.robotsAllowed).toBe(false);
  });

  it('blocks when ToS prohibits scraping even if robots.txt allows', async () => {
    mockedCheckRobotsTxt.mockResolvedValue(true);
    mockedFindAndAnalyzeTos.mockResolvedValue({ allowed: false, notes: 'ToS forbids automated access', pageNotFound: false });

    const result = await checkCompliance('https://example.com/careers', {
      robotsAllowed: null, tosAllowed: null, complianceCheckedAt: null,
    });

    expect(result.allowed).toBe(false);
    expect(result.tosAllowed).toBe(false);
    expect(result.tosNotes).toBe('ToS forbids automated access');
  });

  it('treats unknown ToS (null) as allowed, not blocked', async () => {
    mockedCheckRobotsTxt.mockResolvedValue(true);
    mockedFindAndAnalyzeTos.mockResolvedValue({ allowed: null, notes: 'ToS page not found', pageNotFound: true });

    const result = await checkCompliance('https://example.com/careers', {
      robotsAllowed: null, tosAllowed: null, complianceCheckedAt: null,
    });

    expect(result.allowed).toBe(true);
    expect(result.tosAllowed).toBeNull();
  });

  it('uses the cached verdict without a live check when not expired', async () => {
    const result = await checkCompliance('https://example.com/careers', {
      robotsAllowed: false, tosAllowed: true, complianceCheckedAt: new Date(),
    });

    expect(result.checked).toBe(false);
    expect(result.allowed).toBe(false); // cached robotsAllowed=false still blocks
    expect(mockedCheckRobotsTxt).not.toHaveBeenCalled();
    expect(mockedFindAndAnalyzeTos).not.toHaveBeenCalled();
  });

  it('re-checks live when the cache is older than 30 days', async () => {
    mockedCheckRobotsTxt.mockResolvedValue(true);
    mockedFindAndAnalyzeTos.mockResolvedValue({ allowed: true, notes: 'ok', pageNotFound: false });

    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const result = await checkCompliance('https://example.com/careers', {
      robotsAllowed: false, tosAllowed: false, complianceCheckedAt: staleDate,
    });

    expect(result.checked).toBe(true);
    expect(result.allowed).toBe(true);
    expect(mockedCheckRobotsTxt).toHaveBeenCalledTimes(1);
  });
});
