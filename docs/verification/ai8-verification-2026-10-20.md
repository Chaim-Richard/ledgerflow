# AI #8 Verification & First-Hour Audit Pack (2026-10-20)

- **Branch:** `arena/5553fa2f-ledgerflow` (based on `upstream/main` `f5bd2d56`)
- **Lane:** AI #8 (Onboarding, Help, Accessibility, Status/Portal Polish & W1/W10/W12 Browser Journeys)
- **Reserved boundaries respected:** Zero edits to `server.ts`, `src/server/**`, `supabase/**`, `src/services/LedgerPostService.ts`, `src/lib/documentMath.ts`, `src/lib/txFilters.ts`, `src/lib/taxCodes.ts`, `Sales.tsx`, `InvoiceModal.tsx`, `Purchases.tsx`, `BillModal.tsx`, `ExpenseClaims.tsx`, `EmailSettings.tsx`, `src/components/onboarding/*`, `Dashboard.tsx`, `Sidebar.tsx`, `Header.tsx`, `StatusBar.tsx`, `Settings.tsx` (`SETTINGS_GROUPS`), or any baseline file (`quality-baseline.json`, `bug-patterns-baseline.json`, `ledger-door-baseline.json`, `package.json`).

---

## 1. Completed Tasks & Reachability Map (23 Items)

