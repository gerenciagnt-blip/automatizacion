# Orion

> **Multi-tenant conversational CRM platform for WhatsApp Cloud API.**
> AI-native, omnichannel-ready, built for B2B SaaS.

[![Status](https://img.shields.io/badge/status-Sprint%200-blue)]()
[![Node](https://img.shields.io/badge/node-24%20LTS-green)]()
[![pnpm](https://img.shields.io/badge/pnpm-10.x-orange)]()
[![License](https://img.shields.io/badge/license-Proprietary-red)]()

---

## What is Orion?

Orion is a SaaS B2B platform where each tenant (client company) can:

1. Connect their own **WhatsApp Business Cloud API** number (Meta).
2. Manage a team of human operators with balanced workload (Admin / Manager / Agent).
3. Delegate first-line triage, intent classification, and lead scoring to an **AI agent (Claude)**.
4. Receive a smooth bot → human handoff with preserved context.
5. Measure conversion, response times, attention quality, and ROI from an analytical dashboard.

**The differentiator:** the AI is not a decorative chatbot — it's a commercial strategist that understands each tenant's business through their `BotConfig`, catalog, conversation history, and KPIs.

---

## Project status

| Sprint | Description | Status |
| ------ | ----------- | ------ |
| **S0** | Preflight — toolchain check, monorepo skeleton | 🟡 In progress |
| S1 | Foundations — README, schema.prisma, folder structure, typed env | ⏳ Pending |
| S2 | Backend core — Express, Zod env, Prisma, health checks, logger | ⏳ Pending |
| S3 | Webhooks + BullMQ — Meta webhook, HMAC, idempotency | ⏳ Pending |
| S4 | Identity & multi-tenant — auth, JWT, RBAC, invites | ⏳ Pending |
| S5 | AI Orchestration — Claude integration, BotConfig, triage | ⏳ Pending |
| S6 | Frontend Inbox — login, conversation list, send messages | ⏳ Pending |
| S7 | Real-time — Socket.io with Redis adapter | ⏳ Pending |
| S8 | Hardening — rate limiting, Sentry, metrics, audit log | ⏳ Pending |
| S9 | Deploy — Docker, CI/CD, staging | ⏳ Pending |

---

## Quick start (Sprint 0)

```bash
# Clone
git clone https://github.com/gerenciagnt-blip/automatizacion.git orion
cd orion

# Install dependencies (no app code yet — verifies monorepo wiring)
pnpm install

# Verify
node --version   # Must be v24.x
pnpm --version   # Must be >= 10.0.0
docker --version # Required from Sprint 2
```

> The full architecture, environment variables, and bootable services arrive in **Sprint 1** (Foundations).

---

## Tech stack (planned)

**Backend** — Node 24 LTS + TypeScript 5 strict · Express + Helmet · Prisma + PostgreSQL 16 · Redis 7 · BullMQ · Zod · Pino · Argon2id · JWT
**Frontend** — React 18 + Vite + TypeScript · Zustand · TanStack Query · Tailwind + shadcn/ui · React Hook Form · socket.io-client
**Tooling** — pnpm workspaces + Turborepo · Biome · Husky + lint-staged + commitlint · Vitest + Supertest + Testcontainers · Playwright
**Infra** — Docker · GitHub Actions · DigitalOcean (Droplet + Managed Postgres + Managed Redis) · Vercel (frontend) · Sentry · Grafana

> Each technology choice will be documented in `docs/adr/` (Architecture Decision Records) as it gets adopted.

---

## Repository layout (target — populated across Sprint 1)

```
orion/
├─ apps/
│  ├─ api/              # Express backend (S2+)
│  └─ web/              # React frontend (S6+)
├─ packages/
│  └─ shared/           # Types, Zod schemas, env validation
├─ docs/
│  ├─ adr/              # Architecture Decision Records
│  └─ flows/            # Mermaid diagrams per critical flow
├─ ops/
│  ├─ docker/           # Dockerfiles + docker-compose
│  └─ grafana/          # Dashboards
├─ .github/
│  └─ workflows/        # CI/CD
└─ [root config files]
```

---

## Working agreement

This project follows a strict engineering protocol documented in the system prompt:

- **Conventional Commits** in English (e.g. `feat(inbox): add typing indicator`).
- **Trunk-based development** — short feature branches, PRs reviewable in < 15 min.
- **Tests are mandatory** — no PR merges without unit + integration coverage where it applies.
- **Multi-tenant isolation** — every query carries `tenant_id`. No exceptions.
- **Security by default** — every external input validated with Zod; webhooks verified with HMAC.
- **Sprint checkpoints** — at the end of each sprint, work pauses for explicit human authorization before proceeding.

---

## License

Proprietary — all rights reserved. © 2026 Jhon Alexander Sepulveda.
