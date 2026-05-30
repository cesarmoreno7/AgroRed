/**
 * Lightweight Redis-backed query cache.
 * Stores JSON-serialisable results with automatic TTL expiry.
 */
export class RedisCache {
    redis;
    prefix;
    constructor(redis, prefix = "cache") {
        this.redis = redis;
        this.prefix = prefix;
    }
    async safe(operation, fallback) {
        try {
            return await operation();
        }
        catch {
            return await fallback();
        }
    }
    /**
     * Get a cached value or compute it and store for next time.
     * @param key     cache key (will be prefixed automatically)
     * @param ttl     time-to-live in seconds
     * @param compute async function that produces the value on cache miss
     */
    async getOrSet(key, ttl, compute) {
        const fullKey = `${this.prefix}:${key}`;
        return this.safe(async () => {
            const cached = await this.redis.get(fullKey);
            if (cached !== null) {
                return JSON.parse(cached);
            }
            const value = await compute();
            await this.redis.set(fullKey, JSON.stringify(value), "EX", ttl);
            return value;
        }, compute);
    }
    /** Invalidate a specific key. */
    async invalidate(key) {
        await this.safe(() => this.redis.del(`${this.prefix}:${key}`), () => undefined);
    }
    /** Invalidate all keys matching a pattern. */
    async invalidatePattern(pattern) {
        await this.safe(async () => {
            const keys = await this.redis.keys(`${this.prefix}:${pattern}`);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        }, () => undefined);
    }
}
