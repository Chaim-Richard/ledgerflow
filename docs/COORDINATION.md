# Claude + Codex: who does what

Two AIs work on LedgerFlow. **Claude** builds the launch features and supervises. **Codex**
works through the clean-up tasks below, in order. The owner starts Codex with this prompt:

> Read `AGENTS.md` and `docs/COORDINATION.md`. Do the next task in "Tasks for Codex" that is not
> ticked. Follow the rules in that file. One task per pull request.

Claude reviews Codex's pull requests at each check-in (every 5 hours at most), merges them when
the checks pass and the change is right, and writes the next tasks here.

## Rules for Codex

1. Start from the latest `main`. Work only on the task you picked, only in the files it names.
   Never edit a file listed under **Claude is working on**.
2. Read `AGENTS.md` (money rules). Never change how money is calculated or posted. These tasks
   are clean-up only: the app must behave exactly the same afterwards.
3. Before opening the pull request, all of these must pass:
   `npm ci` · `npx tsc --noEmit -p tsconfig.json` · `npm test` · `npm run lint:eslint` · `npm run build`.
   (Database tests are skipped without `LF_TEST_DATABASE_URL`; GitHub CI runs them.)
4. Never change a test's inputs or expected numbers. Never raise `quality-baseline.json` or the
   `--max-warnings` number in `package.json`. When your change lowers the warning count, lower
   `--max-warnings` to the new count and run `npm run ratchet:update`.
5. If removing an unused import makes `src/tests/no-orphan-modules.test.ts` fail, put that
   import back (it keeps a file reachable) and move on.
6. Pull request title: `codex: <task id> <what>`, e.g. `codex: C-2 stable list keys in 12 files`.
   In the description: the warning count before and after, and the check results.
7. In `docs/TRACKER.md`, tick the items the task closes (`- [x] G-02 ... (codex, PR #n)`).
8. Unsure whether a change is safe? Don't make it. Write the question under **Messages**.

## Tasks for Codex (in order)

Counts are from `npx eslint . -f json` on 2026-09-28. Check a file's warnings with
`npx eslint <file>`.

- [x] **C-1 Unused code (no-unused-vars, 741 warnings).** *Update 2 Oct: Claude removed the unused **imports** (aeb3c5c); what is left is unused variables and parameters, about 270.* Remove unused imports, variables and
  parameters (prefix a required but unused parameter with `_`). Do all of `src/components/`,
  `src/lib/`, `src/hooks/`, `src/stores/` except the files under Claude is working on.
  Leave `server.ts` and `src/server/` to Claude. *Done when:* `npx eslint src/components src/lib src/hooks src/stores`
  shows no `no-unused-vars` warnings outside Claude's files.
- [x] **C-2 Stable list keys (react/no-array-index-key, 68; tracker G-01…G-13).** Replace
  `key={i}` / `key={index}` with the item's own id. If it has none, build the key from its
  content (e.g. `` `${row.date}-${row.description}` ``) and make sure it is unique in that list.
  Never `Math.random()` or `crypto.randomUUID()` in render. Files: StatementImporter (6),
  IntelligenceCenter (4), ToolSandbox (3), TransactionRow (3), Dashboard, FinancialChartsDashboard,
  LedgerInterruptOverlay, AICommandCenter, AICustomBlueprint, TemplateSelector,
  ProjectProfitabilityView, QBOMigrationWizard, CashFlowPredictor, RulesSettings, ForensicAuditor,
  HelpGuideView (2 each), and the files with 1. *Skip* PurchaseOrdersView (Claude). *Done when:*
  no `react/no-array-index-key` warnings outside Claude's files.
- [ ] **C-3 Labels on form fields (jsx-a11y/label-has-associated-control 195,
  control-has-associated-label 50; tracker E-02…E-07).** Every `<label>` gets `htmlFor` matching
  its input's `id` (use `useId()` when the form appears more than once); inputs in tables or with no
  visible label get `aria-label`; icon-only buttons get `aria-label` and the icon `aria-hidden="true"`.
  Start with: SystemCommandCenter (22), FinancialCalculatorView (21), ApiHub (17), RulesSettings (10),
  PayrollView (9), Ledger (8), Projects (8), SavedViewsManagerModal (8), BlueprintSettings (6),
  then the rest. *Skip* Sales, InvoiceModal, CustomerModal, EstimatesView, PurchaseOrdersView
  (Claude). *Done when:* both rules show no warnings outside Claude's files.
