# AF-010 — high-risk micro-functions: allocators, amount parsers, CSV, date/period helpers

**Pinned revision:** `8df972dad7e9f282fad317e2c1a8939b9ef96aef`
**Reviewer:** AI #8, independent audit Pass A · **Date:** 2026-10-25
**Executed evidence:** `src/tests/audit-af010-money-primitives.test.ts` (7/7) and
`src/tests/audit-af010b-csv-dates.test.ts` (3/3). Expected values worked by hand in the tests.

## Source blobs

| File | Git blob SHA at pin |
|---|---|
| `src/kernel/templates/TransactionTemplates.ts` (`allocateCents`, `spreadLabels`) | `0d286d8053c6ffdc2af16d2d72fd0fd3f63702c3` |
| `src/lib/Allocation.ts` (“canonical” `allocateCents`) | `173dcc5316afe57e567ffc6b94090b6273892f94` |
| `src/lib/utils.ts` (`parseAmountToCents`, `sanitizeCsvCell`, `formatDecimal`) | `5fdeb2f8447e8449588fc05ef3c0ef420dd7e30d` |
| `src/lib/bankCsvRows.ts` (`bankCsvAmountCents`) | `105aad0f1dfb3e939360462c5ba243e5a1a2e380` |
| `src/modules/integrity/TruthEngine.ts` (`parseAmountToCents`) | `2b22a5e58f43db55a0713c444556ee53427b46f2` |
| `src/lib/periodLock.ts`, `src/lib/bankStatementDate.ts`, `src/lib/csvExport.ts` | working tree at pin |

## Findings register

| ID | Severity | Mechanism | Status |
|---|---|---|---|
| AF-010-F1 | P2 | Two `allocateCents` primitives with opposite contracts (coerce vs throw) | verified-defect (design) |
| AF-010-F2 | P2 | `utils.parseAmountToCents('(100.00)')` → **+100.00** — parenthesized negative loses its sign | verified-defect |
| AF-010-F3 | P2 | `utils.parseAmountToCents` throws a raw `DecimalError` on malformed text (e.g. `1.2.3`, `1-2`, `--5`) | verified-defect |
| AF-010-F4 | P3 | Non-Latin digits silently become 0; `Infinity` passes through un-integered | verified-defect (edge) |
| AF-010-F5 | P3 | CSV formula guard misses whitespace-prefixed formulas (`" =1+1"`) | verified-defect (edge) |
| AF-010-F6 | P3 | `formatDecimal(Infinity)` renders `"Infinity.NaN"` instead of refusing | verified-defect (edge) |

No GitHub issue covers F1–F6 at the pin (duplicate search against open and closed issues done
2026-10-25). AF-002-F1 (template tax/drop) is recorded separately in the AF-002 document.

## F1 — two allocators, silently different contracts

- `kernel/templates/TransactionTemplates.ts → allocateCents` clamps negative weights to 0, and on
  an all-zero/empty weight set coerces the **entire total onto the first slot**
  (`allocateCents(500,[0,0]) → [500,0]`). Used by posting templates, `paymentService`,
  `allocationLedger` (server), `fx-posting.test.ts` locks the coercion.
- `lib/Allocation.ts → allocateCents` is annotated “Canonical monetary allocation module” and
  instead **throws** on zero total weight, NaN weights or non-safe-integer totals; returns `[]`
  for an empty list. Used by `LedgerEngine`, `billPosting`, `landedCostService`, `billStock`.
- Where both accept the same inputs they agree (asserted for 4 worked shapes plus the random
  property runs), so no current numeric divergence was found — the defect is the contract trap:
  a caller moving between the two gets either an exception or a silent first-slot assignment for
  the same degenerate input. **Architecture shortcut (strategy review):** make one primitive
  accept an explicit on-degenerate policy (`throw | first-slot`) and migrate both call families;
  money code remains AI #1's lane.

## F2 — parenthesized negatives lose their sign

`utils.parseAmountToCents` strips every character outside `[0-9.-]`, so accounting parenthesis
notation disappears: `'(100.00)' → 10000` (positive). The other two amount primitives get it
right: `bankCsvAmountCents('(100.00)') → -10000` and
`TruthEngine.parseAmountToCents('(100.00)') → -10000`.

Blast radius checked at call sites: the guarded bank CSV/OFX paths use `bankCsvAmountCents` or
strict numeric regexes (MT940/CAMT.053 capture `[0-9.,]+` and take direction from a separate
D/C indicator), so statement imports cannot flip sign through this bug. The exposed surface is UI
money fields that import the utils helper (e.g. `FixedAssetsView`, `LoansView`, `ConstructionActions`,
`SpreadDialog`, `UnappliedPayments`, `PettyCashView`) where an accountant typing `(500)` records
+500. Many other dialogs already use `TruthEngine` (which handles parentheses, `CR/DR` suffixes,
unicode minus and arithmetic expressions). Fix direction: route all money inputs through one
parser and add the parens rule; do not change callers' numbers without worked-figure tests.

## F3 — malformed text throws inside render paths

