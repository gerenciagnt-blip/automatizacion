/**
 * Conventional Commits config — see https://www.conventionalcommits.org
 *
 *   <type>(<optional-scope>): <subject>
 *
 *     <optional body>
 *
 *     <optional footer>
 *
 * Allowed types are intentionally narrow to keep `git log` searchable.
 */

/** @type {import("@commitlint/types").UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // new feature
        "fix", // bug fix
        "docs", // documentation only
        "style", // formatting, missing semicolons, etc. — no code change
        "refactor", // code change that neither fixes a bug nor adds a feature
        "perf", // performance improvement
        "test", // adding or updating tests
        "build", // build system / external deps (npm, pnpm, docker)
        "ci", // CI configuration (GitHub Actions, etc.)
        "chore", // other changes that don't modify src or test files
        "revert", // revert a previous commit
      ],
    ],
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [1, "always", 100],
    "footer-max-line-length": [2, "always", 200],
  },
};
