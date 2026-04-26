/**
 * Redis client singleton (ioredis).
 *
 * One client serves cache + rate-limiting + Socket.io adapter (S7).
 * BullMQ workers create their own connections (see Sprint 3).
 *
 * Configuration follows BullMQ requirements: `maxRetriesPerRequest: null`
 * is mandatory for BullMQ blocking commands; we apply it project-wide for
 * consistency (rate-limit retries are handled by `rate-limiter-flexible`).
 */

import { getEnv } from "@orion/shared/env";
import { Redis, type RedisOptions } from "ioredis";
import { logger } from "./logger.js";

declare global {
  // eslint-disable-next-line no-var
  var __orionRedis: Redis | undefined;
}

function createRedisClient(): Redis {
  const env = getEnv();
  const log = logger().child({ module: "redis" });

  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
    lazyConnect: false,
  };

  const client = new Redis(env.REDIS_URL, options);

  client.on("connect", () => {
    log.info({ event: "redis.connect" }, "redis connection established");
  });
  client.on("ready", () => {
    log.info({ event: "redis.ready" }, "redis ready");
  });
  client.on("error", (error) => {
    log.error({ event: "redis.error", err: error.message }, "redis error");
  });
  client.on("close", () => {
    log.warn({ event: "redis.close" }, "redis connection closed");
  });
  client.on("reconnecting", (delay: number) => {
    log.warn({ event: "redis.reconnecting", delay }, "redis reconnecting");
  });

  return client;
}

export const redis: Redis = globalThis.__orionRedis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__orionRedis = redis;
}

/**
 * Closes the Redis connection. Call from SIGTERM handler.
 */
export async function disconnectRedis(): Promise<void> {
  if (redis.status !== "end") {
    await redis.quit();
  }
}
