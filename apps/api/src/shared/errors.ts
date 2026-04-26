/**
 * Domain error hierarchy.
 *
 * Every error thrown by application code should extend `AppError` so the
 * global error handler can map it to a consistent HTTP response without
 * leaking internals.
 *
 * Errors that escape this hierarchy are treated as INTERNAL and produce a
 * `500` with no detail leaked to the client.
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "RATE_LIMITED"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown> | undefined;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    options: {
      statusCode: number;
      code: ErrorCode;
      details?: Record<string, unknown> | undefined;
      cause?: unknown;
    },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.isOperational = true;
    // Preserve the V8 stack trace.
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: Record<string, unknown>) {
    super(message, { statusCode: 400, code: "BAD_REQUEST", details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: Record<string, unknown>) {
    super(message, { statusCode: 401, code: "UNAUTHORIZED", details });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: Record<string, unknown>) {
    super(message, { statusCode: 403, code: "FORBIDDEN", details });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: Record<string, unknown>) {
    super(message, { statusCode: 404, code: "NOT_FOUND", details });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: Record<string, unknown>) {
    super(message, { statusCode: 409, code: "CONFLICT", details });
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Unprocessable entity", details?: Record<string, unknown>) {
    super(message, { statusCode: 422, code: "UNPROCESSABLE_ENTITY", details });
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests", details?: Record<string, unknown>) {
    super(message, { statusCode: 429, code: "RATE_LIMITED", details });
  }
}

export class DependencyUnavailableError extends AppError {
  constructor(message = "Upstream dependency unavailable", details?: Record<string, unknown>) {
    super(message, { statusCode: 503, code: "DEPENDENCY_UNAVAILABLE", details });
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
