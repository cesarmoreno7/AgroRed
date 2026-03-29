import Redis from "ioredis";
import { createRedisConnection } from "./RedisClient.js";

export interface EventPayload {
  type: string;
  tenantId?: string;
  data: Record<string, unknown>;
  timestamp: string;
  source: string;
}

export type EventHandler = (event: EventPayload) => void | Promise<void>;

/**
 * Redis Pub/Sub event bus for inter-service communication.
 * Each service can publish events and subscribe to channels.
 *
 * Uses dedicated Redis connections for pub and sub (ioredis requirement).
 */
export class EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers = new Map<string, EventHandler[]>();

  constructor(redisUrl?: string) {
    this.publisher = createRedisConnection({ url: redisUrl });
    this.subscriber = createRedisConnection({ url: redisUrl });

    this.subscriber.on("message", (channel: string, message: string) => {
      const handlers = this.handlers.get(channel);
      if (!handlers) return;

      try {
        const event = JSON.parse(message) as EventPayload;
        for (const handler of handlers) {
          void Promise.resolve(handler(event)).catch(() => {
            // handler errors are swallowed to avoid crashing the subscriber
          });
        }
      } catch {
        // ignore malformed messages
      }
    });
  }

  /** Publish an event to a channel. */
  async publish(channel: string, event: EventPayload): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(event));
  }

  /** Subscribe to a channel with one or more handlers. */
  async subscribe(channel: string, handler: EventHandler): Promise<void> {
    const existing = this.handlers.get(channel);
    if (existing) {
      existing.push(handler);
      return; // already subscribed at Redis level
    }

    this.handlers.set(channel, [handler]);
    await this.subscriber.subscribe(channel);
  }

  /** Graceful shutdown — close both connections. */
  async close(): Promise<void> {
    await this.subscriber.quit();
    await this.publisher.quit();
    this.handlers.clear();
  }
}