| Task | Deliverable & User-Reachable Surface | Verification Suite |
|---|---|---|
| **G-24 (`W1`)** | End-to-end browser journey (`SetupWizard` company details -> consulting chart of accounts -> balanced `$5,000.00` opening balance -> `InvoiceModal` `#1001` `$2,500.00` -> `StatementView` worked balance, overflow & `axe` audit) + first-hour friction list below | `e2e/journeys-w1.spec.ts` |
| **F-46 (`W10`)** | End-to-end browser journey (`Reports` P&L `$3,000.00` / BS `$13,000.00` / TB `$14,200.00` -> `BackupExportSettings` WebCrypto SHA-256 JSON download -> ledger mutation to `$250.00` -> verified archive restore -> exact P&L, BS, and TB parity + `axe`) | `e2e/w10-backup-restore-reports.spec.ts` |
| **F-47 (`W12`)** | Group Summary CSV export (`src/lib/groupSummaryExport.ts` + `"Export CSV"` button on `Reports -> Group Summary`) + end-to-end multi-currency (`USD` + `EUR`) rate-service translation, CTA (`$140.00`), intercompany balance/sales eliminations, account-by-account view, and screen-vs-CSV parity test | `src/tests/group-summary.test.tsx`, `src/tests/ai8-surfaces-and-exports.test.tsx`, `e2e/w12-group-report-consolidation.spec.ts` |
| **G-1** | 11 bilingual EN/HE Markdown screen guides in `docs/help/*.md`, linked from every screen's help dialog (`ScreenHelpHeader.tsx`) and `Help & Guide` | `src/tests/screen-help.test.ts`, `src/tests/ai8-onboarding-help.test.tsx` |
| **G-2** | Guided first-month checklist (`bank`, `openingBalances`, `firstInvoice`, `firstReconciliation`, `firstVatReport`) with automatic store detection + per-user persistence in `Help & Guide -> First month & demo` (`FirstMonthOnboardingHub.tsx`) | `src/tests/ai8-onboarding-help.test.tsx`, `e2e/ai8-onboarding-polish.spec.ts` |
| **G-3 & G-9** | 12-month balanced double-entry Israel (`ILS`, Rimon Tech Consulting Ltd, 18% VAT, NIS 5k threshold) & US (`USD`, Hudson River Studio LLC, NY/NJ sales tax, 1099 contractors) sample companies in `src/lib/countryDemoWorkspace.ts` + `GuestCountrySamplePicker.tsx`, strictly blocked when signed into real books (`canUseDemoSandbox`) | `src/tests/ai8-onboarding-help.test.tsx`, `e2e/ai8-onboarding-polish.spec.ts` |
| **G-4** | Weekly user-facing changelog (`src/lib/changelogEntries.ts` + `ReleaseNotes.tsx`) with category tag filters (`All`, `Accounting`, `Tax`, `Reports`, `Onboarding`, `Accessibility`), reachable from `Help & Guide -> What's new` | `src/tests/ai8-onboarding-help.test.tsx` |
| **G-5** | Optional module toggles with plain-language explanations and status badges in `Settings -> Modules` (`ModulesSettings.tsx`) | `src/tests/ai8-surfaces-and-exports.test.tsx` |
| **G-6 & G-22** | 12-screen EN/HE translation bundle & missing-string coverage auditor (`src/lib/i18n/screenTranslations.ts`) rendered in `Help & Guide -> Accessibility & language` (`AccessibilityAndLanguagePanel.tsx`) | `src/tests/ai8-onboarding-help.test.tsx`, `e2e/ai8-onboarding-polish.spec.ts` |
| **G-7 & G-13** | WCAG 2.1 AA conformance & known-gaps documentation (`docs/ACCESSIBILITY.md`) + live in-app Accessibility Statement & Coverage panel (`AccessibilityAndLanguagePanel.tsx`) | `src/tests/ai8-onboarding-help.test.tsx`, `e2e/ai8-onboarding-polish.spec.ts` |
| **G-8** | Bilingual EN/HE Day 1, Day 3, and Day 7 owner onboarding email templates (`src/lib/onboardingEmails.ts`) with opt-in toggle and live template preview in `FirstMonthOnboardingHub.tsx` | `src/tests/ai8-onboarding-help.test.tsx` |
| **G-10 & G-11** | 20 bilingual EN/HE how-to guides (`src/lib/helpCenterArticles.ts`) with instant English/Hebrew keyword search and screen deep links in `HelpGuideView.tsx` | `src/tests/ai8-onboarding-help.test.tsx`, `e2e/ai8-onboarding-polish.spec.ts` |
| **G-12** | Complete keyboard shortcut reference sheet in both `ShortcutOverlay.tsx` (`?`) and `Settings -> Shortcuts` (`ShortcutSettings.tsx`, also deduplicating duplicate `'intelligence'` React option keys) | `src/tests/ai8-surfaces-and-exports.test.tsx` |
| **G-14** | Public & in-app `StatusPage.tsx` (`/?status=1` and `/status` without auth guard, plus `#status` tab) and degraded health link from `ConnectionBanner.tsx` | `src/tests/ai8-surfaces-and-exports.test.tsx`, `e2e/ai8-onboarding-polish.spec.ts` |
| **G-15** | Workspace-owner feedback triage bar, tag pills (`bug`, `ux`, `tax`, `report`, `onboarding`, `billing`), tag filter, and one-click `Mark done` in `SupportView.tsx` (using `useCurrentRole() === 'owner'`) | `src/tests/ai8-surfaces-and-exports.test.tsx`, `e2e/ai8-onboarding-polish.spec.ts` |
| **G-16** | Read-only customer invoice & statement portal (`CustomerPortalPage.tsx` at `/c/<token>` and `/?portal=<token>`) showing open balance, invoice table, and print receipt view | `src/tests/ai8-surfaces-and-exports.test.tsx`, `e2e/ai8-onboarding-polish.spec.ts` |
| **G-20** | Notifications center `Group by type` toggle (`groupNotificationsByCategory`) alongside `Mark all read` in `NotificationDrawer.tsx` | `src/tests/ai8-surfaces-and-exports.test.tsx` |
| **G-21** | Print light-paper override (`@media print` in `src/index.css` + `src/components/reporting/reportPack/reportPack.css`) forcing `#FFFFFF` paper, `background-image: none`, and `#0E2229` dark ink even when `.dark` / `[data-theme="dark"]` is active | `e2e/ai8-onboarding-polish.spec.ts` (`emulateMedia({ media: 'print' })`) |
| **G-23** | Guest/sandbox-only demo reset action (`starter` sample books vs `empty` clean books) in `GuestCountrySamplePicker.tsx`, locked behind `canUseDemoSandbox(user, isGuest)` | `src/tests/ai8-onboarding-help.test.tsx` |

