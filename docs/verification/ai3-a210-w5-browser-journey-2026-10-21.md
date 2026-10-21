# A-210 — W5 worked figures end-to-end + the by-label reports in a real browser (AI #3, 21 Oct 2026)

**What this closes:** A-210 (P0, bookkeeping-first plan): labelled invoices, bills and payments — one of
them split across two properties — to **Profit by label** and **Balance Sheet by label**, equal to figures
worked by hand, checked end-to-end on the real report code and the real screens in a real browser.
The arithmetic evidence from 20 Oct is [ai3-a210-w5-worked-figures-2026-10-20.md](ai3-a210-w5-worked-figures-2026-10-20.md);
the real-report function + route + screen evidence from AI #9 is
[ai9-w5bs-balance-sheet-by-label.md](ai9-w5bs-balance-sheet-by-label.md) (PR #283). This note adds the
**browser journey** named as W5's remaining A-210 blocker in `docs/RELEASE_GATE.md`.

## The chain checked

hand-worked cents → the real report functions (`profitByLabel` / `balanceSheetByLabel`, the same code
`GET /api/v1/reports/by-label` and `GET /api/v1/reports/balance-sheet-by-label` call) → the real screens
(`LabelProfitReportView`, `LabelBalanceSheetReportView`, mounted from the app's own source modules in
Chromium against the app's own stores). Nothing in the figures is re-implemented in the test.

## The ledger (January 2026, cents — worked by hand on 20 Oct)

| Document | Total | Property A | Property B |
|---|---:|---:|---:|
| Invoice INV-1 (rental income, tax 3,000) | 30,000 | 10,000 | 17,000 |
| Receipt for INV-1 (**split across both properties**) | 20,000 | 7,407 | 12,593 |
| Bill BILL-1 (repairs, tax 1,500) | 15,000 | 5,000 | 8,500 |
| Vendor payment (**split across both properties**) | 6,000 | 2,222 | 3,778 |

Each side is shared by the same weights, rounded to whole cents; every document balances within each
property (checked in `src/tests/a210-label-worked-figures.test.ts`).

## The figures on the screens (asserted in `e2e/w5-labels-reports-journey.spec.ts`)

Profit by label, 1–31 Jan 2026:

| | Harbour flats (A) | Hill house (B) | Total |
|---|---:|---:|---:|
| Income (4000 Rental income) | 100.00 | 170.00 | 270.00 |
| Expenses (6100 Repairs) | 50.00 | 85.00 | 135.00 |
| Gross profit (income − COGS; no COGS here) | 100.00 | 170.00 | 270.00 |
| Net income | 50.00 | 85.00 | 135.00 |

Balance sheet by label, 31 Jan 2026:

| | A cash | A/R | A/P | Net tax | Profit to date | Total assets | Total claims |
|---|---:|---:|---:|---:|---:|---:|---:|
| Harbour flats (A) | 51.85 | 37.04 | 33.34 | 5.55 | 50.00 | **88.89** | **88.89** |
| Hill house (B) | 88.15 | 62.96 | 56.66 | 9.45 | 85.00 | **151.11** | **151.11** |

Both sheets show "Assets = liabilities + equity for …" and the request the screen sent carries the
label, the value and the dates typed on screen. (Cents 8,889 / 15,111 = the hand-worked A-210 figures
cited in RELEASE_GATE W5.) "Not labelled" is empty for this ledger — the unit suite also covers what is
not labelled, one-sided labelling and unlabelled openings (never shared out).

## Verification

- `e2e/w5-labels-reports-journey.spec.ts` — **2/2 pass** in real Chromium (npm-distributed Chromium 153
  with the bundled nss libs, because this sandbox cannot reach Playwright's browser CDN; CI runs the same
  spec with the standard config). axe serious/critical clean on both report tables. No browser errors.
- `src/tests/a210-label-worked-figures.test.ts` + `src/tests/w5bs-balance-sheet-by-label.test.tsx` —
  **5/5 pass** (the route-on-a-real-database suite runs where `LF_TEST_DATABASE_URL` is set, i.e. CI).
- Full unit suite, `tsc --noEmit`, ESLint (0 errors / 205 warnings, cap unchanged) and the production
  build are in the PR's check list.

## What this does not claim

- F-50 (AI #7) is the wider W5 journey (labels set up and edited, then reports) plus W14; this journey
  covers the two reports by label against worked figures only.
- DIM-3 balancing roles (label roles: informational / fully attributed / self-balancing) is AI #9's.
- No money, posting, tax, server or SQL code changed here.
