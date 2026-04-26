# ADR-0002: Adopt Node.js 24 LTS instead of Node.js 20 LTS

- **Status:** Accepted
- **Date:** 2026-04-26
- **Deciders:** Tech Lead Fullstack, DevOps / SRE
- **Related:** ADR-0004 (Latest-stable policy)

---

## Context

The original Orion system prompt (v1.0.0) names **Node.js 20 LTS** as the
runtime. That recommendation reflected the state of the Node.js release
calendar at the time of authoring.

By the time work on Orion begins (April 2026):

- **Node.js 20** is in *Maintenance LTS* and reaches **end-of-life in
  April 2026**, i.e. the same month we start coding. Continuing to ship on
  Node 20 would force a Node major upgrade within Orion's first six months
  in production.
- **Node.js 22** is *Active LTS* until April 2027.
- **Node.js 24** entered *Active LTS* in October 2025 and is supported
  until **April 2028**, comfortably covering Orion's first year of
  production operation.

Every dependency in the planned stack (Prisma 6, BullMQ 5, Express 5, Zod 4,
Pino 9, Socket.io 4, Argon2id) ships official binaries and tested support
matrices for Node 24.

## Decision

We pin the project runtime to **Node.js 24 LTS** for both development and
production.

Pin locations:

- `.nvmrc` — `24`
- `.node-version` — `24` (for `fnm` / `asdf`)
- `package.json` `engines.node` — `">=24.0.0 <25.0.0"`

`pnpm` enforces this at install time via `engines-strict`.

## Options considered

### Option A — Stay on Node 20 LTS as written in the system prompt

- Pros: literal compliance with the prompt; unchanged from the documented
  baseline.
- Cons: the runtime reaches EOL the same month we start; we would be
  shipping a known-soon-to-be-unsupported runtime to production; obligatory
  major upgrade within ~6 months.

### Option B — Adopt Node 22 LTS (mid-point)

- Pros: most conservative supported LTS; broadest community testing;
  supported until April 2027.
- Cons: still requires a runtime upgrade within Orion's first 18 months;
  forgoes the V8 / GC / permission-model improvements in Node 24.

### Option C — Adopt Node 24 LTS (chosen)

- Pros: longest support window of any current LTS (April 2028); newest V8
  with improved garbage collection and lower memory footprint; native
  fetch fully stabilised; permission model available; type-stripping for
  TypeScript without a build step is opt-in available.
- Cons: smaller body of production case studies than Node 22; some niche
  native modules may lag (mitigated by the explicit dependency audit; none
  of our planned deps lag).

### Option D — Track Node Current (non-LTS)

- Rejected. Non-LTS lines have a 6-month support window and are unsuited
  for a production SaaS.

## Consequences

### Positive

- No forced runtime major upgrade until April 2028.
- Better baseline performance and lower memory use than Node 20.
- Aligns with ADR-0004 (latest-stable policy).

### Negative

- Slightly fewer Stack Overflow / blog answers that match exactly the same
  Node line, but the gap is shrinking weekly and is negligible by Q3 2026.
- Original system prompt language about "Node 20" is now overridden — we
  treat the prompt as directional, not literal, on version pins.

### Neutral / unknown

- DigitalOcean's App Platform images and Droplets have first-class Node 24
  base images.

## Compliance

- `.nvmrc`, `.node-version`, and `package.json` engines all specify `24`.
- CI (Sprint 9) will install the exact pinned version via `actions/setup-node`
  reading `.nvmrc`.
- Local `pnpm install` emits a hard error on any other major.

## References

- Node.js release schedule: https://nodejs.org/en/about/previous-releases
- Node.js 24 release notes: https://nodejs.org/en/blog/release/v24.0.0
- Original Orion system prompt v1.0.0, §5 "Stack tecnológico"
