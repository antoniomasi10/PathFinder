import { describe, it, expect } from 'vitest';

const REQUIRED_VARS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];

function validateEnv(env: Record<string, string | undefined>, nodeEnv: string = 'development') {
  const MIN_SECRET_LENGTH = nodeEnv === 'production' ? 32 : 8;

  for (const key of REQUIRED_VARS) {
    if (!env[key]) {
      throw new Error(`Env var ${key} is missing`);
    }
    if (env[key]!.length < MIN_SECRET_LENGTH) {
      throw new Error(`Env var ${key} is too short (min ${MIN_SECRET_LENGTH} chars in ${nodeEnv})`);
    }
  }
}

describe('validateEnv', () => {
  describe('development mode', () => {
    it('throws if JWT_SECRET is missing', () => {
      expect(() => validateEnv({ JWT_SECRET: undefined, JWT_REFRESH_SECRET: 'a'.repeat(8), DATABASE_URL: 'postgres://x' }, 'development'))
        .toThrow('JWT_SECRET is missing');
    });

    it('throws if JWT_SECRET is too short', () => {
      expect(() => validateEnv({ JWT_SECRET: 'short', JWT_REFRESH_SECRET: 'a'.repeat(8), DATABASE_URL: 'postgres://x' }, 'development'))
        .toThrow('too short');
    });

    it('passes with 8+ char secrets in dev', () => {
      expect(() => validateEnv({
        JWT_SECRET: 'a'.repeat(8),
        JWT_REFRESH_SECRET: 'b'.repeat(8),
        DATABASE_URL: 'postgresql://user:pass@localhost/db',
      }, 'development')).not.toThrow();
    });

    it('passes with 30 char secrets (current dev values)', () => {
      expect(() => validateEnv({
        JWT_SECRET: 'pathfinder-jwt-secret-dev-only',
        JWT_REFRESH_SECRET: 'pathfinder-refresh-secret-dev-only',
        DATABASE_URL: 'postgresql://pathfinder:pathfinder@localhost:5432/pathfinder',
      }, 'development')).not.toThrow();
    });
  });

  describe('production mode', () => {
    it('throws if JWT_SECRET is less than 32 chars in production', () => {
      expect(() => validateEnv({ JWT_SECRET: 'a'.repeat(20), JWT_REFRESH_SECRET: 'b'.repeat(32), DATABASE_URL: 'postgres://x' }, 'production'))
        .toThrow('too short');
    });

    it('passes with 32+ char secrets in production', () => {
      expect(() => validateEnv({
        JWT_SECRET: 'a'.repeat(64),
        JWT_REFRESH_SECRET: 'b'.repeat(64),
        DATABASE_URL: 'postgresql://user:pass@localhost/db',
      }, 'production')).not.toThrow();
    });
  });

  it('throws if JWT_REFRESH_SECRET is missing', () => {
    expect(() => validateEnv({ JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: undefined, DATABASE_URL: 'postgres://x' }, 'development'))
      .toThrow('JWT_REFRESH_SECRET is missing');
  });

  it('throws if DATABASE_URL is missing', () => {
    expect(() => validateEnv({ JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), DATABASE_URL: undefined }, 'production'))
      .toThrow('DATABASE_URL is missing');
  });
});
