/**
 * Global error handler.
 *
 * Express 5 forwards async errors automatically — no need for the legacy
 * `express-async-errors` shim. This handler is the last middleware and
 * normalises every error into the canonical response shape:
 *
 *   {
 *     "error": {
 *       "code": "<machine-readable code>",
 *       "message": "<human-readable safe message>",
 *       "details": { … } | undefined,
 *       "traceId": "<uuid>"
 *     }
 *   }
 *
 * Tenets enforced:
 *   • #1 Security by default — internal stack traces never leak in prod.
 *   • #6 Observability — every error logs with traceId / tenantId / userId
 *     courtesy of the logger's mixin.
 */

import type { ErrorRequestHandler } from "express";
import { type AppError, isAppError } from "../shared/errors.js";
import { logger } from "../shared/logger.js";
import { getTraceId } from "../shared/trace-context.js";

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    traceId: string | undefined;
  };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const log = logger().child({ module: "error-handler" });
  const traceId = getTraceId();
  const isProduction = process.env.NODE_ENV === "production";

  if (isAppError(err)) {
    const appError = err as AppError;
    log.warn(
      {
        event: "request.error",
        code: appError.code,
        statusCode: appError.statusCode,
        details: appError.details,
      },
      appError.message,
    );
    const body: ErrorResponseBody = {
      error: {
        code: appError.code,
        message: appError.message,
        traceId,
        ...(appError.details !== undefined && { details: appError.details }),
      },
    };
    res.status(appError.statusCode).json(body);
    return;
  }

  // Non-operational error → log full detail server-side, return generic message.
  const message = err instanceof Error ? err.message : "Unexpected error";
  const stack = err instanceof Error ? err.stack : undefined;
  log.error({ event: "request.error.unexpected", err: { message, stack } }, message);

  const body: ErrorResponseBody = {
    error: {
      code: "INTERNAL",
      message: isProduction ? "Internal server error" : message,
      traceId,
    },
  };
  res.status(500).json(body);
};
