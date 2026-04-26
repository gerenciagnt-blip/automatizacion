/**
 * HTTP request logger using `pino-http`.
 *
 * Logs every request and response with structured fields. Skips noisy
 * health endpoints to keep dashboards clean.
 *
 * `serializers.req/res` keep the payload minimal (no headers blob, no body).
 * The redaction list in `shared/logger.ts` covers everything else.
 */

import type { RequestHandler } from "express";
import { pinoHttp } from "pino-http";
import { logger } from "../shared/logger.js";

const SKIP_PATHS = new Set(["/health", "/ready", "/metrics"]);

export function buildRequestLogger(): RequestHandler {
  return pinoHttp({
    logger: logger(),
    autoLogging: {
      ignore: (req) => SKIP_PATHS.has(req.url ?? ""),
    },
    customLogLevel: (_req, res, err) => {
      if (err !== undefined && err !== null) return "error";
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
        userAgent: req.headers?.["user-agent"],
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
  });
}
