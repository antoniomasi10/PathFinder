import { describe, it, expect } from 'vitest';
import { isItalyLocation } from '../services/import/adzuna.import';
import { isSeniorRole, mapOpportunityType } from '../services/import/utils';

describe('isItalyLocation (Adzuna location.area)', () => {
  it('recognizes "Italy" in the area breadcrumb', () => {
    expect(isItalyLocation(['Italy', 'Lombardia', 'Milano'])).toBe(true);
  });

  it('recognizes the Italian spelling "Italia"', () => {
    expect(isItalyLocation(['Italia', 'Lazio', 'Roma'])).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isItalyLocation(['ITALY'])).toBe(true);
  });

  it('returns false for other countries', () => {
    expect(isItalyLocation(['Germany', 'Berlin'])).toBe(false);
  });

  it('returns false for undefined/empty area', () => {
    expect(isItalyLocation(undefined)).toBe(false);
    expect(isItalyLocation([])).toBe(false);
  });
});

describe('Adzuna student-role filtering (shared isSeniorRole/mapOpportunityType)', () => {
  it('keeps clearly entry-level titles', () => {
    expect(isSeniorRole('Stage Marketing — Acme')).toBe(false);
    expect(isSeniorRole('Junior Software Engineer')).toBe(false);
    expect(mapOpportunityType('Stage Marketing')).toBe('TIROCINIO');
  });

  it('filters out senior roles even when phrased loosely', () => {
    expect(isSeniorRole('Marketing Lead — Acme Italia')).toBe(true);
    expect(isSeniorRole('Senior Backend Engineer')).toBe(true);
  });

  it('keeps a role when both a senior and a safe keyword are present (safe wins)', () => {
    expect(isSeniorRole('Store Manager Trainee')).toBe(false);
  });
});
