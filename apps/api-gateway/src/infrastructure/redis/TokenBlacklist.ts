import type Redis from "ioredis";

const PREFIX = "bl:";

/**
 * Redis-backed JWT token blacklist.
 * Stores invalidated JWT `jti` (or raw token hash) with automatic TTL expiry.
 */
export class TokenBlacklist {
  constructor(private readonly redis: Redis) {}

  /**
   * Add a token to the blacklist.
   * @param tokenId  unique identifier (preferably JWT `jti` claim, or token string)
   * @param ttlSeconds  how long to keep it (should match token remaining lifetime)
   */
  async add(tokenId: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return; // already expired, no need to blacklist
    await this.redis.set(`${PREFIX}${tokenId}`, "1", "EX", ttlSeconds);
  }

  /** Check whether a token has been blacklisted. */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    const result = await this.redis.get(`${PREFIX}${tokenId}`);
    return result !== null;
  }
}