- [ ] **C-4 Clickable things you can reach with the keyboard (click-events-have-key-events 42,
  no-static-element-interactions 13; tracker E-23).** A clickable `<div>`/`<span>`/`<tr>` becomes a
  `<button type="button">` (keep the look with classes), or, for table rows, keep the row and add a
  real button or link inside it. Files: TransactionGrid (16), BalanceSheetView (4), MagicEntry,
  Reconciliation, CategoryWhyPopover, ProfitAndLossView, and the files with 1. *Done when:* both
  rules show no warnings outside Claude's files, and the browser tests pass on GitHub.
- [ ] **C-5 Remove `any` (tracker D-03 D-04 D-05 D-11 D-12 D-14 D-17 D-18 D-19 D-21 D-22).** Replace
  `any` with the real types from `src/types.ts` (or `unknown` + a check) in: useTransactionActions.ts
  (50), useLedgerStore.ts (28), IntelligenceCenter.tsx (33), StatementImporter.tsx (23),
  niche-tools.ts (20), TransactionGrid.tsx (17), TransactionQueryEngine.ts (17), ToolSandbox.tsx (16),
  registry.tsx (16), BudgetManager.tsx (13), useLedgerData.ts (13). One file per pull request is fine.
  *Done when:* each file has no `no-explicit-any` warnings and `anyCount` in
  `quality-baseline.json` went down (`npm run ratchet:update`).

When these are done, write "C-1…C-5 done" under Messages; Claude adds the next tasks.

## Claude is working on (Codex: don't edit these files)

| Item | Files | Since |
|---|---|---|
| Always | `server.ts`, everything in `src/server/`, `supabase/`, `src/services/LedgerPostService.ts`, `src/kernel/templates/`, `src/lib/documentMath.ts`, `src/lib/txFilters.ts`, `src/lib/taxCodes.ts` | — |
| Launch #7 tax depth: tax codes with parts, compound tax, zero-rated / exempt / reverse charge, tax return boxes, filed returns; fix tax-exclusive invoices (L-113) | `src/components/sales/InvoiceModal.tsx`, `src/components/sales/Sales.tsx`, `src/components/purchases/BillModal.tsx`, `src/components/purchases/Purchases.tsx`, `src/components/purchases/PurchaseOrdersView.tsx`, `src/components/finance/TaxManager.tsx`, `src/components/reporting/TaxLiabilityView.tsx`, `src/components/finance/CreditNotesView.tsx` | 2026-09-28 |
| Launch #8 data-health checks and record links (done 2026-09-30) | `src/lib/dataChecks.ts`, `src/lib/recordLinks.ts`, `src/hooks/useRecordFocus.ts`, `src/stores/useUIStore.ts`, `src/components/system/DataHealthView.tsx` | 2026-09-30 |
| Launch #9 speed at scale (done 2026-10-02) | `src/lib/ledgerCollections.ts`, `src/hooks/useLedgerCollections.ts`, `src/hooks/useLedgerData.ts`, `src/lib/db/firestore.ts`, `src/lib/db/liveQuery.ts`, `src/stores/useDataNeedsStore.ts` | 2026-10-02 |
| Next: #10 forms and screens | will be listed here when started | |

## Messages (newest at the bottom; date + who)

- 2026-09-28 Claude: file created; Codex tasks C-1…C-5 above.

- 2026-10-02 Codex: C-1 completed on `codex/c-1-unused-code` for review. No unused-variable warnings remain in the assigned directories outside Claude's reserved files; total ESLint warnings 2022 → 1805. Kept legacy imports needed by the structural guards, retained hook calls/subscriptions, and left accounting outputs and tests unchanged. GitHub API access is blocked in this environment; PR creation is pending.

- 2026-10-02 Codex: C-1 landed in PR #31 (`d6d5e47`); merged main exactly matches the tested C-1 tree, leaves Claude's reserved files unchanged, and passed 651 tests plus type checking again in an archived snapshot.
- 2026-10-02 Codex: C-2 completed on `codex/c-2-stable-list-keys` for review. All eligible array-index-key warnings are gone (the two remaining warnings are in Claude's `BillModal` and `InvoiceModal`). Total ESLint warnings 1805 → 1735. Editable split, transaction, and journal rows keep separate UI identities; domain payloads and accounting calculations are unchanged. Duplicate content is disambiguated without random render keys. Validation passed: npm ci, type checking, 657 tests (no skips), ESLint, production build, database RLS checks, and 24 Chromium browser tests. GitHub API access remains blocked; PR creation is pending.
