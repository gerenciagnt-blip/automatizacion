# ADR-0004: Default to the latest stable release of every dependency

- **Status:** Accepted
- **Date:** 2026-04-26
- **Deciders:** Project owner (Jhon Sepulveda), Tech Lead Fullstack
- **Related:** ADR-0002 (Node 24), ADR-0003 (Biome)

---

## Context

The Orion system prompt was authored at a point in time and names specific
versions for many components (Node 20 LTS, Postgres 16, Redis 7, etc.).
Several of those versions have already been superseded by newer stable
releases by the time implementation begins.

The project owner stated explicitly during onboarding:

> "Vamos a trabajar con la última tecnología, para que no tengamos que
> actualizar versiones."

The intent is to minimise forced upgrade cycles during the first 18–24
months in production by starting on the freshest stable release of every
dependency.

## Decision

For every dependency introduced into Orion (runtime, language, framework,
library, container image, CLI tool), we default to the **latest stable
release** at the moment of introduction.

Concretely:

- **Allowed channels:** `stable`, `latest`, official LTS lines.
- **Forbidden channels:** `beta`, `rc`, `canary`, `next`, `nightly`,
  unreleased main branches, forks not endorsed by upstream.
- **Pinning:** every dependency is pinned to an exact version in the
  package's manifest (`package.json` for Node, image tags for Docker,
  etc.). Caret / tilde ranges are forbidden.
- **Verification at install time:** before adopting a new dependency, we
  consult the upstream channel (`npm view <pkg> version`, official
  release page, or vendor changelog) and pin the exact version returned.
- **Deviation:** any pivot away from "latest stable" requires its own
  ADR, citing the concrete reason (CVE, regression, breaking incompatibility
  with another pinned dependency, etc.).

The Orion system prompt is treated as a **directional contract**. Specific
version numbers within it are guidance that this ADR overrides.

## Options considered

### Option A — Track the system prompt verbatim

- Pros: literal compliance with the original document.
- Cons: ships a stack that is already partially stale on day one;
  guarantees a forced upgrade cycle within the first year.
- Rejected because it directly contradicts the project owner's stated
  goal.

### Option B — Conservative pinning (latest LTS minus one)

- Pros: maximal community testing for the chosen version.
- Cons: still trails the freshest LTS; same forced-upgrade concern just
  delayed by one major.

### Option C — Bleeding edge (any non-stable channel)

- Pros: access to upcoming features.
- Cons: instability; unfit for production SaaS; rejected.

### Option D — Latest stable (chosen)

- Pros: longest support window per upgrade; aligned with project owner's
  stated direction; one ADR covers the policy for all dependencies; new
  contributors do not have to memorise per-component version preferences.
- Cons: occasional incompatibilities between newest releases of
  interacting libraries (mitigated by deferring adoption of any package
  that is less than two weeks old, allowing the ecosystem to integrate).

## Consequences

### Positive

- Each dependency carries the longest possible runway.
- The project owner's directive becomes a written, auditable rule.
- Reduces the number of decisions per dependency; the question "which
  version?" has a default answer.

### Negative

- Slightly higher risk of running into recently introduced bugs
  upstream. Mitigated by: (a) reading the changelog before bumping,
  (b) keeping a quarantine window of two weeks for brand-new releases,
  (c) running the regression test suite immediately after every bump.

### Neutral / unknown

- The "latest stable" target moves over time. The CI pipeline (Sprint 9)
  will include a weekly Dependabot run that proposes upgrades; humans
  review and merge after tests pass. The policy applies prospectively, not
  retroactively — we do not aggressively chase upgrades day-of release.

## Compliance

- Every PR introducing or updating a dependency includes the upstream
  release page link in the description.
- Dependabot (Sprint 9) emits weekly upgrade PRs; merge gated by green CI.
- ADR-0002 and ADR-0003 are direct downstream consequences of this policy.
- Any deviation requires a superseding ADR.

## References

- Original Orion system prompt v1.0.0
- npm semver: https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies
- Renovate / Dependabot best practices for pinned dependencies.
