# @orion/shared

Shared types, Zod schemas, environment validation, and constants used across the Orion monorepo.

## Modules

| Sub-path | Purpose |
| --- | --- |
| `@orion/shared` | Re-exports everything (barrel) |
| `@orion/shared/env` | Fail-fast environment loader with Zod 4 schema |

## Usage

### Environment validation

```ts
import { getEnv } from "@orion/shared/env";

const env = getEnv();
// env is fully typed; missing vars exit the process at startup with a
// human-readable error
console.log(env.DATABASE_URL);
```

The first call to `getEnv()` triggers parsing. If any required variable is
missing or malformed, the process exits with code `1` and a grouped error
report. This is intentional — tenet #1 of the project (security by default)
requires zero implicit defaults for credentials.

## Adding a new variable

1. Add the field to `EnvSchema` in `src/env.ts`.
2. Document it in `.env.example` at the repository root with:
   - The variable name in `UPPER_SNAKE_CASE`.
   - A comment explaining what it is and where to obtain it (link to the
     vendor portal if applicable).
   - A realistic placeholder (never `xxx`).
3. If it is a credential, ensure it is excluded from logs (see `pino.redact`
   configuration in `apps/api`).

## Conventions

- All types and identifiers are in **English**.
- Schemas live under `src/schemas/<domain>.ts` (created from Sprint 2 onwards).
- No I/O, no framework imports, no Prisma client. This package must remain
  side-effect-free except for the env loader's fail-fast behaviour.
