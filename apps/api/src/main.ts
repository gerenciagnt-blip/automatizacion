/**
 * Process entry point.
 *
 * Order of operations on boot:
 *   1. Load and validate environment variables (FAIL FAST if invalid).
 *   2. Initialise the logger.
 *   3. Build singletons (Prisma client, Redis client) and verify connectivity.
 *   4. Build the Express app and listen.
 *   5. Register graceful-shutdown handlers (SIGTERM, SIGINT).
 *
 * Errors during boot exit the process with code 1. Errors during runtime are
 * captured by the error handler and never crash the process.
 */

import { loadEnv } from "@orion/shared/env";
import { buildApp } from "./server.js";
import { logger } from "./shared/logger.js";
import { disconnectPrisma, prisma } from "./shared/prisma.js";
import { disconnectRedis, redis } from "./shared/redis.js";

async function bootstrap(): Promise<void> {
  // Step 1 — env. `loadEnv` exits the process on invalid configuration.
  const env = loadEnv();

  // Step 2 — logger.
  const log = logger().child({ module: "bootstrap" });
  log.info(
    {
      event: "boot.start",
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      port: env.PORT,
    },
    "orion-api bootstrapping",
  );

  // Step 3 — verify dependencies are reachable. We do not block boot on
  // them (k8s readiness probe handles that) but we do log the state up-front.
  try {
    await prisma.$queryRaw`SELECT 1`;
    log.info({ event: "boot.deps.postgres.ok" }, "postgres reachable");
  } catch (error) {
    log.error(
      { event: "boot.deps.postgres.error", err: error instanceof Error ? error.message : error },
      "postgres unreachable at boot — readiness probe will reflect this",
    );
  }
  try {
    const reply = await redis.ping();
    if (reply === "PONG") {
      log.info({ event: "boot.deps.redis.ok" }, "redis reachable");
    } else {
      throw new Error(`unexpected reply: ${reply}`);
    }
  } catch (error) {
    log.error(
      { event: "boot.deps.redis.error", err: error instanceof Error ? error.message : error },
      "redis unreachable at boot — readiness probe will reflect this",
    );
  }

  // Step 4 — build app and listen.
  const app = buildApp({ env, prisma, redis });

  const server = app.listen(env.PORT, () => {
    log.info(
      { event: "boot.listening", port: env.PORT },
      `orion-api listening on http://localhost:${env.PORT}`,
    );
  });

  // Step 5 — graceful shutdown.
  const shutdown = async (signal: string): Promise<void> => {
    log.info({ event: "shutdown.start", signal }, "graceful shutdown initiated");

    // Stop accepting new connections, wait for in-flight to finish.
    server.close((err) => {
      if (err) {
        log.error({ event: "shutdown.http.error", err: err.message }, "error closing http server");
      } else {
        log.info({ event: "shutdown.http.ok" }, "http server closed");
      }
    });

    // Hard timeout if connections refuse to drain.
    const forceTimer = setTimeout(() => {
      log.warn({ event: "shutdown.timeout" }, "shutdown timed out — forcing exit");
      process.exit(1);
    }, 15_000);
    forceTimer.unref();

    try {
      await disconnectPrisma();
      log.info({ event: "shutdown.prisma.ok" }, "prisma disconnected");
    } catch (err) {
      log.error(
        { event: "shutdown.prisma.error", err: err instanceof Error ? err.message : err },
        "error disconnecting prisma",
      );
    }
    try {
      await disconnectRedis();
      log.info({ event: "shutdown.redis.ok" }, "redis disconnected");
    } catch (err) {
      log.error(
        { event: "shutdown.redis.error", err: err instanceof Error ? err.message : err },
        "error disconnecting redis",
      );
    }

    log.info({ event: "shutdown.done" }, "shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  // Unhandled rejections / exceptions go to the logger; we deliberately do
  // NOT exit, because per Tenet #6 the process must keep serving healthy
  // requests. Sentry (Sprint 8) will capture these as well.
  process.on("unhandledRejection", (reason) => {
    log.error(
      { event: "process.unhandledRejection", reason: String(reason) },
      "unhandled promise rejection",
    );
  });
  process.on("uncaughtException", (err) => {
    log.error(
      { event: "process.uncaughtException", err: err.message, stack: err.stack },
      "uncaught exception",
    );
  });
}

void bootstrap();
