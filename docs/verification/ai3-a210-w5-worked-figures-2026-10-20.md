# AI #3 A-210 — W5 worked-figure check (20 Oct 2026)

**Revision:** recorded in the PR for this branch after push. **Scope:** test-only accounting evidence; no posting, calculation, server, schema or UI code changed.

## Independent example, USD cents

The test builds four posted entries using the existing invoice, bill and payment line templates:

- Invoice: total 30,000, including 3,000 tax; pretax rent is 10,000 for property A and 17,000 for B.
- Customer receipt: 20,000, allocated across the same properties in those line-weight proportions.
- Bill: total 15,000, including 1,500 tax; pretax repairs are 5,000 for A and 8,500 for B.
- Vendor payment: 6,000, allocated across the properties in the bill-line proportions.

Each entry balances in total and its A and B line slices independently balance. The report's posted P&L agrees with the hand calculation:

| Property | Income | Repairs | Net income |
|---|---:|---:|---:|
| A | 10,000 | 5,000 | 5,000 |
| B | 17,000 | 8,500 | 8,500 |
| Total | 27,000 | 13,500 | 13,500 |

At 31 Jan, independently projected per-property posted lines passed to the existing balance-sheet calculator give:

| Property | Cash | A/R | Assets | A/P | Net tax payable | Net income | Claims | Balanced |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| A | 5,185 | 3,704 | 8,889 | 3,334 | 555 | 5,000 | 8,889 | Yes |
| B | 8,815 | 6,296 | 15,111 | 5,666 | 945 | 8,500 | 15,111 | Yes |

The test asserts those values exactly, checks there are no orphaned lines, and checks each source entry balances both globally and for each property. The assertions and amounts are in `src/tests/a210-label-worked-figures.test.ts`.

## Boundary / release status

This is not proof that the user can run a balance sheet by label in the product. The existing `Profit by label` endpoint/view is exercised for the P&L. The balance-sheet half projects each property's labelled lines into a separate ledger before calling `computeBalanceSheet`; the existing balance-sheet route has no dimension filter, and there is no balance-sheet-by-label view. Therefore this supplies worked arithmetic/invariant evidence but **does not finish A-210 or move W5 Verified to Yes**. A label-scoped balance sheet needs an approved, user-reachable report path and an independently reviewed server/report implementation by AI #1. W5's browser status also remains No.

## Verification

- Focused test: `NODE_ENV=test SYSTEM_SALT=test-ledgerflow-salt-32-deterministic npx tsx --test src/tests/a210-label-worked-figures.test.ts` — passed (1 test).
- `npm run lint:types` — passed.
- `npm test` — passed: 3,093 passed, 0 failed, 1,921 top-level tests counted, 743 suites; one database test skipped because `LF_TEST_DATABASE_URL` is unset. This does not substitute for the database/RLS suite.
- `npm run lint:eslint` — passed, 0 errors / 209 warnings (the configured ceiling).
- `npm run build` — passed (Vite production build and bundled server).
- No browser suite was run: no UI was changed, and the missing balance-sheet-by-label screen is explicitly not claimed as browser-verified. No GitHub Actions workflow is assumed to run on PRs; a red/paused Vercel preview is not treated as a code-test result.