### Items Intentionally Left Unchecked (`[ ]`) Due to Reserved File Boundaries
- **`G-17` (Vendor portal bill PDF upload to staging inbox):** Requires a new unauthenticated upload route in `src/server/` and inbox actions in `src/components/purchases/Purchases.tsx` (both reserved under `## Claude is working on`).
- **`G-18` (Mobile receipt photo capture to draft expense):** Requires wiring into `src/components/purchases/ExpenseClaims.tsx` (reserved under `## Claude is working on`).
- **`G-19` (Mobile bill & expense approval queue):** Requires wiring into `src/components/purchases/Purchases.tsx` / `BillModal.tsx` and `ExpenseClaims.tsx` (reserved under `## Claude is working on`).

---

## 2. G-24 First-Hour Friction Audit (Places Where a New User Can Get Stuck)

1. **Two separate first-run surfaces (`SetupWizard.tsx` vs `OnboardingView.tsx`):** Signed-in owners on an unconfigured workspace see `SetupWizard` (4 crisp steps: business -> chart -> opening balances -> first invoice), whereas unsigned guest sessions land on `OnboardingView` (which contains a `"3. 3. Train AI Matching"` duplicate step prefix on line 83 of `OnboardingView.tsx` — left untouched because `src/components/onboarding/*` is reserved).
2. **Opening balance requirement for `Opening Balance Equity`:** In `SetupWizard` step 2 (`Opening balances`), if a workspace has custom accounts without an unarchived `Opening Balance Equity` account (`code: 3900` / `isOpeningBalanceEquity`), all opening balance inputs are hidden until one is added or the user clicks `"Start from zero"`.
3. **Customer & income account selection in `InvoiceModal`:** `InvoiceModal` uses `<input list="...">` comboboxes (`#inv-customer` and `#inv-item-acc-0`) rather than native `<select>` dropdowns; typing a customer name that does not match an existing `Customer` creates an inline `new-<uuid>` placeholder unless the customer was created beforehand.
4. **Support ticket role check bug (found and fixed in this PR):** `SupportView.tsx` previously checked `currentWorkspace?.ownerUid === user?.uid || currentWorkspace?.role === 'owner'`, neither of which exists on `Workspace` (`uid` and `roles[uid]` are used instead). Fixed via `useCurrentRole() === 'owner'`.
5. **Pre-existing upstream guard breaks (found and fixed in this PR):**
   - `src/lib/tax/usMileageRates.ts` used floating-point division `(tenthsOfCent / 10).toFixed(1)` and `MileageRatesReportView.tsx` used `new Date().toISOString().slice(0, 10)`, breaking `money-format-guard.test.ts`. Replaced with integer floor/modulo arithmetic and `getLocalDateISO()`.
   - `ShortcutSettings.tsx` rendered duplicate `'intelligence'` React keys across `APP_TABS` and `SETTINGS_TABS_REGISTRY`. Deduplicated cleanly by `tool.id`.

---

## 3. Local Verification Executed

- **TypeScript (`npx tsc --noEmit`):** 0 errors.
- **ESLint (`npm run lint`):** 0 errors, below `--max-warnings 210` budget (cap unchanged).
- **Production build (`npm run build`):** `tsc && vite build` clean exit `0`.
- **Guard, Ratchet, Orphan & AI #8 Unit/DOM Suites:**
  - `src/tests/ai8-onboarding-help.test.tsx`: **11/11 pass**
  - `src/tests/ai8-surfaces-and-exports.test.tsx`: **4/4 pass**
  - `src/tests/group-summary.test.tsx`: **15/15 pass**
  - `src/tests/mileage-rates-view.test.tsx`: **pass**
  - `src/tests/*guard*.test.ts`, `no-orphan-modules.test.ts`, `quality-ratchet.test.ts`, `screen-help.test.ts`: **57/57 pass**
