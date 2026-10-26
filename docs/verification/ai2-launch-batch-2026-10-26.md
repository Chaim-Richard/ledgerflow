# AI #2 — launch-readiness batch (26 Oct 2026)

**Branch:** `arena/63bdffa0-ledgerflow`, from `main` `116ee530`.
**Review:** [PR #414](https://github.com/shmuelbiller1/ledgerflow/pull/414) (open; not merged by AI #2).
**Queue:** `docs/COORDINATION.md` → “Tasks for Codex — AI #2”.
**Lane:** screens, reports, settings lists, presentation and documentation only. No change to money
calculation, posting, tax maths, `src/server/`, database schema, migrations, dependencies or
`quality-baseline.json`. No RELEASE_GATE row is moved by this batch: it is UI/help polish, not a new
bookkeeping workflow or worked-figures proof.

## 1. What was implemented

| Task | User-visible result | Main files and tests |
|---|---|---|
| C-85 | Reports → **Saved report views** keeps the report, period, comparison and custom date range under a name, scoped to user/workspace on this device. Use restores every filter; duplicate names, stale reports and blocked storage are explicit. No row or amount is stored. | `src/lib/reportViews.ts`, `src/components/reporting/ReportViewsControls.tsx`, `Reports.tsx`; `report-saved-views.test.tsx` (4) |
| C-96 | Reports → **Copy link** copies the exact URL with report, year, timeframe, month/quarter, comparison, custom dates, unrelated query keys and hash preserved. A refused clipboard says to copy the address bar instead of failing silently. | same lib and `Reports.tsx`; `report-saved-views.test.tsx` |
| C-67 | **Columns** chooser on invoices, bills, payments, customers and vendors. Selection and actions stay visible, at least two columns remain, choices are workspace/device-scoped, print restores every column, and colspan status rows are never hidden. | `src/lib/listColumns.ts`, `src/components/ui/ListColumnChooser.tsx`, `Sales.tsx`, `Purchases.tsx`, `PaymentsView.tsx`; `list-column-chooser.test.tsx` (2) |
| C-54 / C-91 | `ReportTableScroll` supplies one compact next-action empty state when a report table has no rows. Loading, failure, provisional and explicit empty messages are never duplicated. Reports without that wrapper received explicit states where missing; A/R and A/P aging say how to clear the search or record an open document. | `ReportEmptyState.tsx`, `ReportTableScroll.tsx`, `PartyAgingReportView.tsx`, `CashFlowView.tsx`, `AverageMonthlyReportView.tsx`, `AskBooksView.tsx`, `ImportAcceptanceView.tsx`; `report-empty-state.test.tsx` (3), `report-empty-state-coverage.test.ts` (130 registered reports) |
| C-87 | One formula-safe Excel header block — title, entity, period, basis, currency, generated-at — now sits **above** the column headings in all five `exportToExcel` report paths. Object rows still resolve by column key. | `src/lib/excelExport.ts`, `plExport.ts`, `BalanceSheetView.tsx`, `CashFlowView.tsx`, `TrialBalanceView.tsx`, `ToolSandbox.tsx`; `report-export-header.test.ts` (3) |
| C-97 | Preferences → **Accounting glossary**: 36 searchable terms in plain English and Hebrew, grouped by books area, with RTL isolation, Hebrew help, a linked help page and a clear-search empty state. Definitions are learning aids, not tax decisions. | `src/lib/accountingGlossary.ts`, `src/components/support/GlossaryView.tsx`, registry/help/docs, `e2e/glossary.spec.ts`; `accounting-glossary.test.tsx` (2) |

## 2. Existing work re-verified and ticked

These were built on `main` but left unchecked in AI #2’s queue. Each was traced from registry/screen to
its test; no duplicate feature was added.

- **C-38 / CF-06** export templates: `ReportTableScroll` → `ExportTemplateControls` keeps named
  column/order choices per user/workspace/report; `export-templates.test.tsx` and
  `column-chooser.test.tsx` pass.
- **C-65** `ShortcutOverlay` + `ScreenShortcutHelp`; `shortcuts.test.ts` and
  `screen-shortcuts.test.tsx`.
- **C-68** report-only print heading with period/entity via `Reports.tsx`, `ReportPeriodHeading`,
  `PrintLayoutControl` and the report pack cover.
- **C-89** the C-29 column chooser is supplied by `ReportTableScroll` to 82 report files, including
  the ten busiest statements.
- **C-90** one `moneyText` helper with workspace `moneyDisplay.negativeStyle`; Settings →
  Appearance → Money display and `money-display-panel.test.tsx`.
- **C-98** Dashboard/OnboardingView → `FirstHourGuide` already gives the ordered bank, import,
  invoice, bill, payment, reconciliation and report checklist. It is a first-hour guide, not a
  week-long calendar.
- **C-101** Settings → Tax profiles already edits registrations per entity/label with kind, number,
  place, filing frequency and validity dates.

## 3. Deliberately left partial

- **C-71** `[~]`: main lists and all registered reports have next-action empty states; auxiliary
  settings/admin lists were not exhaustively audited.
- **C-86** `[~]`: Settings → Scheduled reports stores weekly/monthly choices and sends through the
  existing server job. An explicit day-of-month picker is still open.
- **C-88** `[~]`: Reports and report packs share the printed heading/cover; specialized server PDF
  routes still own separate headers/footers.

## 4. Full-suite regression pass

The first four-shard full suite exposed 14 failures caused by this batch; all were fixed without
changing test inputs or expectations:

1. A/R and A/P aging’s empty message stopped matching an existing `/found matching criteria/`
   assertion — restored that phrase and appended the next action.
2. `ReportTableScroll` added a second `role="status"` beside a report’s own provisional/failure
   live region — it now suppresses the fallback when an outside live region already explains the
   state, with a new DOM regression case.
3. The list chooser’s `<label>Customer</label>` / `<label>Vendor</label>` made
   `getByLabelText('Customer'|'Vendor')` ambiguous when invoice/bill dialogs were open — the
   chooser now uses a described checkbox with generic accessible names and “… column” visible text.
4. The new glossary view raised `untestedViews` from 0 to 1 — `e2e/glossary.spec.ts` adds a real
   guest-browser smoke journey (bilingual search, no-match recovery and clear search).

The final four-shard run is **3,968 tests / 3,966 pass / 0 fail / 2 skipped**; the two skips are the
database-gated suites without `LF_TEST_DATABASE_URL`. The literal `npm test` later reproduced exactly
the same totals in one process. GitHub CI’s first browser shard also caught a strict-mode locator in
the new glossary spec (`getByRole('status')` matched app-wide banners); the spec now targets the
glossary’s own result-count text. No application assertion was weakened.

## 5. Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean |
| ESLint on every changed `.ts/.tsx` file | 0 errors, 0 warnings |
| `npm run lint:eslint` (whole repo) | 0 errors, 42 warnings — the unchanged cap |
| Focused new and affected suites | 81/81 in the regression rerun; earlier focused batches 35/35, 28/28, 30/30 and 12/12 |
| Full unit suite, four CI shards in parallel | 3,968 tests, 3,966 pass, 0 fail, 2 skipped |
| `npm run build` | passes (Vite + PWA + `build/server.cjs`) |
| `git diff --check` | clean |
| `npm audit --audit-level=high` | passes: 0 high/critical; 2 pre-existing moderate advisories in the transitive `typed-rest-client` → `qs` tree, not a dependency change in this branch |
| `npm test` (literal single command) | **passes: 3,968 tests / 3,966 pass / 0 fail / 2 skipped**, 896 suites, ~32 min on Node 22; the same two database-gated skips |
| `npm run test:rules` | not run: no `LF_TEST_DATABASE_URL`/test Postgres; no SQL, route or RLS change |
| Playwright | `e2e/glossary.spec.ts` added; not run locally because this sandbox has no Chromium. GitHub CI runs the browser spec |

No existing test input or expected number was changed, no warning cap was raised, and no quality
baseline was relaxed. The owner’s paused Vercel preview remains red independently of this code.

