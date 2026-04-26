# ADR-0005: Claude Sonnet 4.6 as the default LLM, Haiku 4.5 reserved for cost optimisation

- **Status:** Accepted
- **Date:** 2026-04-26
- **Deciders:** Product Engineer, Tech Lead Fullstack
- **Related:** ADR-0004 (Latest-stable policy)

---

## Context

Sprint 5 introduces the AI orchestration layer: every inbound WhatsApp
message can be sent to Claude for triage, intent classification, lead
scoring, and (optionally) auto-reply. The cost of a SaaS like Orion at
scale is dominated by LLM token spend, so model choice is a first-class
architectural decision.

Anthropic publishes three model families:

| Family | Strength | Pricing (April 2026, USD per 1M tokens) |
| --- | --- | --- |
| Claude Opus 4.x | Highest reasoning quality | $15 input / $75 output |
| Claude Sonnet 4.6 | Balanced quality / cost | $3 input / $15 output |
| Claude Haiku 4.5 | Fast, low-cost | $1 input / $5 output |

Each tenant's `BotConfig` declares a model identifier per behaviour, so
the default we pick now is overrideable per tenant once we learn what the
real workload looks like.

## Decision

We adopt this two-tier model strategy:

1. **Default model: Claude Sonnet 4.6.** All triage, intent extraction,
   lead scoring, response generation, and auto-reply (when enabled) run on
   Sonnet 4.6 from Sprint 5 through MVP launch.
2. **Reserved for optimisation: Claude Haiku 4.5.** From Sprint 8 onwards,
   once we have real production traffic, we begin migrating individual
   sub-tasks (binary classifications, language detection, simple tag
   extraction) from Sonnet 4.6 to Haiku 4.5 and measure the quality
   delta on a labelled sample. Migrations that hold quality at parity
   land as code changes; those that lose quality stay on Sonnet.
3. **Opus is not adopted in MVP.** It costs 5× Sonnet without a
   demonstrated need at the scale of typical WhatsApp customer-service
   conversations. Re-evaluation deferred to post-MVP.

Configuration:

- `.env.example` exposes `ANTHROPIC_MODEL_TRIAGE` (default `claude-sonnet-4-6`)
  and `ANTHROPIC_MODEL_CLASSIFY` (default `claude-haiku-4-5`).
- The Zod-validated `env` object types these as plain strings to allow
  forward-compatibility with new model identifiers without a code change.
- `BotConfig.model` overrides the env default per tenant.

## Options considered

### Option A — Sonnet 4.6 for everything (chosen for MVP)

- Pros: single integration, single quality bar, single failure mode;
  least engineering complexity until real traffic justifies splitting.
- Cons: pays Sonnet pricing for tasks that Haiku could solve; this is a
  conscious trade-off, deliberately reversed in Sprint 8.

### Option B — Haiku 4.5 for everything

- Pros: cheapest possible bill of materials.
- Cons: triage, lead scoring, and reply generation noticeably degrade in
  quality when forced onto Haiku; degradation is hardest to detect on
  the borderline cases that matter most for B2B customer service.

### Option C — Pre-emptive multi-model architecture from day one

- Pros: closer to a long-term-optimal cost curve.
- Cons: premature optimisation; without production traffic we cannot
  decide which sub-tasks safely migrate to Haiku; doubles the integration
  surface (two SDKs, two prompts, two telemetry pipelines) before there
  is a measured benefit.

### Option D — Opus 4.x for everything

- Rejected. 5× cost of Sonnet without an MVP-justifying delta in
  reasoning quality for customer-support workloads.

## Consequences

### Positive

- Single, simple integration in Sprint 5.
- Token-spend telemetry per tenant gives us a clean baseline before we
  begin the Sonnet → Haiku migration.
- Per-tenant override path already in `BotConfig`.

### Negative

- Higher token bill during MVP than a pre-optimised architecture would
  produce. Bounded by `BotConfig.monthlyTokenBudget` (per-tenant cap)
  introduced in the data model from day one.

### Neutral / unknown

- Model identifiers update over time. The latest-stable policy
  (ADR-0004) governs upgrades to newer Claude releases. New Sonnet /
  Haiku versions land via env var override (no code change required).

## Compliance

- Every Claude call routes through a single `ClaudeClient` adapter
  defined in Sprint 5. The adapter:
  - Reads the model identifier from `BotConfig` first, then the env
    default.
  - Records `tokens.input`, `tokens.output`, `tokens.total`, `latencyMs`,
    `model`, and `tenantId` in an `AIDecision` record (introduced
    Sprint 5).
  - Refuses to send if the tenant's `monthlyTokenBudget` is exhausted.
- A Grafana panel (Sprint 8) tracks p95 latency, tokens per tenant per
  day, and dollar spend per tenant per day.
- The Sprint 8 model-migration exercise produces a downstream ADR
  ("ADR-XXXX: Sonnet → Haiku migration matrix") naming each sub-task
  whose model was changed.

## References

- Anthropic model pricing: https://www.anthropic.com/pricing
- `apps/api/src/modules/ai/` (created Sprint 5)
- `BotConfig.model` in `apps/api/prisma/schema.prisma`
