import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions: import('ioredis').RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
};

const redis = new Redis(REDIS_URL, redisOptions);

/**
 * Create a dedicated pub/sub pair for Socket.IO adapter.
 */
export function createPubSubPair() {
  const pub = new Redis(REDIS_URL, redisOptions);
  const sub = new Redis(REDIS_URL, redisOptions);
  return { pub, sub };
}

export default redis;
