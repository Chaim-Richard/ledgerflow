# AI #4 — W13 purchase-to-sale browser evidence

Started at `0d516bfa`; rebased onto owner changes through `d28daa70`; branch: `ai4/w13-full-stock-journey`. This adds the missing creation/posting browser layer to the existing W13-GOLD and seeded valuation/revaluation tests. It does not change accounting logic or W13-GOLD inputs/expected figures.

## What runs for real

`e2e/w13-purchase-sale-journey.spec.ts` opens the actual bill and invoice dialogs, posts two purchases and one sale through the production document routers, and checks persisted inventory, COGS and the authoritative profit-and-loss report in isolated PostgreSQL. Initial accounts are imported through the real workspace route. Only initial parties and a zero-stock item are seeded. No transactions or stock movements are fabricated.

| Step | Independently worked result |
| --- | --- |
| Buy 10 chairs at $40 on 1 April | 10 units, $400 stock |
| Buy 10 at $46 on 10 April | 20 units, $860 stock, $43 average |
| Sell 12 at $90 on 15 April | $1,080 revenue, $516 COGS, $564 profit |
| Remaining stock | 8 units at $43, worth $344 |
| Historical valuation, 12 April | 20 units, worth $860 |

A fresh browser page reloads only persisted database records, finds both bills and the invoice, and verifies valuation, CSV output and historical valuation. Each financial request must succeed and must omit client-built entries/transactions. Request/response evidence is attached by Playwright. Each case owns and cleans up its workspace.

## Scope and limitations

Authentication is injected at the test API boundary. Supabase auxiliary browser requests use the existing harness, and database snapshots refresh the browser cache instead of a hosted realtime subscription. This is browser → actual posting/report routes → PostgreSQL proof, not hosted sign-in, deployed production or four-account W14 certification. The real inventory router also serves stock checks; every case verifies the panel loads successfully. Creating/locking a stock closing remains covered by its separate server tests.

The local database is scratch-installed PostgreSQL 18.4; CI uses PostgreSQL 17. No database runtime/dependency is added to the repository. CI requires `LF_TEST_DATABASE_URL`; local runs skip with an explicit reason if absent.

## Reproducing the browser check

Use an isolated migrated database, then run:

```sh
LF_TEST_DATABASE_URL=postgresql://... npm run db:test-setup
LF_TEST_DATABASE_URL=postgresql://... DATABASE_URL=postgresql://... npx playwright test e2e/w13-purchase-sale-journey.spec.ts e2e/w13-stock-journey.spec.ts
```

The standard Playwright configuration starts the app; Chromium must be installed. Local execution used system Chromium via a scratch configuration, without changing the committed runner.

## Accessibility and images

The full-page axe scan found insufficient light-theme contrast on the ledger total (emerald-600, approximately 3.5:1). One presentation class changes to emerald-700; dark mode keeps emerald-400. All four width/theme cases now have no serious/critical axe violations, without exclusions.

- [Before, phone light](images/w13/before-390-light.png)
- [After, phone light](images/w13/after-390-light.png)
- [After, phone dark](images/w13/after-390-dark.png)
- [After, desktop light](images/w13/after-1280-light.png)
- [After, desktop dark](images/w13/after-1280-dark.png)

The after screenshots were inspected. Existing default visual-reference screens do not mount this report layout.

## Validation

- Clean `npm ci`: passed.
- Migrated isolated test databases: passed.
- New real-posting browser journey: 4/4; existing W13 journey: 1/1. Combined final run: 5/5 in 1.3 minutes while full coverage ran concurrently (initial run: 25.6 seconds before adding the real stock-check endpoint).
- TypeScript: passed.
- Full ESLint: passed, 0 errors and 105 existing warnings; cap unchanged.
- Production build: passed.
- RLS: `ALL RLS TESTS PASSED`.
- Initial database-backed instrumented run: 4,398 tests, 4,396 passed, two failed (scaffolder hit the 4.9 GB `/tmp` limit; the 39-report timing test exceeded its 1-second budget under instrumentation). Coverage is **not certified**: the full temp disk left incomplete coverage files. The scratch coverage directory was moved to the larger workspace disk; no production/test thresholds were changed.
- Final ordinary database-backed full file set on the rebased source, four workers: **4,402 tests, 4,401 passed, one timing failure, zero skipped/cancelled** (769.1 seconds). The unchanged 39-report timing test measured expiring-lots at 1,281.73 ms against the local 1,000 ms budget while four workers shared two CPUs.
- That same file run alone passes **2/2**, including all 39 unchanged 1,000 ms view budgets (two isolated attempts). The standalone process retained existing handles after completion; the confirming invocation used Node's `--test-force-exit` and exited 0 after printing 2 passed/0 failed. No inputs, assertions or budgets were changed. This is a passing isolated rerun, **not an uninterrupted all-green full-suite run**.
- Types, full lint (105 warnings/0 errors), build and RLS were repeated successfully on the rebased source.
- CI must independently pass the complete unit suite and its sharded coverage gate; local coverage remains uncertified.

D-42, D-44 and D-76 were reconciled as already implemented: four unit CI shards with merged coverage; the existing seven-group searchable report picker and merged D-47 preference sync (#370). The D-76 target of 180 warnings is already surpassed by the enforced 105-warning cap. No duplicate implementation or CI rewrite.
