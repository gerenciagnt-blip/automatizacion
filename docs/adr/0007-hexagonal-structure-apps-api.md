# ADR-0007: Hexagonal architecture inside `apps/api`

- **Status:** Accepted
- **Date:** 2026-04-26
- **Deciders:** Cloud Architect, Tech Lead Fullstack
- **Related:** ADR-0001 (Multi-tenant), system prompt §6 (Bounded contexts)

---

## Context

`apps/api` will host eight bounded contexts (Identity & Access, Tenant
Management, Messaging Gateway, Conversations & Inbox, AI Orchestration,
Routing & Workload, Analytics, Contacts & CRM). Each context must:

- Own its own data model (Prisma queries, repositories).
- Be testable in isolation, including without a real Postgres or Redis.
- Be replaceable at the adapter boundary (swap Prisma for Drizzle, swap
  BullMQ for SQS) without touching domain logic.

The system prompt (§4 tenets 4 and 5) mandates Domain-Driven Design with
hexagonal architecture and SOLID — particularly the Dependency Inversion
Principle.

## Decision

`apps/api` follows a **hexagonal (ports-and-adapters) layering** with one
folder per bounded context, plus a small set of cross-cutting `shared/` and
`middleware/` directories. Inside each context, code is split by layer:

```
apps/api/src/
├─ main.ts                          # process entry point
├─ server.ts                        # buildApp(deps) — pure, testable
├─ shared/                          # cross-cutting concerns (logger,
│  │                                # prisma client, redis client, errors,
│  │                                # trace context, AsyncLocalStorage)
│  ├─ logger.ts
│  ├─ prisma.ts
│  ├─ redis.ts
│  ├─ trace-context.ts
│  └─ errors.ts
├─ middleware/                      # Express-level cross-cutting middleware
│  ├─ trace-id.ts
│  ├─ request-logger.ts
│  ├─ error-handler.ts
│  └─ not-found.ts
└─ modules/
   └─ <context>/                    # one folder per bounded context
      ├─ <context>.routes.ts        # Express wiring (adapter — HTTP)
      ├─ <context>.controller.ts    # request → use-case orchestration
      ├─ application/               # use cases (application services)
      │  └─ <use-case>.ts
      ├─ domain/                    # entities, value objects, ports (interfaces)
      │  ├─ <aggregate>.ts
      │  └─ <repository>.port.ts
      └─ infrastructure/            # adapters that implement the ports
         └─ <repository>.prisma.ts
```

### Layering rules

1. **`domain/`** has zero imports from `@prisma/client`, `express`,
   `ioredis`, or `pino`. Only standard TypeScript and `@orion/shared`.
2. **`application/`** depends only on `domain/` (and may import
   `@orion/shared`). It receives ports as constructor / factory params.
3. **`infrastructure/`** implements the ports and is the only place that
   imports the technology adapters (Prisma, ioredis, Anthropic SDK, etc.).
4. **`controllers` and `routes`** wire HTTP requests into the application
   layer. They never call repositories or external services directly.
5. **`shared/`** contains framework-aware utilities used by middleware
   and controllers, but is forbidden from being imported by `domain/`.

### Dependency injection

`buildApp(deps)` takes its dependencies as a single `AppDeps` object so:

- Tests construct a fully-mocked app per case.
- Production assembles the singletons in `main.ts` and passes them down.

Inside modules, controllers receive their dependencies via factory
functions (`buildHealthController(deps)`) — the same pattern scaling to
all future modules.

### Naming conventions

- Files use `kebab-case.ts`.
- Test files mirror their target with the suffix `.test.ts` and live in
  the same folder OR under `tests/integration/<context>/` for cross-layer
  scenarios.
- Ports are suffixed `.port.ts`; adapters are suffixed by technology
  (e.g. `*.prisma.ts`, `*.bullmq.ts`).

## Options considered

### Option A — Flat layout (controllers + services + repositories at top)

- Pros: lowest ceremony.
- Cons: at eight contexts and ~80 future files, names start colliding;
  enforcing layer boundaries by code review becomes brittle; reorganising
  later is expensive.
- Rejected.

### Option B — One package per context (sub-packages of `apps/api`)

- Pros: hardest layering boundary, since pnpm refuses unintended imports.
- Cons: heavy on tooling (each sub-package needs its own tsconfig,
  package.json, build pipeline); 8× the boilerplate for an MVP team of 1.
- Deferred — re-evaluate if the project grows past 5 engineers.

### Option C — Hexagonal folders inside one package (chosen)

- Pros: enforces the architecture by convention; no tooling overhead;
  one tsconfig, one Vitest setup, one build artefact; refactor toward
  Option B becomes mechanical if needed later.
- Cons: layering rules rely on code review discipline (no compiler-level
  enforcement). Mitigated by a Biome rule planned for Sprint 4 that bans
  forbidden imports between layer boundaries.

## Consequences

### Positive

- Domain logic is unit-testable without Postgres / Redis / Anthropic.
- Adapter swaps (e.g. Prisma → Drizzle) are isolated to
  `<context>/infrastructure/` files.
- Each bounded context is self-contained — onboarding a new engineer
  to one module does not require understanding the other seven.

### Negative

- More files per feature than a flat layout would produce. Worth it for
  the testability and isolation.

### Neutral / unknown

- A Biome custom rule (or alternative: `eslint-plugin-boundaries` if we
  ever fall back to ESLint) will enforce the layer rules in CI. Tracked
  for Sprint 4.

## Compliance

- Sprint 2 lands the skeleton and the `health` module as the canonical
  example. Subsequent sprints inherit the layout.
- Code review checklist gains: "does this PR import infrastructure
  packages from `domain/`? If yes, reject."
- Future Biome rule (Sprint 4) automates the above check.

## References

- Alistair Cockburn, "Hexagonal architecture" (2005).
- Eric Evans, *Domain-Driven Design*.
- Vaughn Vernon, *Implementing Domain-Driven Design*.
- Original Orion system prompt v1.0.0, §4 tenets 4–5, §6 bounded contexts.