`new Decimal(cleanStr)` throws `[DecimalError] Invalid argument` for `'1.2.3'`, `'1-2'`, `'--5'`,
`'12.34.56'`. Several callers invoke the helper from `useMemo`/render code without a guard
(`CashMovementDialog`, `TransferModal`, `JournalEntryModal` via `TruthEngine` wraps the same class
into an `Integrity Violation` error). A user mid-typing can therefore trip the screen error
boundary instead of seeing inline validation. `TruthEngine.parseAmountToCentsOrZero` shows the
safe pattern. Fix direction: never throw from a render-path parser — return `null`/0 and let the
field's validation message refuse the save.

## F4 — silent zero and non-finite passthrough

- Arabic-Indic digits (`'۱۲۳'`) are stripped to `''` and return 0 rather than being refused or
  converted (Hebrew UI normally uses Western digits, so impact is low).
- `parseAmountToCents(Infinity)` returns `Infinity`, violating the integer-cents contract callers
  assume; unreachable from text input, possible from a corrupted numeric form field.

## F5/F6 — export edge cases

- `sanitizeCsvCell` neutralises cells **starting** with `= + - @ Tab CR`, but a leading space
  (`' =1+1'`) bypasses the guard while the cell is still quoted (quoting alone does not stop
  Excel formula execution). OWASP guidance treats whitespace-prefixed formulas as in scope.
- `formatDecimal(Infinity) → 'Infinity.NaN'`; `NaN → '0.00'` and `-0 → '0.00'` are handled.
- Everything else about the CSV writer is sound: all cells quoted, quotes doubled, line breaks
  kept inside cells, safe-number allowlist preserves real negatives, UTF-8 BOM + Blob download.

## Slice 2 addendum — untrusted-input parsers and ledger predicates (same pinned SHA)

Executed evidence: `src/tests/audit-af010c-expr-csv.test.ts` (3/3).

- **`amountExpression.evaluateAmountExpression`** (the calculator behind money fields): exact
  BigInt rational arithmetic, no `eval`, no identifiers — injection-safe by construction. Bounds
  enforced: 80-char input, parenthesis depth 12, balanced parens, named errors for division by
  zero, malformed decimals, adjacent numbers and truncated expressions; half-away-from-zero
  verified for `±0.005`, `±2/3`. **AF-010-F7 (P3):** beyond `Number.MAX_SAFE_INTEGER` the final
  `Number()` conversion (and the decimal branch's `Number(intPart)`) loses exactness — e.g.
  `'1234567890123456789012345.00'` returns `1.234…e+26`, not integer cents. Unrealistic magnitude
  for money; fix direction is to keep the result on BigInt or refuse non-safe-integer output.
- **`csv.parseCsvChecked`/`parseCsv`:** RFC 4180 core is correct (quoted delimiters/newlines,
  doubled quotes, BOM drop, CRLF, comma/semicolon/tab auto-detection); an unclosed quote refuses
  the whole file and the user-facing `StatementImporter` uses the checked variant. Leniencies
  observed (not defects for current callers): every cell is whitespace-trimmed including quoted
  ones, and a stray quote is treated as a literal. Internal parsers (payroll, price list, Israeli
  bank, import acceptance) use the lenient `parseCsv` and validate downstream.
- **`txFilters.ts`** (`isPostable`, `lineAmount`, `settleHomeCurrency`, date-range and
  inflow/outflow predicates, `calculateFilteredTotals`, `calculateNetIncome`): full body read.
  Void/failed/draft/soft-deleted/year-end/simulation exclusions and closed-period filtering are
  consistent; `lineAmount` prefers persisted `baseAmountCents` and otherwise rounds amount × rate;
  `settleHomeCurrency` puts home-currency rounding on the largest line and refuses multi-rate or
  larger-than-one-cent-per-line gaps (INT-5). The BUG-01/BUG-07 invariants here already have
  executed regression suites (`list-totals-reversal`, `home-currency-balance`); no new defect found.

## Verified-no-finding helpers (executed at the pin)

- **Kernel `allocateCents` sum invariance:** 5,000 random cases incl. negative totals and zero
  weights — parts always sum exactly to the total, integer cents only.
- **`periodLock.ts`:** lock date itself closed, day after open; missing date treated as locked
  (safe direction); inverted exception range unlocks nothing; bookkeeper blocked by soft lock
  while owner/accountant post; `monthEnd`/`dayBefore` leap-year and year-boundary correct;
  `monthCloseState` partial-unlock classification correct.
- **`bankStatementDate.ts`:** rejects 29 Feb 2026, 31 Apr, year <1900, non-integer parts; accepts
  29 Feb 2024. Pure calendar, no clock or time-zone dependency.
- **`allocationLedger.ts` (EG-2):** `splitAllocations` rows sum exactly to both base totals via
  the kernel allocator; per-row realized FX sums to the aggregate FX difference; idempotency keys
  carry actor + payload hash and return the stored result on replay with 409 on in-flight reuse;
  reversals use deterministic `reversal-{id}` rows so a second reversal fails the transaction.
- **`bankCsvAmountCents`:** parentheses, trailing minus, currency symbols, both decimal
  conventions, three-decimal refusal, 13 whole-digit cap and safe-integer check all behave per
  contract (10 worked cases in the test).
- **MT940 / CAMT.053 parsers:** direction comes from the D/C / `CdtDbtInd` marker, never from the
  amount string's sign, so parser quirks cannot flip a bank line's direction; malformed captures
  can't reach `Decimal` because the amount regexes are numeric-only.
