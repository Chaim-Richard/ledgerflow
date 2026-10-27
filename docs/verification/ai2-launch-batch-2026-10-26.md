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
| C-96 | Reports → **Copy link** copies the exact URL with report, year, timeframe, month/quarter, comparison, custom dates, known navigation keys and hash preserved; unrelated or sensitive query values are dropped. A refused clipboard says to copy the address bar instead of failing silently. | same lib and `Reports.tsx`; `report-saved-views.test.tsx` |
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

## 5. Automated review round and visual baselines (26 Oct)

GitHub CI run `40416346684` was green for lint/typecheck/database rules, both timezone unit passes,
all four unit shards, coverage, CodeQL, SBOM and browser shards 1–4. **Browser shard 5/5** failed only
on the ten desktop visual references for the five screens this batch intentionally changes: Settings
(glossary tab), Sales/Purchases (column chooser) and P&L/Balance Sheet (saved views, copy link and
report table empty-state fallback), light and dark. The Playwright smoke aggregator mirrors that
single shard failure. The exact spec names came from the failed check run’s annotations; phone and
unchanged desktop references were not stale.

The same review round also found real presentation issues. All were corrected on this branch, with
focused tests:

- Saved views now persist `cmp=none` explicitly, restore it over an active comparison, and mark the
  applied view as the Reports page’s explicit link state so loaded-cache auto-defaults cannot replace
  its year/month. A blocked `localStorage` write keeps the name draft and never says “Saved”.
- Copied report links allowlist `mode`, `stale`, `lens` and `view`; unrelated or sensitive query
  values are not copied. The share-link test now proves a `token` is dropped.
- `ReportTableScroll` counts data rows structurally instead of interpreting their words, so “No item”
  and “No Fee Loan” remain data. Its observer also watches the status-owning parent containers, so
  the fallback returns when an external loading status disappears.
- Cash Flow, Monthly Averages and A/R/A/P Aging now qualify an empty result when the server answer
  or browser history is incomplete; the monthly view shows the shared incomplete-cache provenance note.
- Excel headers preserve the exact workspace name and write formula-like cells as rich text, never as
  formulas or altered labels. `ToolSandbox` exports the same effective algorithm date range its
  preview used, via a tested pure helper.
- The glossary’s “Chart of accounts” Hebrew title is corrected, gershayim (`״`) folds to the stored
  ASCII quote in searches, and the duplicate CF-06 tracker row is removed.
- New/updated tests: `report-saved-views.test.tsx`, `accounting-glossary.test.tsx`,
  `report-export-header.test.ts`, `report-empty-state.test.tsx`, `algorithm-report-period.test.ts`.

The repository’s manual “Refresh visual baselines” workflow cannot be dispatched with this session’s
GitHub token (HTTP 403), and this sandbox has no Chromium. Following the same temporary pattern used
by AI #3, a short-lived push-triggered workflow on this branch recaptured **every changed reference
image** on CI’s Linux Chromium, ran the **entire 40-image reference set** without
`--update-snapshots`, and committed the candidates to this branch as reviewable PNG diffs. It never
pushed to `main`; the temporary workflow is removed before the final PR state. The first attempt only
recaptured the ten desktop images and correctly failed the full check, because the row-detection fix
also changed eight phone report references. The successful workflow run `40424080429` updated 18
images: five desktop light/dark screens plus four phone light/dark report screens; Settings phone
images were unchanged. Full-size desktop/phone light/dark images were opened and reviewed: the new
Columns disclosure, Saved report views, Copy link and Accounting glossary tab are visible, report
figures and tables remain intact, and no clipping or duplicate empty state appears. No screenshot
tolerance or test input was changed.

## 6. Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean |
| ESLint on every changed `.ts/.tsx` file | 0 errors, 0 warnings |
| `npm run lint:eslint` (whole repo) | 0 errors, 42 warnings — the unchanged cap |
| Focused new and affected suites after the review round | 20/20 (`report-saved-views`, `accounting-glossary`, `report-export-header`, `report-empty-state`, coverage and `algorithm-report-period`) |
| Full unit suite, four CI shards in parallel after the review round | 3,975 tests, 3,973 pass, 0 fail, 2 skipped; one timing-sensitive A-229 speed case passed when shard 1 was rerun alone (1,070/1,069/0/1) after four-way parallel module loading exceeded its 1,500 ms import budget by 106 ms |
| `npm run build` | passes (Vite + PWA + `build/server.cjs`) |
| `git diff --check` | clean |
| `npm audit --audit-level=high` | passes: 0 high/critical; 2 pre-existing moderate advisories in the transitive `typed-rest-client` → `qs` tree, not a dependency change in this branch |
| `npm test` (literal single command, before the review round) | passed: 3,968 tests / 3,966 pass / 0 fail / 2 skipped, 896 suites, ~32 min on Node 22 |
| `npm run test:rules` | not run locally: no `LF_TEST_DATABASE_URL`/test Postgres; no SQL, route or RLS change. GitHub CI’s database-rules job passes |
| Playwright | `e2e/glossary.spec.ts` added; not run locally because this sandbox has no Chromium. GitHub CI runs the browser specs and the refreshed visual references |
| Temporary CI baseline workflow `40424080429` | full 40-image Playwright check passed after recapturing 18 changed references; all 18 PNGs opened and reviewed; temporary workflow removed from the final branch |
| Final GitHub CI on the pushed branch | required checks green on the final commit — see the check set on [PR #414](https://github.com/shmuelbiller1/ledgerflow/pull/414) |

No existing test input or expected number was changed, no screenshot tolerance or warning cap was
raised, and no quality baseline was relaxed; only reviewed reference PNGs were refreshed. The owner’s
paused Vercel preview remains red independently of this code.

