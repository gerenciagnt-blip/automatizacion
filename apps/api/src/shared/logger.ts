/**
 * Application logger — Pino with PII redaction and trace correlation.
 *
 * Tenets enforced here:
 *   • Tenet #1 (Security by default): logs NEVER contain tokens, passwords,
 *     access tokens, refresh tokens, or message bodies. Redaction list below.
 *   • Tenet #6 (Observability day 1): every log line carries traceId,
 *     tenantId, and userId when those exist on the request.
 *
 * USAGE:
 *   import { logger } from "../shared/logger.js";
 *   logger.info({ event: "user.signup" }, "user signed up");
 *
 * Sub-loggers per module are encouraged:
 *   const log = logger.child({ module: "messaging" });
 */

import pino, { type Logger, type LoggerOptions } from "pino";
import { getTenantId, getTraceId, getUserId } from "./trace-context.js";

const REDACTED_PATHS = [
  // Authentication
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "headers.authorization",
  "headers.cookie",
  "*.password",
  "*.passwordHash",
  "*.password_hash",
  "*.token",
  "*.refreshToken",
  "*.refresh_token",
  "*.accessToken",
  "*.access_token",
  "*.accessTokenEncrypted",
  "*.refreshTokenHash",
  "*.tokenHash",
  // External secrets
  "*.apiKey",
  "*.api_key",
  "*.ANTHROPIC_API_KEY",
  "*.META_APP_SECRET",
  "*.JWT_ACCESS_SECRET",
  "*.JWT_REFRESH_SECRET",
  "*.ENCRYPTION_KEY",
  // Webhook signatures (still PII-shaped data)
  "req.headers['x-hub-signature-256']",
  // Conversation content (PII per GDPR/LGPD)
  "*.body.text",
  "*.message.body",
  "*.message.text",
  "*.content",
];

function buildLoggerOptions(level: string, isDevelopment: boolean): LoggerOptions {
  const base: LoggerOptions = {
    level,
    base: {
      service: "orion-api",
      env: process.env.NODE_ENV ?? "development",
    },
    redact: {
      paths: REDACTED_PATHS,
      censor: "[REDACTED]",
      remove: false,
    },
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        host: bindings.hostname,
        service: bindings.service,
        env: bindings.env,
      }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    /**
     * `mixin` is invoked on every log call. We use it to inject the trace
     * context that `AsyncLocalStorage` carries — no need for the caller to
     * remember to add `traceId` to every log statement.
     */
    mixin() {
      const traceId = getTraceId();
      const tenantId = getTenantId();
      const userId = getUserId();
      return {
        ...(traceId !== undefined && { traceId }),
        ...(tenantId !== undefined && { tenantId }),
        ...(userId !== undefined && { userId }),
      };
    },
  };

  if (isDevelopment) {
    return {
      ...base,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,host,service,env",
          singleLine: false,
        },
      },
    };
  }

  return base;
}

/**
 * Creates the root logger. Exposed as a factory so tests can build their own
 * silent logger; the production / dev singleton is exported as `logger`.
 */
export function createLogger(level: string, isDevelopment: boolean): Logger {
  return pino(buildLoggerOptions(level, isDevelopment));
}

/* -------------------------------------------------------------------------- */
/*  Singleton — initialised lazily so tests can stub env first                */
/* -------------------------------------------------------------------------- */

let _logger: Logger | null = null;

export function logger(): Logger {
  if (_logger === null) {
    const level = process.env.LOG_LEVEL ?? "info";
    const isDevelopment = (process.env.NODE_ENV ?? "development") === "development";
    _logger = createLogger(level, isDevelopment);
  }
  return _logger;
}

/** Test helper. Resets the cached logger so a new env can be applied. */
export function __resetLoggerForTests(): void {
  _logger = null;
}
