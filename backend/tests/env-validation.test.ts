import { describe, it, expect } from 'vitest';
import { validateEnv } from '../src/lib/validateEnv';

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

    it('passes with current dev values', () => {
      expect(() => validateEnv({
        JWT_SECRET: 'pathfinder-jwt-secret-dev-only',
        JWT_REFRESH_SECRET: 'pathfinder-refresh-secret-dev-only',
        DATABASE_URL: 'postgresql://pathfinder:pathfinder@localhost:5432/pathfinder',
      }, 'development')).not.toThrow();
    });

    it('passes DATABASE_URL that is shorter than 32 chars', () => {
      expect(() => validateEnv({
        JWT_SECRET: 'a'.repeat(8),
        JWT_REFRESH_SECRET: 'b'.repeat(8),
        DATABASE_URL: 'pg://x',
      }, 'development')).not.toThrow();
    });
  });

  describe('production mode', () => {
    it('throws if JWT_SECRET is less than 32 chars', () => {
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

    it('accepts short DATABASE_URL in production (not a secret)', () => {
      expect(() => validateEnv({
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        DATABASE_URL: 'pg://x',
      }, 'production')).not.toThrow();
    });
  });

  it('throws if JWT_REFRESH_SECRET is missing', () => {
    expect(() => validateEnv({ JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: undefined, DATABASE_URL: 'postgres://x' }))
      .toThrow('JWT_REFRESH_SECRET is missing');
  });

  it('throws if DATABASE_URL is missing', () => {
    expect(() => validateEnv({ JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), DATABASE_URL: undefined }))
      .toThrow('DATABASE_URL is missing');
  });
});
