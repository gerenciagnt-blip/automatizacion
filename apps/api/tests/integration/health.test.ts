/**
 * Integration tests — health and readiness endpoints.
 *
 * Builds the Express app with stubbed dependencies, hits it via Supertest,
 * and asserts the response shape. No real Postgres or Redis required —
 * those come online with Testcontainers from Sprint 3 onwards.
 */

import type { Env } from "@orion/shared/env";
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { buildApp } from "../../src/server.js";

function makeEnv(): Env {
  return {
    NODE_ENV: "test",
    PORT: 0,
    LOG_LEVEL: "silent",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "a".repeat(64),
    JWT_REFRESH_SECRET: "b".repeat(64),
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 1_209_600,
    ENCRYPTION_KEY: "c".repeat(64),
    META_APP_SECRET: "d".repeat(40),
    META_VERIFY_TOKEN: "e".repeat(40),
    META_GRAPH_API_VERSION: "v21.0",
    ANTHROPIC_API_KEY: `sk-ant-${"x".repeat(40)}`,
    ANTHROPIC_MODEL_TRIAGE: "claude-sonnet-4-6",
    ANTHROPIC_MODEL_CLASSIFY: "claude-haiku-4-5",
    CORS_ORIGINS: ["http://localhost:5173"],
    COOKIE_DOMAIN: "localhost",
    FEATURE_AUTO_REPLY_ENABLED: false,
    FEATURE_AI_TRIAGE_ENABLED: true,
  } as Env;
}

function makePrisma(opts: { ping?: "ok" | "fail" } = {}): PrismaClient {
  const ping = opts.ping ?? "ok";
  return {
    $queryRaw: vi.fn(async () => {
      if (ping === "fail") {
        throw new Error("simulated postgres outage");
      }
      return [{ "?column?": 1 }];
    }),
    $disconnect: vi.fn(async () => undefined),
  } as unknown as PrismaClient;
}

function makeRedis(opts: { ping?: "ok" | "fail" } = {}): Redis {
  const ping = opts.ping ?? "ok";
  return {
    ping: vi.fn(async () => {
      if (ping === "fail") {
        throw new Error("simulated redis outage");
      }
      return "PONG";
    }),
    quit: vi.fn(async () => "OK"),
    status: "ready",
  } as unknown as Redis;
}

describe("GET /health (liveness)", () => {
  it("responds 200 with status ok and uptime", async () => {
    const app = buildApp({ env: makeEnv(), prisma: makePrisma(), redis: makeRedis() });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      uptimeSeconds: expect.any(Number),
    });
  });

  it("propagates X-Trace-Id when one is supplied", async () => {
    const app = buildApp({ env: makeEnv(), prisma: makePrisma(), redis: makeRedis() });
    const traceId = "test-trace-12345678";
    const res = await request(app).get("/health").set("X-Trace-Id", traceId);
    expect(res.status).toBe(200);
    expect(res.headers["x-trace-id"]).toBe(traceId);
  });

  it("generates a trace-id when one is not supplied", async () => {
    const app = buildApp({ env: makeEnv(), prisma: makePrisma(), redis: makeRedis() });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-trace-id"]).toBeDefined();
    expect(res.headers["x-trace-id"]).toMatch(/^[a-zA-Z0-9_-]{8,}$/);
  });
});

describe("GET /ready (readiness)", () => {
  it("responds 200 when all dependencies are healthy", async () => {
    const app = buildApp({
      env: makeEnv(),
      prisma: makePrisma({ ping: "ok" }),
      redis: makeRedis({ ping: "ok" }),
    });
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      checks: {
        database: { ok: true, latencyMs: expect.any(Number) },
        redis: { ok: true, latencyMs: expect.any(Number) },
      },
    });
  });

  it("responds 503 when postgres is unreachable", async () => {
    const app = buildApp({
      env: makeEnv(),
      prisma: makePrisma({ ping: "fail" }),
      redis: makeRedis({ ping: "ok" }),
    });
    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.checks.database.ok).toBe(false);
    expect(res.body.checks.redis.ok).toBe(true);
  });

  it("responds 503 when redis is unreachable", async () => {
    const app = buildApp({
      env: makeEnv(),
      prisma: makePrisma({ ping: "ok" }),
      redis: makeRedis({ ping: "fail" }),
    });
    const res = await request(app).get("/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.checks.database.ok).toBe(true);
    expect(res.body.checks.redis.ok).toBe(false);
  });
});

describe("404 fallback", () => {
  it("returns the canonical error shape with traceId", async () => {
    const app = buildApp({ env: makeEnv(), prisma: makePrisma(), redis: makeRedis() });
    const res = await request(app).get("/nope-not-here");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: {
        code: "NOT_FOUND",
        message: expect.stringContaining("/nope-not-here"),
        traceId: expect.any(String),
      },
    });
  });
});
