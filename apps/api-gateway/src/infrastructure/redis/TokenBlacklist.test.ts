import { TokenBlacklist } from "./TokenBlacklist.js";

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
}

describe("TokenBlacklist", () => {
  let blacklist: TokenBlacklist;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    blacklist = new TokenBlacklist(redis as any);
  });

  it("reports a non-blacklisted token as valid", async () => {
    expect(await blacklist.isBlacklisted("abc-123")).toBe(false);
  });

  it("blacklists a token and detects it", async () => {
    await blacklist.add("tok-1", 3600);
    expect(await blacklist.isBlacklisted("tok-1")).toBe(true);
  });

  it("does not blacklist when ttl <= 0", async () => {
    await blacklist.add("expired-tok", 0);
    expect(await blacklist.isBlacklisted("expired-tok")).toBe(false);
  });

  it("multiple tokens are independent", async () => {
    await blacklist.add("tok-a", 600);
    await blacklist.add("tok-b", 600);
    expect(await blacklist.isBlacklisted("tok-a")).toBe(true);
    expect(await blacklist.isBlacklisted("tok-b")).toBe(true);
    expect(await blacklist.isBlacklisted("tok-c")).toBe(false);
  });

  it("uses bl: prefix for storage", async () => {
    await blacklist.add("my-jti", 100);
    // Verify the FakeRedis stored with prefix
    expect(await redis.get("bl:my-jti")).toBe("1");
  });
});
