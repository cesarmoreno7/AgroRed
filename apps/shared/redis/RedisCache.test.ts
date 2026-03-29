import { RedisCache } from "./RedisCache.js";

class FakeRedis {
  private store = new Map<string, { value: string; expiry: number }>();

  async set(key: string, value: string, mode: string, ttl: number): Promise<void> {
    this.store.set(key, { value, expiry: Date.now() + ttl * 1000 });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) this.store.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.replace("*", "");
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }
}

describe("RedisCache", () => {
  let cache: RedisCache;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    cache = new RedisCache(redis as any, "test");
  });

  it("computes and caches a value on first call", async () => {
    let calls = 0;
    const result = await cache.getOrSet("key1", 300, async () => {
      calls++;
      return { total: 42 };
    });

    expect(result).toEqual({ total: 42 });
    expect(calls).toBe(1);
  });

  it("returns cached value on second call without recomputing", async () => {
    let calls = 0;
    const compute = async () => {
      calls++;
      return { data: "expensive" };
    };

    await cache.getOrSet("key2", 300, compute);
    const second = await cache.getOrSet("key2", 300, compute);

    expect(second).toEqual({ data: "expensive" });
    expect(calls).toBe(1);
  });

  it("invalidates a specific key", async () => {
    let calls = 0;
    const compute = async () => {
      calls++;
      return `v${calls}`;
    };

    await cache.getOrSet("inv1", 300, compute);
    await cache.invalidate("inv1");

    const result = await cache.getOrSet("inv1", 300, compute);
    expect(result).toBe("v2");
    expect(calls).toBe(2);
  });

  it("invalidatePattern clears matching keys", async () => {
    await cache.getOrSet("summary:t1", 300, async () => "a");
    await cache.getOrSet("summary:t2", 300, async () => "b");
    await cache.getOrSet("other", 300, async () => "c");

    await cache.invalidatePattern("summary:*");

    let calls = 0;
    const r1 = await cache.getOrSet("summary:t1", 300, async () => {
      calls++;
      return "new-a";
    });
    expect(r1).toBe("new-a");
    expect(calls).toBe(1);

    // "other" should still be cached
    let otherCalls = 0;
    const r2 = await cache.getOrSet("other", 300, async () => {
      otherCalls++;
      return "new-c";
    });
    expect(r2).toBe("c");
    expect(otherCalls).toBe(0);
  });

  it("uses the provided prefix in key namespace", async () => {
    await cache.getOrSet("mykey", 60, async () => "val");
    expect(await redis.get("test:mykey")).toBe('"val"');
  });

  it("handles complex objects", async () => {
    const complexObj = {
      tenantId: "t1",
      totals: { offers: 10, rescues: 5 },
      generatedAt: "2025-01-01T00:00:00Z"
    };

    await cache.getOrSet("complex", 120, async () => complexObj);
    const cached = await cache.getOrSet("complex", 120, async () => ({ overwritten: true }));

    expect(cached).toEqual(complexObj);
  });
});
