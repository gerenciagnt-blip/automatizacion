# ADR-0003: Biome as the single linter and formatter

- **Status:** Accepted
- **Date:** 2026-04-26
- **Deciders:** Tech Lead Fullstack
- **Related:** ADR-0004 (Latest-stable policy)

---

## Context

The Orion monorepo needs a consistent linting and formatting solution that:

- Runs fast enough to be invoked from a `pre-commit` hook on every commit
  without becoming an annoyance.
- Provides consistent rules across `apps/api` (Node), `apps/web` (React)
  and `packages/shared` (pure TS).
- Has a single source of truth so contributors do not have to reconcile
  ESLint and Prettier disagreements.

Two industry options dominate today:

1. **ESLint + Prettier** — long-standing standard. Two binaries, two
   configs, additional plugins (`eslint-config-prettier`,
   `eslint-plugin-prettier`) to make them play together.
2. **Biome** — single binary written in Rust. Linter + formatter in one,
   one config file, ~10–25× faster than ESLint+Prettier on equivalent
   workloads.

## Decision

We adopt **Biome** (latest stable, currently 2.x line) as the sole linter
and formatter for all TypeScript / JavaScript / JSON code in the monorepo.
Configuration lives in a single `biome.json` at the repository root, with
package-level overrides where needed.

Pre-commit hook (Husky + lint-staged) runs `biome check --apply` only on
staged files, keeping the local feedback loop under one second.

## Options considered

### Option A — ESLint + Prettier (status quo for the JS ecosystem)

- Pros: mature plugin ecosystem covering edge cases (e.g. `eslint-plugin-rxjs`,
  framework-specific lints not yet in Biome); largest body of community
  documentation.
- Cons: two binaries, two configs; the canonical "make them coexist" recipe
  requires `eslint-config-prettier` + `eslint-plugin-prettier` and is a
  recurring source of confusion; on a monorepo of Orion's expected size,
  full-tree lint takes 15–30 s. That cost lands on every git hook.
- Cost: ~1–2 hours of upfront config; ~10–20 s per pre-commit hook
  invocation.

### Option B — Biome (chosen)

- Pros: a single binary; one configuration; sub-second runs on Orion-sized
  monorepos thanks to the Rust core; covers ~95% of the rules we would
  configure in ESLint; native support for `import` sorting, unused-vars
  detection, `noExplicitAny`, etc.
- Cons: smaller plugin ecosystem (no equivalent yet for some niche ESLint
  plugins); the project is younger (launched 2023) and major versions can
  introduce breaking config changes — mitigated by the latest-stable
  policy and by the fact that all our needs are core rules.
- Cost: ~30 minutes to author `biome.json`; near-zero per-commit cost.

## Consequences

### Positive

- Faster developer feedback loop; pre-commit hooks remain pleasant.
- One file (`biome.json`) governs both lint and format — no
  ESLint/Prettier tug-of-war.
- One dependency to update and audit.

### Negative

- If we ever need a rule Biome does not yet support, we must either:
  (a) wait for Biome to add it, (b) author a custom rule, or (c) bolt
  ESLint on for that single concern. The escape hatch is real but rare.
- Tooling integrations (CI annotations, IDE plugins) are slightly less
  mature than the ESLint counterparts. VSCode, JetBrains, Neovim and
  Helix all have official extensions, so the practical impact is small.

### Neutral / unknown

- Biome's roadmap includes broader framework support (Vue, Svelte). Not
  relevant to Orion (React-only).

## Compliance

- `biome.json` is the only lint/format config in the repository.
- CI (Sprint 9) runs `pnpm exec biome ci .` and fails the build on
  diagnostics.
- Husky pre-commit invokes `lint-staged`, which calls
  `biome check --apply` on staged TS/JSON/JS files.
- ESLint and Prettier dependencies are explicitly **forbidden** from
  `package.json` files unless re-introduced by superseding ADR.

## References

- Biome documentation: https://biomejs.dev
- Biome benchmarks vs ESLint+Prettier: https://biomejs.dev/blog/biome-v2/
- Original Orion system prompt v1.0.0, §5 "Lint/Format"
