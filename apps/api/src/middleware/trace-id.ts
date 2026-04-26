/**
 * Trace-id middleware.
 *
 * Reads the inbound `X-Trace-Id` header (or generates a new one), sets it
 * into the request-scoped AsyncLocalStorage, and echoes it back on the
 * response so callers can correlate retries.
 *
 * Must run BEFORE every other middleware that logs or branches on context.
 */

import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { traceContext } from "../shared/trace-context.js";

const TRACE_HEADER = "x-trace-id";
const TRACE_HEADER_RES = "X-Trace-Id";
const TRACE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

function readOrGenerateTraceId(req: Request): string {
  const inbound = req.header(TRACE_HEADER);
  if (typeof inbound === "string" && TRACE_ID_PATTERN.test(inbound)) {
    return inbound;
  }
  return randomUUID();
}

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = readOrGenerateTraceId(req);
  res.setHeader(TRACE_HEADER_RES, traceId);
  traceContext.run({ traceId }, () => {
    next();
  });
}
