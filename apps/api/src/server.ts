/**
 * Express application builder.
 *
 * Pure function: takes its dependencies (env, prisma, redis) and returns a
 * configured Express app. No side effects — no `listen`, no env reads, no
 * singleton creation. The HTTP server itself is started by `main.ts`.
 *
 * This separation lets integration tests build an isolated app per test
 * with mocked or in-memory dependencies.
 */

import type { Env } from "@orion/shared/env";
import type { PrismaClient } from "@prisma/client";
import compression from "compression";
import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";
import type { Redis } from "ioredis";

import { errorHandler } from "./middleware/error-handler.js";
import { notFoundMiddleware } from "./middleware/not-found.js";
import { buildRequestLogger } from "./middleware/request-logger.js";
import { traceIdMiddleware } from "./middleware/trace-id.js";
import { buildHealthRouter } from "./modules/health/health.routes.js";

export interface AppDeps {
  env: Env;
  prisma: PrismaClient;
  redis: Redis;
}

export function buildApp(deps: AppDeps): Application {
  const app = express();

  // Trust the first proxy in front of us (Nginx, Cloudflare, etc.) so
  // `req.ip` and protocol detection work correctly behind a reverse proxy.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.disable("etag"); // we set our own caching headers per-route

  // ---------- Pre-route middleware (order matters) ---------------------
  app.use(traceIdMiddleware);
  app.use(buildRequestLogger());
  app.use(
    helmet({
      contentSecurityPolicy: false, // configured per-route once we serve HTML
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: deps.env.CORS_ORIGINS,
      credentials: true,
      maxAge: 86_400,
    }),
  );
  app.use(compression());

  // Body parsers. Webhook routes (Sprint 3) will mount BEFORE these to
  // capture the raw body for HMAC verification.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // ---------- Routes ----------------------------------------------------
  app.use(buildHealthRouter({ prisma: deps.prisma, redis: deps.redis }));

  // ---------- Tail middleware ------------------------------------------
  app.use(notFoundMiddleware);
  app.use(errorHandler);

  return app;
}
