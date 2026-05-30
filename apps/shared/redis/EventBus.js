import { createRedisConnection } from "./RedisClient.js";
/**
 * Redis Pub/Sub event bus for inter-service communication.
 * Each service can publish events and subscribe to channels.
 *
 * Uses dedicated Redis connections for pub and sub (ioredis requirement).
 */
export class EventBus {
    publisher;
    subscriber;
    handlers = new Map();
    constructor(redisUrl) {
        this.publisher = createRedisConnection({ url: redisUrl });
        this.subscriber = createRedisConnection({ url: redisUrl });
        this.publisher.on("error", () => {
            // Keep Redis transport failures from crashing request handlers.
        });
        this.subscriber.on("error", () => {
            // Keep Redis transport failures from crashing subscriber processes.
        });
        this.subscriber.on("message", (channel, message) => {
            const handlers = this.handlers.get(channel);
            if (!handlers)
                return;
            try {
                const event = JSON.parse(message);
                for (const handler of handlers) {
                    void Promise.resolve(handler(event)).catch(() => {
                        // handler errors are swallowed to avoid crashing the subscriber
                    });
                }
            }
            catch {
                // ignore malformed messages
            }
        });
    }
    /** Publish an event to a channel. */
    async publish(channel, event) {
        await this.publisher.publish(channel, JSON.stringify(event));
    }
    /** Subscribe to a channel with one or more handlers. */
    async subscribe(channel, handler) {
        const existing = this.handlers.get(channel);
        if (existing) {
            existing.push(handler);
            return; // already subscribed at Redis level
        }
        this.handlers.set(channel, [handler]);
        try {
            await this.subscriber.subscribe(channel);
        }
        catch (error) {
            this.handlers.delete(channel);
            throw error;
        }
    }
    /** Graceful shutdown — close both connections. */
    async close() {
        await Promise.allSettled([this.subscriber.quit(), this.publisher.quit()]);
        this.handlers.clear();
    }
}
