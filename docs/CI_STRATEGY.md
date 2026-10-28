# LedgerFlow CI strategy

The canonical workflow is [CI](../.github/workflows/ci.yml). CI is triggered for pull requests, pushes to `main`, and manual dispatch. The CI workflow must not substitute a hosting provider's green deployment status for successful validation.

## Required merge gates

In GitHub **Settings → Branches / Rules → Create ruleset** for `main`, require pull requests and these exact successful job names:

- `Lint, Typecheck, and Database rules`
- `Accounting & Security Test Suites (coverage gate)` (passes only when all four `Unit tests n/4` parts passed and their merged coverage meets the thresholds)
- `Production build`
- `Unit tests in Pacific/Auckland (1/3)`, `(2/3)`, `(3/3)`
- `Unit tests in America/Los_Angeles (1/3)`, `(2/3)`, `(3/3)`
- `Playwright E2E Smoke Suite` (passes only when all four browser shards passed)

Also prevent bypass by automated contributors and require branches to be up to date before merging, if the repository settings allow it. Branch protection is an owner setting and is **not** changed by this PR. Until it is enabled, a red GitHub Actions run may coexist with a merged commit.

## Why the suite runs in parts (22 Oct)

The strategy audit of 22 Oct (`audit/STRATEGY_AND_SPEED_AUDIT_2026-10-22.md`) measured the gate at **16.2 min**, of which
**14.0 min** was one step: the unit suite with coverage, run whole on one machine; the browser shards were 12.2 and 8.8 min.
Since 22 Oct:

- the unit suite runs as **four parts** (`node --test --test-shard=n/4`, `npm run test:shard:cov`), each writing its
  coverage as lcov; `scripts/coverage-merge.mjs` merges them (covered in any part = covered) and applies the same
  thresholds as `test:cov`, counting lines as Node does (checked: one run and the merged parts give the same
  percentages). Measured 22 Oct on the full suite (3,889 tests, the same in one run and in the four parts): one run
  81.66% lines / 79.19% branches / 82.60% functions; four parts merged 81.70 / **77.32** / 82.60. Branches come out
  about 2 points *lower* when merged (a block a part never entered is listed only where it was, and Node numbers
  blocks per run, so the merge matches them by line), so the gate is slightly stricter than one run, never laxer.
  `scripts/coverage-merge.test.mjs` keeps the two sets of thresholds equal;
- each time zone runs in **three parts** (two until 26 Oct, when one part alone took 8 min and set the wait);
- the browser tests run in **five shards** (two before 22 Oct; four, then five on 24 Oct when shard 1 alone took 9 min against 5–6 for the others: Playwright splits by test count, not time). Playwright stays at `workers: 1` inside a shard: the tests
  in a shard share one dev server and one database, so more workers there would be a real isolation change, not a
  speed-up for free.

Locally nothing changes: `npm test` and `npm run test:cov` still run the whole suite.

## What each gate demonstrates

- Validation: lockfile consistency, TypeScript, ESLint, database migration application on clean PostgreSQL, row-level access rules, dependency audit. The unit suite and its coverage thresholds are the coverage-gate check above.
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
5. Ratchet coverage thresholds based on observed CI results. (The suppression metric was renamed `suppressionCount` on 22 Oct; the actual ESLint warning count is the `--max-warnings` ceiling below.)

## Automatic, downward-only ESLint warning ceiling

The existing package.json `lint:eslint` command remains `eslint . --max-warnings 212`. This is a historical quality ratchet, not an arbitrary tolerance. Never increase the budget to pass CI.

- Run `node scripts/eslint-warning-ratchet.mjs` to measure **actual ESLint diagnostics** and report possible improvement; it fails on regressions.
- Run `node scripts/eslint-warning-ratchet.mjs --update` to lower `package.json`'s maximum to the current actual warning count. It never raises the maximum.
- The `ESLint warning ratchet` workflow runs after **successful CI on main** (or manually from main) and proposes an improvement as a PR; protected main is never changed automatically. The workflow dispatches normal CI for the bot-created PR.
- GitHub **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests** must be enabled to let the workflow open PRs using `GITHUB_TOKEN`. If unavailable, use the update script locally and open an ordinary PR.
- `quality-baseline.json`'s `suppressionCount` field (called `eslintWarnings` before 22 Oct) counts lint/TS suppression directives; it is separate from the **actual ESLint warnings** measured here. Do not conflate those values.
