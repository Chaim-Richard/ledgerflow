# Audit scorecard addendum — 2026-10-27 at b4a92158

**This is an addendum to `SCORECARD.md` (pin 8df972d) and the 50ee1205 update (89 functions).** It records the 11 new functions inspected at the new pin `b4a92158` (upstream/main, 2026-10-27 21:48 UTC, 54 commits after 50ee1205). The prior scorecard remains correct for its pins; this file is the delta.

## Pins

- **Previous:** `50ee1205` (2026-10-25) — 89 functions inspected (67 + 22), DB-gated 4,616 tests 0 skipped via embedded Postgres.
- **Current:** `b4a92158` (2026-10-27) — +11 functions → **~100 inspected**. No migration added between pins (`git diff 50ee1205..b4a92158 -- supabase/migrations` empty).

## Eleven audit targets inspected at b4a92158 (some entries group multiple functions; not eleven individual functions)

1. **`src/lib/calendarDate.ts:dayNumber`** — proleptic Gregorian days since 1970-01-01, integer Howard-Hinnant; no Date/zone. Verified `dayNumber('2026-01-01')` stable across TZ=UTC/NY.
2. **`src/lib/calendarDate.ts:civilDateParts`** — regex `YYYY-M-D`, leap check, returns written parts, no zone. Used by `formatDate` at new pin to display a stored civil date exactly as written.
3. **`src/lib/calendarDate.ts:fromDayNumber` / `addMonthsYMD` / `addDaysYMD` / `weekdayYMD`** — inverse of dayNumber, month clamp, day arithmetic; pure.
4. **`src/lib/collectionRetry.ts:classifyFailure`** — auth vs transient via status/code/message regexes; `permission denied` wins over `network`.
5. **`src/lib/collectionRetry.ts:planRetry` / `canRetryNow` / `retryDelayMs`** — bounded (AUTO_RETRY_LIMIT=4, 4s doubling, 120s cap), `immediate` for online/visible, never retries `auth`.
6. **`src/lib/ledgerGridNav.ts:isGridNavKey` / `startGridFocus` / `moveGridFocus` / `reconcileGridFocus`** — pure grid focus, null on empty rows/fields, index follows record on sort, loses focus when record filtered out (not index-stays).
7. **`src/lib/testEnvironment.ts:testEnvironmentBannerShown`** — `PROD && VITE_TEST_ENVIRONMENT !== 'off'` (G-05).
8. **`src/lib/txFilters.ts:isEarningsAccount`** — income/revenue/expense/cost_of_goods + COGS/Direct Costs/cogs roles, shared by `calculateNetIncome` and `BalanceSheetReport`.
9. **`src/components/support/TestEnvironmentBanner.tsx`** — role="note", amber banner, "Report a problem" → `ledgerflow:feedback`.
10. **`src/components/ledger/TransactionGridKeyboardRegion.tsx`** — one focusable region landmark, no window listener, Tab not intercepted, `scrollToItem`, start on first arrow, `Enter`→editor, `Escape` clears.
11. **`src/hooks/useLedgerData.ts` (retry wiring)** — new imports of `collectionRetry`, `online`/`visibilitychange` → `canRetryNow(immediate=true)`, timer via `nextRetryAt`.

Each has source-pinned evidence: `TZ=UTC npx tsx audit/function-audit/probes/af011-date-contracts.mjs` now shows `formatDate` correct; `grep` for `window.addEventListener` in TransactionGrid → 0; `grep collectionRetry` → hook present; `isEarningsAccount` test 25/25.

## Coverage (honest)

- Prior atlas (stale SHA 74b8318): 29,662 functions / 121,619 edges (incl. tests).
- Current app files at b4a92158: 995 application + 198 server = 1,193 source files (per `code-atlas.mjs stats`).
- Function-like declarations (simple grep): ~10,100 (same method as before).
- **Inspected at b4a92158: ~100** (≈1% of the inventory). Indexing ≠ review.
- DB-gated checks at b4a92158: **skipped here** (no LF_TEST_DATABASE_URL in this env); carried from 50ee1205 where they passed 4,616/0; no migration/ledger change between pins except the tested isEarningsAccount.

## Findings delta

- **Fixed between pins:** AF-013 (#104), AF-014 (#96), G-05 banner, #423 equity drill-down (see FINAL_ACCURATE_LIST_2026-10-27.md §2).
- **Narrowed:** AF-011 (#342) — `formatDate` fixed, `parseLocalDate` still shifts for TaxManager year filter (one line left).
- Otherwise unchanged from 50ee1205 register.

## Next batch (unchanged from 50ee1205)

`postingCore` → `ledgerBulkCommit` → shadow check → `reconcileRoutes` → `bankLineService` → `bankRuleService` → `paymentVoidService` → `allocationLedger.recordAllocation/reverseAllocation` → `periodClosingService` → `stockClosingService`.

