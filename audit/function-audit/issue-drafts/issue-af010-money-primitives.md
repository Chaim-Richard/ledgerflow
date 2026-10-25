# Issue draft — AF-010: duplicated money primitives with different contracts and parser defects

**Suggested title:** AF-010: consolidate amount parsing/allocation primitives — parenthesized negatives lose their sign, malformed input throws in render paths

**Severity:** P2 (beta prerequisite for the parser defects; F4–F6 are P3) · **Owner lane:** AI #1 (money maths)
**Pinned SHA:** `8df972dad7e9f282fad317e2c1a8939b9ef96aef` · evidence: `audit/function-audit/AF-010-money-microfunctions.md`, tests `src/tests/audit-af010-money-primitives.test.ts`, `src/tests/audit-af010b-csv-dates.test.ts` (20/20 green).

## Defect mechanisms (each independently reproduced)

1. **Two `allocateCents` with opposite contracts.** `src/kernel/templates/TransactionTemplates.ts`
   coerces degenerate weights (`allocateCents(500,[0,0]) → [500,0]`, negative weights clamped to 0);
   `src/lib/Allocation.ts` — annotated "Canonical" — throws on the same inputs and on non-safe-integer
   totals. Both are used in money paths (`paymentService`, `allocationLedger`, `billPosting`,
   `landedCostService`, `LedgerEngine`). No numeric divergence where both accept inputs (property
   tested), but moving a call site between them changes failure behavior silently.
2. **`utils.parseAmountToCents('(100.00)') → 10000`** — accounting parenthesis notation has its sign
   stripped. `TruthEngine.parseAmountToCents` and `bankCsvAmountCents` both return `-10000`. Bank
   statement imports are protected by their own guarded parsers (and MT940/CAMT take direction from a
   separate D/C marker), so the exposed surface is UI money fields that import the utils helper
   (FixedAssetsView, LoansView, ConstructionActions, SpreadDialog, UnappliedPayments, PettyCashView, …).
3. **Malformed text throws a raw `[DecimalError] Invalid argument`** from `utils.parseAmountToCents`
   (`'1.2.3'`, `'1-2'`, `'--5'`). Render-path callers (`useMemo` in CashMovementDialog, TransferModal,
   JournalEntryModal) can therefore hit the screen error boundary mid-typing instead of showing
   inline validation. `TruthEngine.parseAmountToCentsOrZero` shows the safe pattern.
4. **P3:** Arabic-Indic digits (`'۱۲۳'`) silently become `0`; `parseAmountToCents(Infinity)` returns
   `Infinity` rather than an integer cent.
5. **P3:** `sanitizeCsvCell` neutralises formula-prefixed cells but a leading space bypasses it
   (`' =1+1'` is emitted quoted but unneutralised).
6. **P3:** `formatDecimal(Infinity) → 'Infinity.NaN'` instead of refusing non-finite input.

## Shortest reproductions

```ts
import { parseAmountToCents } from './src/lib/utils';
parseAmountToCents('(100.00)'); // 10000 — expected -10000
parseAmountToCents('1.2.3');    // throws DecimalError — expected 0/null + field validation
```

## Proposed correction (one shared primitive — the strategy-review "few shared primitives" answer)

- One amount parser with explicit, documented behavior: parentheses/`CR`/unicode-minus negatives,
  currency marks and thousands separators accepted; ambiguous or malformed input returns `null`
  (never throws on the render path, never invents a sign); non-finite/non-integer-safe output refused.
  Route every money input through it; keep `bankCsvAmountCents`'s strict refusal contract for imports.
- One allocator taking an explicit on-degenerate policy (`throw | first-slot`) so callers state their
  intent; migrate both call families and delete the duplicate.
- Extend the CSV guard to trim leading whitespace before the formula-prefix test.

## Adversarial acceptance tests (already drafted as observed-behavior locks)

The audit tests currently assert the buggy outputs with `OBSERVED DEFECT/GAP` comments; the fix
flips those assertions to the expected behavior in the same commit. Include worked-figure tests for
parenthesized entry in one dialog end-to-end, and a 5,000-case allocator sum-invariance property
(already passing for both implementations today).

## Duplicate search

No open or closed issue covers these mechanisms as of 2026-10-25 (#152 is the separate, fixed
per-label rounding case).
