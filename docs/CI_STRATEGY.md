# LedgerFlow CI strategy

The canonical workflow is [CI](../.github/workflows/ci.yml). CI is triggered for pull requests, pushes to `main`, and manual dispatch. The CI workflow must not substitute a hosting provider's green deployment status for successful validation.

## Required merge gates

In GitHub **Settings → Branches / Rules → Create ruleset** for `main`, require pull requests and these exact successful job names:

- `Lint, Typecheck, and Test`
- `Production build`
- `Unit tests in Pacific/Auckland`
- `Unit tests in America/Los_Angeles`
- `Playwright E2E Smoke Suite`

Also prevent bypass by automated contributors and require branches to be up to date before merging, if the repository settings allow it. Branch protection is an owner setting and is **not** changed by this PR. Until it is enabled, a red GitHub Actions run may coexist with a merged commit.

## What each gate demonstrates

- Validation: lockfile consistency, TypeScript, ESLint, database migration application on clean PostgreSQL, row-level access rules, accounting/security unit suite with coverage thresholds, dependency audit.
- Production build: the Vite client and bundled Express entrypoint can be built and produced as nonempty artifacts.
- Time zone jobs: the unit suite passes under both a far-ahead and far-behind local time zone.
- Playwright: UI workflows and visual comparisons on Linux Chromium against seeded guest data. These run on the dev server and **do not** establish that a Vercel deployment or live Supabase migration works.

Do not interpret green as a certification of all monetary or data-integrity behavior. Some routes and product features require additional integration and release tests.

## Visual changes

When CI reports screenshot mismatches, download `playwright-failure-diagnostics` from the failed E2E job. Determine whether it is a real layout defect or an intentional change. Fix defects, **or** manually run **Refresh visual baselines** with an appropriate screen filter. That workflow produces `candidate-visual-baselines` as an artifact; it does not push to `main`. Review candidate images, commit only approved new screenshots to a regular PR, and require CI again. Do not simply increase pixel thresholds or mark the visual job as `continue-on-error`.

## Further release checks to add

1. Against a staging deployment, verify the production bundle starts, account access controls, server endpoints and document persistence.
2. Check migration history against staging/production using a read-only deployment check; do not use the clean-database test to assume production has applied a migration.
3. Add dedicated payment replay, multi-workspace isolation, document posting and period-close invariants against PostgreSQL.
4. Remove conditional `if (visible)` browser assertions in feature-critical flows and introduce stable screen selectors. The current lifecycle suite still has legacy navigation coverage requiring follow-up.
5. Ratchet **actual** ESLint warning counts and coverage thresholds based on observed CI results. `quality-baseline.json`'s `eslintWarnings` metric currently counts suppressions, not ESLint diagnostics.
