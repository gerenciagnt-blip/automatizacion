# Architecture Decision Records

This directory captures every architecturally significant decision made in
the Orion project. Each ADR is **immutable** once accepted; instead of
editing one, we author a successor ADR that **supersedes** it.

## Format

ADRs follow the [MADR](https://adr.github.io/madr/) flavour with the
fields shown in [`0000-template.md`](./0000-template.md). When in doubt,
copy the template and fill it in.

## Filename convention

`NNNN-kebab-title.md`, where `NNNN` is a zero-padded sequential number.
The number is reserved when the PR opens, so two parallel PRs never
collide on the same index.

## Index

| #   | Title | Status |
| --- | ----- | ------ |
| [0000](./0000-template.md) | Template | Reference only |
| [0001](./0001-multi-tenant-isolation-strategy.md) | Multi-tenant isolation via shared schema with `tenant_id` | Accepted |
| [0002](./0002-node-24-over-node-20.md) | Adopt Node.js 24 LTS instead of Node.js 20 LTS | Accepted |
| [0003](./0003-biome-over-eslint-prettier.md) | Biome as the single linter and formatter | Accepted |
| [0004](./0004-latest-stable-versioning-policy.md) | Default to the latest stable release of every dependency | Accepted |
| [0005](./0005-claude-sonnet-46-default-model.md) | Claude Sonnet 4.6 default, Haiku 4.5 reserved for optimisation | Accepted |
| [0006](./0006-extensibility-via-outbound-webhooks-not-n8n.md) | Tenant-side extensibility via outbound webhooks + public API, not embedded n8n | Accepted |
| [0007](./0007-hexagonal-structure-apps-api.md) | Hexagonal architecture inside `apps/api` | Accepted |

## When to write an ADR

Open a new ADR when the decision:

- Affects more than one bounded context.
- Locks in a vendor, runtime, framework, or protocol.
- Trades off between two or more credible alternatives.
- Will be hard or expensive to reverse.
- Concerns security, privacy, or compliance posture.

Bug fixes, library upgrades that follow the latest-stable policy
(ADR-0004), and refactors confined to one module do **not** require an
ADR — a clear commit message and a code review are enough.

## Review

ADRs are reviewed by at least two roles from the engineering squad
(Cloud Architect + the role most affected by the decision). Approval is
recorded in the PR that introduces the ADR.
