import { describe, it, expect } from 'vitest';
import { validateAge, parseAndValidateBirthDate } from '../utils/age';

function yearsAgo(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}

describe('validateAge', () => {
  it('throws for user aged 17', () => {
    expect(() => validateAge(yearsAgo(17))).toThrow('almeno 18 anni');
  });

  it('throws for user aged 0', () => {
    expect(() => validateAge(new Date())).toThrow('almeno 18 anni');
  });

  it('accepts user aged exactly 18 (one day past birthday)', () => {
    const d = yearsAgo(18);
    d.setDate(d.getDate() - 1);
    expect(() => validateAge(d)).not.toThrow();
  });

  it('accepts user aged 25', () => {
    expect(() => validateAge(yearsAgo(25))).not.toThrow();
  });
});

describe('parseAndValidateBirthDate', () => {
  it('throws on invalid date string', () => {
    expect(() => parseAndValidateBirthDate('not-a-date')).toThrow('non valida');
  });

  it('throws on future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(() => parseAndValidateBirthDate(future.toISOString())).toThrow('futuro');
  });

  it('returns a Date object for valid adult', () => {
    const adult = yearsAgo(22);
    const result = parseAndValidateBirthDate(adult.toISOString().split('T')[0]);
    expect(result).toBeInstanceOf(Date);
  });
});
