import { Redis } from "ioredis";

export interface RedisOptions {
  url?: string;
  maxRetriesPerRequest?: number | null;
  lazyConnect?: boolean;
}

let instance: Redis | null = null;

export function getRedisClient(options: RedisOptions = {}): Redis {
  if (instance) return instance;

  const url = options.url || process.env.REDIS_URL || "redis://localhost:6379";

  instance = new Redis(url, {
    maxRetriesPerRequest: options.maxRetriesPerRequest ?? 3,
    lazyConnect: options.lazyConnect ?? false,
    retryStrategy(times: number) {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    }
  });

  return instance;
}

export async function closeRedis(): Promise<void> {
  if (instance) {
    await instance.quit();
    instance = null;
  }
}

export async function checkRedis(client?: Redis): Promise<{ redis: string }> {
  const c = client ?? getRedisClient();
  const pong = await c.ping();
  if (pong !== "PONG") throw new Error("Redis health check failed");
  return { redis: "ok" };
}
