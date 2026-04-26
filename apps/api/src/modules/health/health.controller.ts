/**
 * Liveness and readiness controllers.
 *
 *   GET /health   → liveness   (cheap; the process is alive)
 *   GET /ready    → readiness  (verifies DB and Redis are reachable)
 *
 * The split is the standard Kubernetes pattern. Load balancers route on
 * `/health`; orchestration platforms decide when to send traffic on
 * `/ready`. DigitalOcean's App Platform supports both probes.
 *
 * Readiness MUST stay fast — < 1 s end-to-end — and never throw. A failure
 * in any dependency turns the response into HTTP 503 with a per-dependency
 * status payload that humans can scan at a glance.
 */

import type { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import type { Redis } from "ioredis";

interface DependencyStatus {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface ReadinessReport {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
}

const READY_TIMEOUT_MS = 1_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function pingDatabase(prisma: PrismaClient): Promise<DependencyStatus> {
  const start = performance.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, READY_TIMEOUT_MS, "database ping");
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function pingRedis(redis: Redis): Promise<DependencyStatus> {
  const start = performance.now();
  try {
    const reply = await withTimeout(redis.ping(), READY_TIMEOUT_MS, "redis ping");
    if (reply !== "PONG") {
      throw new Error(`Unexpected reply: ${reply}`);
    }
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface HealthControllerDeps {
  prisma: PrismaClient;
  redis: Redis;
}

export function buildHealthController(deps: HealthControllerDeps) {
  return {
    /**
     * Liveness — the process exists and the event loop is responsive.
     * Cheap; never touches dependencies; always returns 200 unless the
     * process is so degraded it cannot answer.
     */
    liveness(_req: Request, res: Response): void {
      res.status(200).json({
        status: "ok",
        uptimeSeconds: Math.round(process.uptime()),
      });
    },

    /**
     * Readiness — the process can serve real traffic.
     * Verifies Postgres and Redis are reachable within READY_TIMEOUT_MS.
     */
    async readiness(_req: Request, res: Response): Promise<void> {
      const [database, redisCheck] = await Promise.all([
        pingDatabase(deps.prisma),
        pingRedis(deps.redis),
      ]);

      const allOk = database.ok && redisCheck.ok;
      const report: ReadinessReport = {
        status: allOk ? "ok" : "degraded",
        uptimeSeconds: Math.round(process.uptime()),
        checks: { database, redis: redisCheck },
      };
      res.status(allOk ? 200 : 503).json(report);
    },
  };
}

export type HealthController = ReturnType<typeof buildHealthController>;
