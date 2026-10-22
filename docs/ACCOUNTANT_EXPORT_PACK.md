# Accountant export pack (E-58)

Reports → **Accountant export pack**: one period, one pack for the accountant. Trial balance,
general ledger, accounts receivable, accounts payable and tax liability by period, as a single ZIP of
CSV files and as a printable PDF.

Owner task: COORDINATION **E-58 (AI #5, P1)** — "one action exports trial balance, GL, A/R, A/P and
tax liability by period as CSV (UTF-8 BOM) and PDF, workspace-scoped, with a test."

Code:

| File | What it does |
|---|---|
| `src/lib/accountantExportPack.ts` | Builds the five sections, the README, the CSV files and the ZIP (pure: no React, no database) |
| `src/components/reporting/AccountantExportPackView.tsx` | Reports tab `accountant-export-pack`: period, guards, preview, downloads, print |
| `src/tests/accountant-export-pack.test.ts` | Worked figures for all five sections, the CSV format, the ZIP and the refusals |
| `src/tests/accountant-export-pack-view.test.tsx` | The screen: prepare, stale-period clearing, demo and incomplete-cache blockers |

## The five files

| File | Columns | Source of the figures |
|---|---|---|
| `trial-balance.csv` | account code, name, type, debit, credit, balance in the account's direction | `computeTrialBalance` (`src/server/reports/computeReports.ts`) — the Trial Balance screen's function |
| `general-ledger.csv` | account, date, row kind (opening / entry / account total), transaction, description, reference, debit, credit, running balance | `computeGeneralLedger` — the General Ledger screen's function |
| `accounts-receivable.csv` | customer, not yet due, 1–30, 31–60, 61–90, over 90, total | `computePartyAging` (`src/lib/aging.ts`) — the A/R aging screen's function |
| `accounts-payable.csv` | vendor, the same buckets | the same function, vendor side |
| `tax-liability-by-period.csv` | calendar month, documents, tax on sales, reverse-charge tax, total tax due, tax reclaimable, net tax, sales and purchases excluding tax | `buildTaxReturn` (`src/lib/taxReturnDocs.ts`) — the Tax return screen's function |

`README.txt` travels with them: workspace, period, aging day, currency, generated time, the file list,
the cross-checks (trial balance debits vs credits, open A/R and A/P, tax for the period) and the
limitations below.

The pack writes **no** second formula: every figure comes from the function the screen already uses,
so a pack cannot disagree with the screen it mirrors. Nothing in the pack posts, files a return, or
changes a rate.

## Format

- Every CSV starts with a UTF-8 **byte-order mark** (`\uFEFF`) so Excel shows accents and Hebrew.
- Cells go through the shared `toCsv`/`sanitizeCsvCell` (F-22): quoted, quotes doubled, and text a
  spreadsheet would run as a formula (`=`, `+`, `-`, `@`) neutralised.
- Money is a plain decimal with two places (`1234.50`, `-12.00`) — no currency symbol, so a
  spreadsheet reads it as a number.
- The ZIP uses stored (uncompressed) entries with correct CRC-32 and a central directory
  (`makeStoredZip` in `src/lib/workspaceArchive.ts`, E-21) — no new dependency.
- **PDF** is the browser's print dialog → *Save as PDF*, the app's existing route for report PDFs
  (`data-print-root` + the print styles in `src/index.css`). The printed pack repeats the cover
  figures and every section; a general ledger longer than 500 rows prints the first 500 rows and says
  the CSV has all of them.

## Guards (the screen refuses rather than shipping something wrong)

The pack is prepared only when **all** of these hold; otherwise the screen lists the reason and
disables the button:

1. not the demo workspace (`isGuest` with no signed-in user);
2. a workspace is open;
3. customers, vendors, invoices, bills, credit notes and vendor credits have loaded **for this
   workspace** (`useLedgerCollections` + `loadedWorkspaceId`);
4. none of those lists, nor transactions or the chart of accounts, hit its browser cap or failed to
   load (`truncatedCollections`, `useDataNeedsStore.failed`);
5. a valid period: both dates, start not after end.

A changed period, a changed "include empty accounts" choice, or a workspace switch makes the
prepared pack stale **during render** (the pack remembers its inputs); the download buttons disappear
until it is prepared again. So a downloaded ZIP always matches the dates on screen.

## Limits, stated in the UI and the README

- **A/R and A/P are the open balances on the day the pack is prepared**, not a dated snapshot at the
  period end. Open documents are current state; the aging buckets count days past the due date
  against that day, exactly like the aging screens and the `/aging` API.
- **Tax liability is grouped by calendar month** inside the chosen period, clipped to the period,
  and follows the Tax return rules: `COUNTED_SALES`/`COUNTED_PURCHASES` statuses, draft and voided
  documents left out, home currency, reverse-charge handled as box 2/3.
- Accounts with no opening balance and no movement are left out of the trial balance unless the
  checkbox asks for the whole chart (the note in the section says which).
- A general ledger with more than **200,000** lines is refused with a message to narrow the period.
- The pack is **not** a statutory filing, not a substitute for the accountant's own procedures, and
  says so in the screen and the README.

## Worked figures (the test's books)

Opening: Cash 1,000.00 + Inventory 2,000.00 = Owner equity 3,000.00.

| Date | Entry |
|---|---|
| 10 Jan 2026 | Invoice 1 (paid): A/R 1,200.00 debit; Sales 1,000.00 + Sales tax 200.00 credit |
| 20 Jan 2026 | Bill 1 (paid): COGS 500.00 debit; A/P 500.00 credit |
| 05 Feb 2026 | Receipt: Cash 1,200.00 debit; A/R 1,200.00 credit |
| 15 Feb 2026 | Payment: A/P 500.00 debit; Cash 500.00 credit |
| 20 Feb 2026 | Invoice 2 (open, due 25 Feb): A/R 550.00 debit; Sales 500.00 + Sales tax 50.00 credit |

- Trial balance at 28 Feb 2026: debits **6,950.00** = credits **6,950.00**; Cash 1,700.00, A/R 550.00,
  Inventory 2,000.00, A/P 0.00, Sales tax 250.00, Sales 1,500.00, COGS 500.00, Equity 3,000.00.
- A/R on 5 Mar 2026: customer 1 **550.00** (1–30 days), customer 2 **300.00** (64 days → 61–90),
  total **850.00**. A/P: vendor 2 **214.00** not yet due.
- Tax by period: January output 200.00, input 0.00 → **200.00**; February output 50.00, input 14.00 →
  **36.00**; period total **236.00** in 4 counted documents (invoice 3 of 2025 is outside the period
  and its tax is not counted).

The test asserts each of those numbers, the CSV text, the byte-order marks, the ZIP's local header
and central directory names, and the refusals (unbalanced books, an impossible period).

## Checks run (22 Oct 2026)

- `npx tsc --noEmit -p tsconfig.json` — clean.
- `npm test` — full suite (see the PR for the final counts; 129 database-gated suites skip without
  `LF_TEST_DATABASE_URL`).
- `npm run lint:eslint` — 0 errors, 205 warnings (the baseline; the new files add none).
- `npm run build` — production build and server bundle pass.
- Quality ratchet (`src/tests/quality-ratchet.test.ts`) — no metric regressed (`untestedViews` stays
  44: the new tab is named in `e2e/view-registry-coverage.spec.ts`).
- Browser: the tab is in `e2e/view-registry-coverage.spec.ts` so CI mounts it with every other report;
  Chromium is not installed in this sandbox, so the browser run itself is CI's.

## Not in scope here

- Server-side filing files (PCN874, 1099 IRIS) and the Israeli uniform file (E-33): separate tasks.
- Banking/CSV imports (E-20…E-47): separate tasks.
- A true server-rendered PDF with headers and branding: the app's PDF route today is print-to-PDF;
  a server PDF would be an AI #1 (`src/server/`) change.
