# ADR-0006: Tenant-side extensibility via outbound webhooks + public API, not embedded n8n

- **Status:** Accepted
- **Date:** 2026-04-26
- **Deciders:** Project owner (Jhon Sepulveda), Tech Lead Fullstack, Product Engineer
- **Related:** ADR-0001 (Multi-tenant), planned modules in `apps/api/src/modules/`

---

## Context

During onboarding the project owner asked whether **n8n** — the open-source
visual workflow automation tool — should be the engine that powers Orion's
conversational logic and per-tenant flows. Four candidate roles for n8n
were considered:

1. As the runtime that processes inbound WhatsApp webhooks (replaces
   BullMQ + workers).
2. As the per-tenant flow editor where each tenant designs how their bot
   responds.
3. As an internal automation tool for the Orion ops team (Slack alerts,
   reports, CRM sync).
4. As an opt-in integration target that tenants can wire into Orion via
   webhooks.

Each role has very different latency, UX, multi-tenancy, and operational
implications.

## Decision

For the MVP and the foreseeable post-MVP roadmap, Orion will:

1. **Not** use n8n as the runtime that processes inbound traffic. The
   webhook-to-inbox path stays on the BullMQ + worker architecture
   defined by the system prompt and ADR-0001.
2. **Not** ship an embedded visual flow editor for tenants in the MVP.
   Tenants configure their bot through a focused, opinionated UI inside
   the Orion inbox: system prompt, catalog, FAQs, business hours,
   routing rules, handoff thresholds. This UI lives in `apps/web` and
   targets non-technical SMB operators.
3. **Not** require n8n for internal Orion ops in the MVP. Operational
   automations (token-budget alerts, daily KPIs, billing reminders) will
   be implemented as scheduled Node scripts or GitHub Actions until the
   ops team has scale that justifies a dedicated workflow tool.
4. **Yes** expose **outbound webhooks** and a **public REST API** so
   tenants can connect Orion to their own n8n / Make / Zapier / custom
   backend. This work is scheduled for Sprint 8 (Hardening) and Sprint 9
   (Public API documentation).

The outbound webhook design (to be detailed in a downstream ADR before
Sprint 8) will follow the patterns popularised by Stripe, Shopify, and
HubSpot:

- HMAC-signed payloads with a per-tenant secret.
- Versioned event schemas (`message.created.v1`, `conversation.handoff.v1`,
  `lead.score_updated.v1`, etc.).
- At-least-once delivery with exponential backoff and a dead-letter view
  in the tenant settings UI.
- Idempotency keys on every event so tenants can deduplicate safely.

## Options considered

### Option A — n8n as the runtime engine (replaces BullMQ + workers)

- Pros: visual debugging; large library of pre-built integrations.
- Cons: typical n8n flow latency is 1–5 seconds; Meta's webhook ACK
  budget is < 5 seconds and our internal SLO is < 200 ms before the
  ACK; n8n's idempotency story is manual; n8n's multi-tenancy is an
  Enterprise-only feature; coupling our core path to n8n's release
  cadence is a major risk.
- Rejected — wrong tool for the latency profile of WhatsApp webhooks.

### Option B — n8n as the per-tenant flow editor

- Pros: tenants can build arbitrary flows without dev support.
- Cons: target tenants are non-technical SMBs in Latin America; a node
  canvas does not match their mental model; visual flowcharts are not
  the right abstraction for LLM-driven conversations (Claude with a
  rich system prompt + tool use produces better outcomes than rigid
  if/else trees); embedding n8n as a white-label experience requires
  an Enterprise licence.
- Rejected — wrong UX for the target market; wrong abstraction for the
  conversational AI strategy.

### Option C — n8n as an internal Orion ops tool

- Pros: visual debugging for ops automations.
- Cons: deferring this is cheap; ops automations can be Node scripts +
  cron + Slack webhooks until they earn the right to a dedicated tool.
- Deferred — re-evaluate post-MVP if ops volume justifies it.

### Option D — Outbound webhooks + public API (chosen)

- Pros: matches industry standards (Stripe / Shopify / HubSpot pattern);
  positions Orion as a platform, not just a closed product; lets each
  tenant pick their own automation tool (n8n, Make, Zapier, custom);
  zero ongoing maintenance burden compared to embedding n8n; aligns
  with ADR-0004 (latest-stable policy) by keeping the dependency
  surface narrow.
- Cons: requires us to design and maintain the event schema and
  signing infrastructure; tenants who want full no-code automation
  must bring their own tooling — but that is a feature, not a bug,
  because each tenant already has tool preferences.
- Chosen.

## Consequences

### Positive

- Orion becomes a **composable platform**: tenants on Make, Zapier,
  n8n, or custom code can all integrate without us picking a winner.
- Smaller and simpler core. No n8n in the runtime, no embedded
  workflow editor to maintain.
- The conversational AI strategy stays intact: Claude with a rich
  `BotConfig` decides what to do, not a brittle decision tree.

### Negative

- Tenants who explicitly want a visual flow editor in Orion will not
  get one in MVP. We accept this trade-off because the Sprint 6 UI
  (system prompt + catalog + FAQs + simple routing rules) covers
  > 90% of expected use cases, and the outbound-webhook escape hatch
  covers the rest.
- We carry the responsibility for backwards-compatible event schemas.
  Mitigated by versioning every event from day one.

### Neutral / unknown

- If a future Enterprise tenant negotiates a contract requiring an
  embedded visual editor, we revisit this decision via a superseding
  ADR. n8n embedded mode (white-label) is an option to evaluate at
  that point.

## Compliance

- The `apps/api/src/modules/automation/` module that ships outbound
  webhooks (Sprint 8) will follow the security checklist of section 10
  of the system prompt: HMAC signing, rate limiting per tenant, audit
  trail of every send.
- The public REST API (Sprint 9) will be documented with OpenAPI 3.1
  and rate-limited per tenant via the same Redis-backed limiter used
  for the rest of the surface.
- No n8n binary or container is provisioned in `ops/docker/` for the
  MVP. If introduced later, it must come with its own ADR.

## References

- Stripe webhooks: https://docs.stripe.com/webhooks
- Shopify webhooks: https://shopify.dev/docs/apps/webhooks
- HubSpot webhooks: https://developers.hubspot.com/docs/api/webhooks
- n8n architecture: https://docs.n8n.io/hosting/architecture/
- Original Orion system prompt v1.0.0, §6 (Bounded contexts) — automation
  surface lives inside "Messaging Gateway" and a future "Automation"
  context.
