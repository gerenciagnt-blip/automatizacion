/**
 * @orion/shared/env
 *
 * Centralised, fail-fast environment validation using Zod 4.
 *
 * USAGE:
 *   import { env } from "@orion/shared/env";
 *   console.log(env.DATABASE_URL);
 *
 * BEHAVIOUR:
 *   On import, this module:
 *     1. Reads process.env
 *     2. Coerces and validates every variable against the schema
 *     3. If validation fails → prints a grouped, human-readable error and
 *        exits the process with code 1. Tenets #1 (Security by default) and
 *        the prohibition "Asumir configuración del entorno" both demand this.
 *
 * EXTENDING:
 *   Add a new field to `EnvSchema` below. Document it in `.env.example`
 *   with the same name and a comment explaining its purpose and where to
 *   obtain it if it is an external credential.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Comma-separated string → trimmed array of non-empty strings */
const csvList = z
  .string()
  .min(1, "Must contain at least one entry")
  .transform((raw) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
  .pipe(z.array(z.string().min(1)).min(1, "Must resolve to at least one entry"));

/** Secret string with a minimum length (HMAC/JWT cryptographic safety) */
const secret = (minLength: number, label: string) =>
  z
    .string()
    .min(minLength, `${label} must be at least ${minLength} characters (cryptographic strength)`);

/* -------------------------------------------------------------------------- */
/*  Schema                                                                    */
/* -------------------------------------------------------------------------- */

const NodeEnv = z.enum(["development", "test", "staging", "production"]);
const LogLevel = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

export const EnvSchema = z.object({
  /* ---------- Runtime ---------- */
  NODE_ENV: NodeEnv.default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: LogLevel.default("info"),

  /* ---------- Database ---------- */
  DATABASE_URL: z
    .string()
    .url("Must be a valid Postgres connection string")
    .startsWith("postgresql://", "Must start with postgresql://"),
  DATABASE_URL_TEST: z.string().url().startsWith("postgresql://").optional(),

  /* ---------- Cache / Queue / Pub-Sub ---------- */
  REDIS_URL: z
    .string()
    .url("Must be a valid Redis connection string")
    .refine(
      (url) => url.startsWith("redis://") || url.startsWith("rediss://"),
      "Must start with redis:// or rediss:// (TLS)",
    ),

  /* ---------- Auth ---------- */
  JWT_ACCESS_SECRET: secret(32, "JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: secret(32, "JWT_REFRESH_SECRET"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 min
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 14), // 14 d

  /* ---------- Cryptography (at-rest) ---------- */
  ENCRYPTION_KEY: secret(32, "ENCRYPTION_KEY"),

  /* ---------- Meta WhatsApp Cloud API ---------- */
  META_APP_SECRET: secret(20, "META_APP_SECRET"),
  META_VERIFY_TOKEN: secret(20, "META_VERIFY_TOKEN"),
  META_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d{2}\.0$/, "Must follow Graph API version format, e.g. v21.0")
    .default("v21.0"),

  /* ---------- Anthropic (Claude) ---------- */
  ANTHROPIC_API_KEY: z
    .string()
    .startsWith("sk-ant-", "Must start with sk-ant-")
    .min(40, "ANTHROPIC_API_KEY appears too short"),
  ANTHROPIC_MODEL_TRIAGE: z.string().default("claude-sonnet-4-6"),
  ANTHROPIC_MODEL_CLASSIFY: z.string().default("claude-haiku-4-5"),

  /* ---------- Observability ---------- */
  SENTRY_DSN: z
    .string()
    .url()
    .optional()
    .describe("Optional in dev/test; required in staging/production"),

  /* ---------- HTTP ---------- */
  CORS_ORIGINS: csvList.describe(
    "Comma-separated list of allowed origins (e.g. https://app.orion.io,https://staging.orion.io)",
  ),
  COOKIE_DOMAIN: z.string().min(1).default("localhost"),

  /* ---------- Feature flags (MVP basics) ---------- */
  FEATURE_AUTO_REPLY_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  FEATURE_AI_TRIAGE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

/* -------------------------------------------------------------------------- */
/*  Cross-field rules                                                         */
/* -------------------------------------------------------------------------- */

const EnvSchemaWithRules = EnvSchema.superRefine((env, ctx) => {
  // Production must have Sentry DSN configured
  if (env.NODE_ENV === "production" && !env.SENTRY_DSN) {
    ctx.addIssue({
      code: "custom",
      path: ["SENTRY_DSN"],
      message: "SENTRY_DSN is required when NODE_ENV is 'production'",
    });
  }

  // Production must use HTTPS origins only
  if (env.NODE_ENV === "production") {
    const insecure = env.CORS_ORIGINS.filter((o) => !o.startsWith("https://"));
    if (insecure.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGINS"],
        message: `Production CORS_ORIGINS must all use https. Offenders: ${insecure.join(", ")}`,
      });
    }
  }

  // The two JWT secrets must differ — same secret would let access tokens
  // forge refresh tokens and vice versa.
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ["JWT_REFRESH_SECRET"],
      message: "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values",
    });
  }
});

/* -------------------------------------------------------------------------- */
/*  Public type                                                               */
/* -------------------------------------------------------------------------- */

export type Env = z.infer<typeof EnvSchemaWithRules>;

/* -------------------------------------------------------------------------- */
/*  Parsing                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Parse `process.env` and return the validated, typed environment object.
 * Throws ZodError on failure — callers wrap this with `loadEnv()`.
 */
export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchemaWithRules.parse(raw);
}

/**
 * Load environment variables, validate them, and exit the process with a
 * grouped error report on failure. Call this at the top of every entry point
 * (apps/api/src/main.ts, worker bootstrap, scripts).
 */
export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchemaWithRules.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `  • ${path}: ${issue.message}`;
      })
      .join("\n");

    // We deliberately use stderr.write rather than console.error because
    // pino may not be initialised yet at this point in the bootstrap.
    process.stderr.write(
      [
        "",
        "═══════════════════════════════════════════════════════════════════════",
        "  Orion — environment validation FAILED",
        "═══════════════════════════════════════════════════════════════════════",
        "",
        "The following environment variables are missing or invalid:",
        "",
        issues,
        "",
        "Refer to .env.example at the repository root for the complete list",
        "of required variables and how to obtain each one.",
        "",
        "═══════════════════════════════════════════════════════════════════════",
        "",
      ].join("\n"),
    );

    process.exit(1);
  }

  return result.data;
}

/* -------------------------------------------------------------------------- */
/*  Lazy-initialised singleton                                                */
/* -------------------------------------------------------------------------- */

let cached: Env | null = null;

/**
 * Returns the validated environment, loading and validating it on first call.
 * Subsequent calls return the cached instance. This pattern lets tests stub
 * `process.env` *before* the env is touched.
 */
export function getEnv(): Env {
  if (cached !== null) {
    return cached;
  }
  const loaded = loadEnv();
  cached = loaded;
  return loaded;
}

/**
 * Test-only utility to reset the cache. Do NOT call from production code.
 */
export function __resetEnvForTests(): void {
  cached = null;
}
