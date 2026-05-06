import { describe, it, expect } from 'vitest';
import { calculateRetentionCutoff } from '../services/cleanup.service';

describe('calculateRetentionCutoff', () => {
  it('returns a date N days in the past', () => {
    const cutoff30 = calculateRetentionCutoff(30);
    const expected = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(Math.abs(cutoff30.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('returns a date 730 days in the past for 2 years', () => {
    const cutoff2y = calculateRetentionCutoff(730);
    const expected = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    expect(Math.abs(cutoff2y.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('earlier days produce earlier dates', () => {
    const cutoff30 = calculateRetentionCutoff(30);
    const cutoff60 = calculateRetentionCutoff(60);
    expect(cutoff60.getTime()).toBeLessThan(cutoff30.getTime());
  });
});
