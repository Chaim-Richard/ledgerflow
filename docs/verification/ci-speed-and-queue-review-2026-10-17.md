# AI #2: faster CI and queue reconciliation — 17 October 2026

Branch `codex/ci-faster-browser-feedback`, based on main `52613232`.

## CI change

The serial browser job is split into two native Playwright shards, with independent runners/Postgres and one browser worker each. The original required `Playwright E2E Smoke Suite` check remains as a rollup: failed, cancelled or skipped shards cannot pass it. Both reports merge into one HTML artifact. Coverage thresholds, full database/RLS checks, both existing non-UTC suites, timeouts, retries, pixel tolerances, financial expectations and browser-test selection remain unchanged.

Each shard saves its complete test-result diagnostics and blob report. Final unexpected failures become concise file/line annotations; relative test paths are resolved against Playwright's actual test directory and linked inside the checkout. Hebrew messages are retained and workflow command delimiters escaped. A passed retry, expected failure or ordinary skip does not become a new error. The browser's original exit status is preserved even when diagnostic JSON is missing.

## Local evidence

- Node 24.19.0 / npm 10.8.2, existing frozen dependencies; dependency manifests/lockfile unchanged.
- Native full/shard lists: **299 = 150 + 149** unique `(spec ID, project ID)` pairs; no omitted or duplicated tests.
- Two real browser smoke shards: **one desktop and one phone case passed**, preserving the existing dashboard/date/layout/report-drill assertions. Their blob reports merge into HTML successfully.
- **4/4** diagnostic boundary cases pass: final retry, Hebrew assertion, expected outcomes, delimiter escaping, setup/unexpected-pass errors, repository file links and outside-checkout paths.
- A controlled failed command plus missing JSON retained exit **1**; the diagnostic warning did not convert it to success.
- Type check passes; full ESLint **210 warnings / zero errors**, cap 212 unchanged. YAML parses and retains the original required browser check.
- Complete CI on the published branch is pending. No elapsed-time improvement or full-suite pass is claimed before GitHub reports it.

## Existing screen work verified

| Wiring task | Actual registered entry | Original main code |
|---|---|---|
| C-102 barcode scan | Inventory Cycle Count; Landed Cost Preview | e937db07; cycle-count hardening 1bfbc9c2 |
| C-105 customer quotes | Customer Quotes & Proposals | e937db07 |
| C-106 delivery note document | Delivery Notes | e937db07 |
| C-108 landed cost preview | Landed Cost Preview | e937db07 |
| C-114 serial numbers | Serial & Lot Lookup | be3bc48e |

All five have existing library imports, registry entries, screen help and browser navigation cases. Re-ran **17 component tests / 6 suites** with no failures/skips/cancellations, including barcode entry, quote/proposal/recurring previews, EN/HE delivery documents, landed-cost allocation and serial lookup. Opened every actual Reports entry at **390px light and 1280px dark**, captured and inspected all ten guest screenshots. These checks establish the existing screen wiring and mocked component behavior; live authenticated stock history, physical scanner hardware and provider integration were not exercised. Only the already-landed wiring tasks are ticked; their broader feature limitations remain.

Application, server, posting and database source are untouched by this branch.
