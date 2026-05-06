import redis from './redis';

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, data: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch {
    // Cache write failure is non-fatal — request proceeds without caching
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  try {
    // Use SCAN instead of KEYS to avoid blocking Redis on large keyspaces
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length > 0) await redis.del(...keys);
  } catch {}
}
