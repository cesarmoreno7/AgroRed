import type Redis from "ioredis";

/**
 * Lightweight Redis-backed query cache.
 * Stores JSON-serialisable results with automatic TTL expiry.
 */
export class RedisCache {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string = "cache"
  ) {}

  /**
   * Get a cached value or compute it and store for next time.
   * @param key     cache key (will be prefixed automatically)
   * @param ttl     time-to-live in seconds
   * @param compute async function that produces the value on cache miss
   */
  async getOrSet<T>(key: string, ttl: number, compute: () => Promise<T>): Promise<T> {
    const fullKey = `${this.prefix}:${key}`;
    const cached = await this.redis.get(fullKey);

    if (cached !== null) {
      return JSON.parse(cached) as T;
    }

    const value = await compute();
    await this.redis.set(fullKey, JSON.stringify(value), "EX", ttl);
    return value;
  }

  /** Invalidate a specific key. */
  async invalidate(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}:${key}`);
  }

  /** Invalidate all keys matching a pattern. */
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}:${pattern}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
