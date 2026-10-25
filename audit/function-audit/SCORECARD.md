# Audit scorecard — independent function-level review (Pass A)

**Latest update:** 2026-10-25 · **Owner:** AI #8 (independent audit, review-only)
**Pinned SHA:** `8df972dad7e9f282fad317e2c1a8939b9ef96aef` (= `upstream/main` at session start)
**Mission:** `docs/INDEPENDENT_AUDIT_AGENT.md` · umbrella issue [#150](https://github.com/shmuelbiller1/ledgerflow/issues/150)

## Coverage (honest counts — indexing is not review)

| Metric | Count | Note |
|---|---:|---|
| Inventory: non-test TS/TSX source files at pin | 1,384 | `find src -name '*.ts*'`, tests excluded |
| Inventory: function-like declarations (simple grep) | ~10,100 | Automatic inventory only, **not** reviewed |
| Prior atlas extraction (older SHA `74b8318`, incl. tests) | 29,662 functions / 121,619 edges | Atlas stats are stale vs this SHA; regenerate before relying on them |
| Functions fully inspected this slice (body + callers + side effects) | **42** | Enumerated below; each has executed or source-pinned evidence |
| Verified defects (open findings) | **7** | AF-001 ×4, AF-002-F1, AF-010 ×6 — see register; AF-001 is one existing issue |
| Verified-no-finding (with executed check) | 15+ helpers | plus 7,000+ property-test cases across allocators/labels |
| DB-gated checks executed here | 0 | No `LF_TEST_DATABASE_URL` in this environment; never claimed as run |

### Inspected functions (slice 1, all at the pinned SHA)

- **Money templates/kernel:** `allocateCents` (kernel), `splitByAccount`, `spreadLabels`,
  `TransactionTemplates.buildInvoiceLines/buildBillLines/buildPaymentLines/buildReversalLines`;
  `allocateCents` (`lib/Allocation.ts`).
- **Amount parsing/export:** `parseAmountToCents` (utils), `TruthEngine.parseAmountToCents`,
  `parseAmountToCentsOrZero`, `bankCsvAmountCents`, `bankCsvDate`, `assertReadableText`,
  `sanitizeCsvCell`, `formatDecimal`, `toCsv`, `csvMoney`, `downloadCsv`.
- **Dates/periods:** `bankStatementDate`; `workspaceRole`, `effectiveLockDate`, `isLockedDate`,
  `postingLock`, `lockMessage`, `assertPostingOpen`, `monthEnd`, `dayBefore`, `monthCloseState`;
  `TruthEngine.resolveEffectiveValue` and its two historical-conversion callers.
- **Bank feed:** `syncAllPages`, the full `POST /sync` route and the link/exchange/reconnect/
  disconnect/banks handlers; `Banking.handleSyncNow`; `BankFeedImport.fetchFromPlaid/handleAutoMap/
  handleConfirm`; `parseMT940Statement`, `parseCamt053Statement`.
- **Server money services:** `allocationLedger.ts` (12 exports incl. `splitAllocations`,
  `recordAllocation`, `reverseAllocation`, `allocationsOf`), payment idempotency wrapper,
  `paymentService.documentLabelWeights/payeeLabels`, `importActions.handleImportTransactions`
  (read), and the posting guards in `invoicePosting.ts` / `billPosting.ts` that bound AF-002-F1.

## Findings register (the accurate list)

| ID | Sev | Finding | Owner lane | Tracked |
|---|---|---|---|---|
| AF-001-F1 | P1 (P0 mechanism) | `/sync` advances `syncCursor` with no durable write of returned rows; route has no `bankLines` access | AI #1 server | issue #151 (re-verified) |
| AF-001-F2 | P1 | Banking “Sync Feed” toasts success but never consumes `transactions/modified/removed` | AI #1/#8 UI | #151 |
| AF-001-F3 | P1 | Plaid `modified`/`removed` never applied; legacy importer hardcodes `accountId:'offset-bank'` | AI #1/#8 | #151 |
| AF-001-F4 | P2 | Healthy zero-change sync answers `success:false` | AI #1 | this audit |
| AF-002-F1 | P2 latent | Template drops non-positive tax/discount legs → unbalanced entry if called with negatives (posting guards block reachability) | AI #1 | this audit |
| AF-010-F1 | P2 | Two `allocateCents` with opposite contracts (coerce-to-first-slot vs throw) | AI #1 | this audit |
| AF-010-F2 | P2 | `utils.parseAmountToCents` loses parenthesized-negative sign `(100)→+100` | AI #1 | this audit |
| AF-010-F3 | P2 | Same helper throws raw DecimalError on malformed text; render-path callers can hit error boundaries | AI #1 | this audit |
| AF-010-F4 | P3 | Non-Latin digits → silent 0; `Infinity` passthrough | AI #1 | this audit |
| AF-010-F5 | P3 | CSV formula guard bypassed by a leading space | AI #8-safe? (lib) | this audit |
| AF-010-F6 | P3 | `formatDecimal(Infinity)` → `"Infinity.NaN"` | AI #1 | this audit |

No P0 is reachable in the **stage-A synthetic beta**: AF-001 needs real bank credentials (excluded
by the stage-A rules), and AF-002-F1 is blocked by the `amount <= 0` posting guards. Stage B (real
bank connections) must close AF-001-F1…F3 first — it is gate G-10.

## Tests actually executed (this environment, no DB)

```sh
NODE_ENV=test SYSTEM_SALT=test-ledgerflow-salt-32b-deterministic npx tsx --test \
  src/tests/audit-af001-plaid-contract.test.ts \
  src/tests/audit-af002-label-cents.test.ts \
  src/tests/audit-af010-money-primitives.test.ts \
  src/tests/audit-af010b-csv-dates.test.ts
# 20 tests, all passing (TAP entries ok 190..209 in the full run)
```

Full gate at the pinned SHA (this branch adds tests/docs only):

- `npm run lint:types` (`tsc --noEmit`): **0 errors**.
- `npm run lint:eslint` (`--max-warnings 105`): **0 errors, 105 warnings** — at cap, new files add none.
- Full unit suite (`npm test`, no `LF_TEST_DATABASE_URL` so DB suites skip):
  **3,785 tests · 3,783 pass · 0 fail · 2 skipped · 880 suites** (the two skips are pre-existing
  database-gated suites, unrelated to this change).
- Exploratory probes (removed before commit): 2,000 random labelled invoices (per-label balance),
  5,000 random allocator cases (sum invariance incl. negatives), 360k document-tax cases vs an
  independent Decimal reference (0 mismatches), parser boundary tables.
- `node scripts/code-atlas.mjs stats` runs clean; its stored revision (`74b8318`) is stale vs the pin.

### Additional observations from slice 1 (no defect without a failing counterexample)

- `calculateDocumentTax` uses float arithmetic for inclusive tax, but an independent Decimal
  reference across 8 rates × 30,000 gross amounts and 4 rates × 30,000 exclusive bases found
  **zero** disagreements; `computeTax` (taxVersion 2) explicitly reconciles the rounding cent so
  gross = net + tax. The two net conventions (`netFromGross` vs gross-minus-tax) can differ by one
  cent on the same gross value, but taxVersion separation prevents mixing them on one document.
- `roundCents` tie behavior matches its “half away from zero” doc (`-2.5 → -3`); `calculateFXCents`
  silently treats a missing/zero/negative rate as 1.0 — callers in posting validate rates first.
- MT940/CAMT.053 direction comes from a separate debit/credit marker, never the amount string.

## Unknowns / not yet reviewed (next batches)

1. **AF-003 statement scope** — issue #141 / A-72 still open (AI #1 reserved): re-verify screen vs
   server JSON vs PDF/export scope once the server change lands.
2. **AF-004 tax fact authority** — `composeFacts/evaluateRules/resolveSellerProfile` graph and the
   IL/US return builders; no function read yet.
3. **AF-005 stock/as-of** — issues #130/#131 open; `cogsStockService`, stock-move history next.
4. **AF-007 report cache** — revocation/freshness and role-revocation-during-TTL.
5. **AF-009 first-hour path** — authenticated browser journey (needs running app + Postgres).
6. Remaining ~99.6% of the function inventory: next batches will walk posting call graphs
   (`postingCore`, shadow check, bulk commit), then report builders, then server routes.
7. Postgres-gated reproductions (issue #151's recipe, RLS, concurrency) remain `needs-reproduction`
   until a database is available in this environment or CI evidence is linked.

## Proposed next 10-function batch

`postingCore` entry builder → `ledgerBulkCommit` idempotency/dedup → posting shadow check →
`reconcileRoutes` match/clear → `bankLineService` → `bankRuleService` → `documentMath.calculateDocumentTax`
→ `cents.roundCents/calculateFXCents` → `currencyMinorUnits.minorUnitRate` → `reportCustomPeriod`.
