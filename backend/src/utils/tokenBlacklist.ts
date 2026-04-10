import { createHash } from 'crypto';
import redis from '../lib/redis';

const BLACKLIST_PREFIX = 'blacklist:';
const USER_TOKENS_PREFIX = 'user_tokens:';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Add a token to the blacklist with TTL matching its remaining lifetime.
 */
export async function blacklistToken(token: string, ttlSeconds: number): Promise<void> {
  const key = `${BLACKLIST_PREFIX}${hashToken(token)}`;
  await redis.set(key, '1', 'EX', Math.max(ttlSeconds, 1));
}

/**
 * Check if a token is blacklisted.
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const key = `${BLACKLIST_PREFIX}${hashToken(token)}`;
    const result = await redis.get(key);
    return result !== null;
  } catch {
    return false; // Fail-open if Redis is down
  }
}

/**
 * Track a refresh token for a user (so we can revoke all on password change).
 */
export async function trackUserToken(userId: string, token: string): Promise<void> {
  const key = `${USER_TOKENS_PREFIX}${userId}`;
  await redis.sadd(key, hashToken(token));
  await redis.expire(key, 7 * 24 * 60 * 60); // 7 days (matches refresh token TTL)
}

/**
 * Invalidate all refresh tokens for a user.
 */
export async function invalidateAllUserTokens(userId: string): Promise<void> {
  const key = `${USER_TOKENS_PREFIX}${userId}`;
  const tokenHashes = await redis.smembers(key);
  const pipeline = redis.pipeline();
  for (const hash of tokenHashes) {
    pipeline.set(`${BLACKLIST_PREFIX}${hash}`, '1', 'EX', 7 * 24 * 60 * 60);
  }
  pipeline.del(key);
  await pipeline.exec();
}
