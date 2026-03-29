import Redis from "ioredis";

let instance: Redis | null = null;

export interface RedisOptions {
  url?: string;
  maxRetriesPerRequest?: number | null;
  lazyConnect?: boolean;
}

/**
 * Returns a singleton Redis client. Safe to call multiple times — always
 * returns the same connection. Accepts REDIS_URL in standard ioredis format.
 */
export function getRedisClient(options: RedisOptions = {}): Redis {
  if (instance) return instance;

  const url = options.url || process.env.REDIS_URL || "redis://localhost:6379";

  instance = new Redis(url, {
    maxRetriesPerRequest: options.maxRetriesPerRequest ?? 3,
    lazyConnect: options.lazyConnect ?? false,
    retryStrategy(times: number) {
      if (times > 10) return null;       // stop retrying after 10 attempts
      return Math.min(times * 200, 5000); // exponential backoff capped at 5s
    }
  });

  return instance;
}

/**
 * Creates a NEW Redis connection (not the singleton).
 * Use for BullMQ workers, Pub/Sub subscribers that need dedicated connections.
 */
export function createRedisConnection(options: RedisOptions = {}): Redis {
  const url = options.url || process.env.REDIS_URL || "redis://localhost:6379";

  return new Redis(url, {
    maxRetriesPerRequest: options.maxRetriesPerRequest ?? null,
    lazyConnect: options.lazyConnect ?? false,
    retryStrategy(times: number) {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    }
  });
}

/**
 * Graceful shutdown — close the singleton connection.
 */
export async function closeRedis(): Promise<void> {
  if (instance) {
    await instance.quit();
    instance = null;
  }
}

/**
 * Health check — ping Redis and return "ok" or throw.
 */
export async function checkRedis(client?: Redis): Promise<{ redis: string }> {
  const c = client ?? getRedisClient();
  const pong = await c.ping();
  if (pong !== "PONG") throw new Error("Redis health check failed");
  return { redis: "ok" };
}
