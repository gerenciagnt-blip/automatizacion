# ADR-0001: Multi-tenant isolation via shared schema with `tenant_id` discriminator

- **Status:** Accepted
- **Date:** 2026-04-26
- **Deciders:** Cloud Architect, Security Lead
- **Related:** ADR-0004 (Latest-stable policy), `apps/api/prisma/schema.prisma`

---

## Context

Orion is a multi-tenant SaaS where each tenant operates independently and must
never see another tenant's data. Three isolation strategies exist on
PostgreSQL:

1. **Database-per-tenant** — every tenant gets a dedicated PostgreSQL database.
2. **Schema-per-tenant** — single database, one schema per tenant.
3. **Shared database / shared schema with `tenant_id` discriminator** — single
   database, single schema, every table has a `tenant_id` column scoped at
   the application layer (and optionally at the row-level via PostgreSQL RLS).

The trade-offs are operational cost, blast radius of a leak, ease of
migrations, and onboarding latency for new tenants.

The MVP target is up to ~50 tenants with mixed plan sizes. We expect the AI
layer to dominate cost (token spend), so database operational cost should be
kept lean.

## Decision

We adopt **strategy 3: shared database, shared schema, `tenant_id`
discriminator on every table except `Tenant` itself**. Logical isolation is
enforced in the application by:

1. A `tenantContext` middleware that injects `tenantId` from the validated JWT
   into the request scope.
2. A `BaseTenantRepository` that automatically appends `tenantId` to every
   `where`, `create`, and `update` clause; direct `prisma.*` access is
   forbidden by code review for tenant-owned tables.
3. Cross-tenant isolation tests in `apps/api/tests/isolation/` that create
   two tenants and assert tenant A cannot read or mutate any record of
   tenant B (one test per table that owns `tenantId`).
4. Composite indexes `(tenantId, …)` on every column queried by the
   application, so query plans naturally short-circuit on `tenantId`.

A future hardening step (Sprint 8) will turn on **PostgreSQL Row-Level
Security** with `SET LOCAL app.current_tenant = ...` per-transaction. RLS
will provide a defence-in-depth layer that protects against application
bugs in the repository layer.

## Options considered

### Option 1 — Database-per-tenant

- Pros: strongest isolation; per-tenant backup/restore is trivial; noisy
  neighbours impossible at the storage layer.
- Cons: every migration must run N times; provisioning a new tenant takes
  minutes (creates a DigitalOcean DB instance); operational cost scales
  linearly with tenant count; ORM tooling becomes brittle at N>50 DBs.
- Cost: would push MVP infra cost from ~$50/mo to ~$25/mo × N tenants.

### Option 2 — Schema-per-tenant

- Pros: stronger isolation than discriminator; one DB, easier ops; can use
  `search_path` to scope queries.
- Cons: migrations must iterate every schema; many ORMs (Prisma included)
  treat schemas as a static design-time concern, requiring custom dynamic
  routing; introspection becomes painful; prepared-statement cache pollution
  with hundreds of schemas.
- Cost: significant engineering effort to build the schema-routing layer.

### Option 3 — Shared database / shared schema with `tenant_id` (chosen)

- Pros: simplest model; one migration applies to all tenants; Prisma works
  natively; onboarding a new tenant is a single `INSERT INTO tenants`;
  composite indexes give us O(log n) tenant-scoped lookups.
- Cons: a single application bug can leak cross-tenant data; isolation
  depends on disciplined coding plus tests.
- Cost: minimal infra cost; isolation discipline is paid in code review and
  tests, not infrastructure.

## Consequences

### Positive

- Single Postgres instance for the entire MVP; minimal ops overhead.
- One migration pipeline; no per-tenant rollout needed.
- Onboarding latency: a new tenant is available the moment its `INSERT` is
  committed.
- Analytics across tenants (aggregate dashboards) is a single SQL query.

### Negative

- A bug in the repository layer can leak data. We mitigate this with the
  `BaseTenantRepository` enforcement, isolation tests on every table, and
  the planned RLS hardening.
- Backups are at-database scale; restoring a single tenant requires either
  a logical backup (`pg_dump --table … --where "tenant_id=…"`) or a future
  per-tenant export tool.

### Neutral / unknown

- If a single enterprise tenant ever requires hard physical isolation, we
  must migrate that tenant to a dedicated database. A migration runbook
  will be authored when the first such request appears (Sprint 8 hardening).

## Compliance

- **Code review checklist** (auto-applied): every PR touching repositories
  must show every query carries `tenantId`.
- **CI tests:** `tests/isolation/*.test.ts` must pass before merge.
- **Lint rule** (planned, Sprint 2): a custom Biome / TypeScript rule that
  forbids direct `prisma.<modelOwningTenantId>.*` calls outside the
  `BaseTenantRepository`.
- **Audit log:** every privileged write produces an `AuditEvent` row,
  including `tenantId` and the actor's identity.

## References

- PostgreSQL Row Level Security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Microsoft "Multi-tenant SaaS database tenancy patterns": https://learn.microsoft.com/azure/azure-sql/database/saas-tenancy-app-design-patterns
- `apps/api/prisma/schema.prisma` — every model except `Tenant` carries `tenantId` and indexes accordingly.
