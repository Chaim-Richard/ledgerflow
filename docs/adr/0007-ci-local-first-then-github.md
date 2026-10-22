# 7. CI is local-first, then GitHub, and a red check is never explained away

## Status
Accepted.

## Context
The repository is built by several AI agents working in parallel with the owner. Two failure modes
showed up early: a change that looked green locally but failed in CI (different database, different
time zone, different Chromium font stack), and CI minutes and queue time wasted by every branch push
running the whole suite twice.

## Decision
- **Run the gates locally before opening a pull request** — `npm run verify` is the same list CI
  runs: `npm ci --dry-run` (lockfile in sync), `npm run lint` (types + ESLint with the warning
  cap), `npm test` (whole unit suite against the local test database), `npm run test:rules`
  (database security rules), `npm audit --audit-level=high`, and the browser spec(s) touched.
  A pull request that fails its own test is sent back without review.
- **GitHub CI is the authority, not the local run.** `.github/workflows/ci.yml` runs on a pull
  request (the PR merged with the latest `main`), and again on a push to `main`; a branch push with
  no PR does not run it (helper branches open a draft PR to get CI). Jobs: lint/typecheck/unit with
  a real Postgres (`npm run db:test-setup` applies the Supabase migrations) and the coverage gate,
  the production build (artifacts must exist), the whole unit suite again in `Pacific/Auckland` and
  `America/Los_Angeles`, browser shards, CodeQL and the SBOM.
- **Two known non-code reds, and they are named, never guessed at:**
  - the **Vercel preview** is paused by the owner to save usage — a red preview deployment is not a
    code failure;
  - **visual-regression baselines** are captured on Linux; they are refreshed with the *Refresh
    visual baselines* workflow (`gh workflow run visual-baselines.yml`), not by committing whatever
    the local Chromium produced.
- **A finding that needs a financial decision goes to the lead, not into the branch.** Problems in
  money, posting, tax maths or `src/server/` are reported (COORDINATION → Messages) instead of being
  patched by whoever found them.

## Consequences
- Two green runs (local and CI) are the normal cost of a change; the second one is the one that
  counts.
- Ratchets (ESLint warning count, coverage floors, bug-pattern counts) may only move in the safe
  direction, so quality cannot quietly drift back.
- Some things cannot be checked locally at all (visual baselines, the fork-to-upstream PR flow,
  workflow dispatch permissions); those are handed over explicitly in the PR instead of being
  claimed as verified.
