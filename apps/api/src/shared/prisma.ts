/**
 * Prisma client singleton.
 *
 * One PrismaClient per process is the recommended pattern; instantiating
 * many causes connection-pool exhaustion against Postgres.
 *
 * The singleton is hung off `globalThis` so `tsx watch` (dev hot-reload)
 * does not create a new client on each module re-execution.
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

declare global {
  // eslint-disable-next-line no-var
  var __orionPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const log = logger().child({ module: "prisma" });
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
      { emit: "event", level: "info" },
      { emit: "event", level: "query" },
    ],
  });

  client.$on("error", (event) => {
    log.error({ event: "prisma.error", target: event.target }, event.message);
  });
  client.$on("warn", (event) => {
    log.warn({ event: "prisma.warn", target: event.target }, event.message);
  });
  client.$on("info", (event) => {
    log.debug({ event: "prisma.info", target: event.target }, event.message);
  });
  client.$on("query", (event) => {
    if ((process.env.LOG_LEVEL ?? "info") === "trace") {
      log.trace(
        {
          event: "prisma.query",
          duration: event.duration,
          target: event.target,
        },
        event.query,
      );
    }
  });

  return client;
}

export const prisma: PrismaClient = globalThis.__orionPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__orionPrisma = prisma;
}

/**
 * Disconnects the Prisma client. Call this from the SIGTERM handler so the
 * process drains its connection pool gracefully on shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
