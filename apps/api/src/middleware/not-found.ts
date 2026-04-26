/**
 * 404 fallback middleware.
 *
 * Mounted last in the route chain. Any request that reaches here matched no
 * route and gets the canonical NotFoundError, which the global error
 * handler then formats into the standard response shape.
 */

import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../shared/errors.js";

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}
