# EG-2 — a payment ledger: one durable row per allocation, read by statements, aging and realized FX

AI #9, 23 Oct 2026. Status: design (no code). Reviewer: AI #1, before any code. Goes with EG-1 (repost engine:
its `fx-settlement` recomputer reads the interface defined here) and EG-10 (GL vs payment ledger comparison).

## Today

1. **What settled a document is a running total on the document, not a record.** Every settling path adds to
   `amountPaidCents` (and `settledByRecordsCents`) on the invoice or bill and sets `status` from
   `settledStatus` (`src/lib/documentMath.ts`); `calculateAmountDue` = `amountCents − depositAppliedCents −
   amountPaidCents`. Nothing records **when** each part was settled, by **what**, or at **which rate**:

   | Path | Where | What it keeps | What it loses |
   |---|---|---|---|
   | Payment with allocations | `src/server/services/paymentService.ts` `createPaymentInTransaction` (via `createPaymentAtomic`, `createPaymentIdempotent`, `bankLineService.ts`, `onlinePaymentService.ts`) | `payments.allocations[] = {documentId, documentType, amountCents}`; the payment's `date`, `exchangeRate` (= the documents' rate: one payment pays documents of one currency **and one rate**), `paymentExchangeRate`, `realizedFxCents` for the whole payment; the entry's `metadata.ratesUsed` (BM-06: booked rate + cash rate) | the realized FX **per document**; nothing on the document points back at the payment |
   | Unapplied part applied later (BE-12, K-18) | `paymentService.ts` `applyUnappliedPayment` | appends to `payments.allocations[]`, lowers `unappliedCents`; posts a `payment-application` entry (Customer Deposits → A/R) only when the money waited in a separate account, with `metadata.documents` | **the application date** (the allocation row has no `date`; the payment's date is the only one left); no realized FX at all (it clears at the payment's stored rate) |
   | Credit note / vendor credit applied | `src/server/services/creditService.ts` `applyCredit`, `autoApplyCredits` (`planCreditApplications`: oldest first) | `remainingCents` and `status` on the credit; `amountPaidCents` on the document | **which document** the credit went to, the date, and the rate difference: no entry is posted ("a credit already reduced receivables"), so a credit at 1.11 applied to an invoice at 1.10 leaves a base-currency residual in A/R |
   | Credit refunded | `creditService.ts` `refundCredit` | `refundedCents`, an entry dated `input.date` | which cash entry refunded which credit (only via the entry) |
   | Bad debt write-off | `src/server/services/badDebtService.ts` `writeOffInvoice` / `reverseWriteOff` | `writtenOffCents`, `writtenOffAt`, `writeOffTransactionId` on the invoice, counted in `amountPaidCents` | one write-off per invoice only; a reversal zeroes the fields (history only in the audit log) |
   | Estimate deposit on the document | `documentMath.ts` `depositAppliedCents` (`depositCents`) | the deposit, taken off what is due | when it was received |
   | "Mark as paid" in the document | `cashPostedWithDocumentCents` (`amountPaidCents − settledByRecordsCents`) | the amount, posted with the document's own entry | date and rate |
   | Payment void | `src/services/ledgerPost/paymentPosting.ts` (status `void` → reversal entry) | the reversing entry | I found **no server path that lowers the documents' `amountPaidCents`** when a payment is voided; the documents stay paid unless the client does it |

2. **Bank deposits are not settlements.** `src/server/services/depositService.ts` `createDeposit` moves received
   payments from Undeposited Funds to a bank account (`depositTransactionId`, `depositedAt`). It does not touch
   documents and is out of EG-2's scope (except that the ledger row keeps pointing at the payment, not at the
   deposit). **Advances** are the unapplied part of a payment (`unappliedCents`, `advanceAccountId`, BE-12).
3. **Statements** (`src/server/services/statementService.ts` `loadStatement` → `computeStatement` in
   `src/server/reports/computeReports.ts`) list documents by their date, payments by their date **for their full
   `amountCents`**, credits by their date less `refundedCents`. Write-offs do not appear (the invoice stays in,
   so the balance is too high by the write-off), unapplied payments and credits count as if applied, and
   amounts are summed in each document's own currency without conversion.
4. **Aging** (`src/lib/aging.ts` `computePartyAging`, `outstandingBaseCents` = `toBaseCents(calculateAmountDue(doc),
   doc.exchangeRate)`) reads the document **as it is now**. An aging "as of 10-31" run on 11-05 shows an invoice
   paid on 11-02 as nothing owed: there is no as-of aging. `partyStats` is the same.
5. **Realized FX** is one figure per payment (`realizedFxCents = cashBaseCents − baseAmountCents`), with the rates
   in the entry's `metadata.ratesUsed` (BM-06). EG-1 step 3 needs it per document and per allocation, with a date.
6. **No check ties the two together.** Nothing compares Σ settlements with `amountPaidCents`, or the A/R and A/P
   accounts with Σ open documents (`reportTotalExplanations.ts` only explains why they differ). `FOR_YOU.md`
   item 3 and COORDINATION EG-2 / EG-10.

## The goal

Every settlement of an invoice or bill — payment, later application of an advance, credit, write-off, deposit,
manual "paid", and their reversals — is **one immutable row** with its date, amount in the document's
currency, both rates and the realized FX. `amountPaidCents` becomes a cache of Σ rows (checked, never the
source). Statements and aging read the rows, so both are right **as of any date**; EG-1 re-prices settlements
from them; EG-10 reconciles them against the GL.

## The model

### Table `paymentAllocations` (server-only, RLS like `periodBalances` / `stockMoves`)

One row per settlement event. Rows are **never updated or deleted**; a reversal is a new row.

| Field | Meaning |
|---|---|
| `id` | deterministic: `{sourceKind}-{operationId}-{sourceId}-{documentId}` (`sourceId` = the payment or credit, so `autoApplyCredits` applying two credits to one document in one request gets two ids), where `operationId` is a stable id of the settling operation carried in from the request (the payment id; for `applyUnappliedPayment` / `applyCredit` an idempotency key the client sends, stored in `allocationOperations` with the request hash). A retry reuses the key and writes nothing; a second, legitimate application of the same source to the same document has a new key. A count of earlier rows is **not** used: it cannot tell a retry from a second application |
| `workspaceId`, `side` | `receivable` / `payable` |
| `partyId` | customer or vendor |
| `documentType`, `documentId` | `invoice` / `bill` — what is settled |
| `kind` | `payment`, `advance_application`, `credit`, `write_off`, `deposit`, `manual`, `reversal` |
| `sourceType`, `sourceId` | `payment` / `creditNote` / `vendorCredit` / `writeOff` / `document` (deposit, manual) |
| `date` | the **book date of the settlement** (payment date; application date; credit application date; write-off date) |
| `amountCents` | in the document's currency, minor units (BM-04); negative only on `reversal` |
| `currency` | the document's currency |
| `documentRate` | rate the document was booked at (what the settled part is cleared at) |
| `settlementRate` | rate of the settling side: payment day rate (`paymentExchangeRate`), the advance's own rate, the credit's rate, or `documentRate` for write-offs |
| `baseClearedCents` | `round(amount × minorUnitRate(documentRate, currency, baseCurrency))` — what leaves A/R or A/P (`src/lib/currencyMinorUnits.ts`, as `paymentService.ts` does; ¥100 at 0.0067 is 67 US cents, not 1) |
| `baseSettledCents` | `round(amount × minorUnitRate(settlementRate, currency, baseCurrency))` — what the cash / credit / advance carries |
| `realizedFxCents` | side-normalized, gain > 0: `baseSettledCents − baseClearedCents` for `receivable`, `baseClearedCents − baseSettledCents` for `payable` (a bill booked at 1.10 and paid at 1.12 is a loss). Readers label gains/losses from this field alone |
| `transactionId`, `fxLineIndex` | the entry that carries this settlement and (if any) its FX line |
| `reversesAllocationId`, `reversedBy` | reversal links (`reversedBy` is the only field ever set later — see risks) |
| `dateSource` | `recorded` (written live only), or for backfill: `payment-date`, `application-entry`, `write-off-date`, `inferred` |
| `backfillRunId`, `createdAt`, `createdBy` | provenance |

Indexes: `(workspace_id, documentId, date)`, `(workspace_id, partyId, date)`, `(workspace_id, sourceId)`.

**Rounding.** For a payment over several documents the per-row `baseSettledCents` are split by largest
remainder so that Σ rows = the **applied part** of the payment entry's cash line exactly; the same for
`realizedFxCents` against the entry's FX line. The unapplied part (`unappliedCents`, the advance) is not a
document row: its base is `round(unapplied × minorUnitRate(settlementRate, …))`, it carries no realized FX
(nothing is cleared yet), and it is subtracted from the cash line before the split, so each row still equals
`amount × settlementRate` within the largest-remainder cent. A row's figures are never recomputed from rates at
read time.

### Writers (all in the same database transaction as today's document update)

A small module `src/server/services/allocationLedger.ts`:

```
recordAllocation(db, tx, row: NewAllocation): void   // stages the insert; asserts amount ≤ due
reverseAllocation(db, tx, allocationId, date, reason): void
allocationsOf(db, tx, workspaceId, documentId, opts?: { asOf?: string }): Promise<SettlementAllocation[]>
openAmountAsOf(rows, doc, asOf): { cents, baseCents }
```

| Path | Row(s) | Rates | Entry |
|---|---|---|---|
| `createPaymentInTransaction` | one `payment` row per allocation, `date = paymentDate` | `documentRate` = doc rate, `settlementRate` = `paymentExchangeRate` or doc rate | unchanged: the payment entry; FX split per row |
| `applyUnappliedPayment` | one `advance_application` row per allocation, **`date = input.date`** (now stored) | `documentRate` = target doc's rate; `settlementRate` = the payment's rate (what the advance was booked at) | unchanged. **Step 1 refuses** an application to a document whose rate differs from the payment's stored rate (today's entry clears at the payment rate and posts no FX, so row and GL would disagree); in step 2 it is allowed, with the correcting control-account/FX entry (open question 4) |
| `applyCredit`, `autoApplyCredits` | one `credit` row, `date` = new input (default today in the workspace timezone; refused if before the credit's date or the document's date, as for `applyUnappliedPayment` against the payment's date), `sourceId` = credit | credit's rate vs document's rate | **new**: when the base differs, a small `credit-application-fx` entry (A/R ↔ FX) so A/R in the GL clears to zero; nothing when the rates are equal (the common case) |
| `writeOffInvoice` | one `write_off` row, `date` = write-off date, rates = document rate | — | unchanged |
| `reverseWriteOff` | `reversal` of that row | — | unchanged |
| Payment void (new server route, step 4) | a `reversal` row per live row of the payment, date = the void's reversal date (`reversalDate` rule) | same as the reversed row, FX negated | the payment reversal **and a reversal of every `payment-application` entry of that payment** (`metadata.paymentId`, the advance-account → A/R/A/P transfers), same date; in the same transaction each document's `amountPaidCents` and `settledByRecordsCents` are recomputed from the remaining rows, and `status` is re-derived (`paid` / `partially_paid` / `sent` / `overdue` from the new amount and due date), as `reverseWriteOff` does (fixes the gap above) |
| `refundCredit` | none on documents (a refund settles the credit, not a document); it is recorded on a sibling `creditMovements` view in step 6 | | |
| Document deposit / manual "paid" | one `deposit` / `manual` row when the document posts, date = document date | doc rate | unchanged |

`amountPaidCents` stays and is written in the same transaction as the row. **Until the cutover after step 3**
(every source mirrored and backfilled, rows-vs-cache = 0) writers keep today's additive update and only
*assert* it against the rows where a document has no legacy residual; from the cutover it is set from
**Σ non-`deposit` rows** (not `+=`): today it excludes `depositAppliedCents` and `calculateAmountDue` subtracts both, so deposit rows must not
enter it. `settledByRecordsCents` is likewise Σ of rows of kinds other than `deposit` and `manual`. The cache
can't drift. Readers that only need "what is due now" keep reading it.

### The EG-1 interface (what `fx-settlement` reads)

```ts
export interface SettlementAllocation {
  allocationId: string;
  documentId: string; documentType: 'invoice' | 'bill';
  kind: 'payment' | 'advance_application' | 'credit' | 'write_off' | 'deposit' | 'manual' | 'reversal';
  date: string;                    // book date of the settlement
  amountCents: number;             // document currency, signed
  currency: string;
  documentRate: number;            // as booked at the time of the settlement
  settlementRate: number;
  baseClearedCents: number; baseSettledCents: number; realizedFxCents: number;
  transactionId: string | null;    // entry carrying the FX line to reverse and replace
  reversed: boolean;
  dateSource: 'recorded' | 'payment-date' | 'application-entry' | 'write-off-date' | 'inferred';
}
allocationsOf(db, tx, workspaceId, documentId, { asOf? }): Promise<SettlementAllocation[]>
// with asOf: every signed event dated ≤ asOf (originals and reversals, including originals reversed later),
//   so an October query keeps an October allocation reversed in November;
// without asOf: the current live projection (originals not reversed), for EG-1, in date order
liveAllocationsOf(db, tx, workspaceId, documentId): Promise<SettlementAllocation[]>
```

EG-1's recomputer, given a document whose rate or amount changed: for each live row, the new realized FX is
recomputed as above (with `minorUnitRate` and the side sign). Rows are then **grouped by `(transactionId,
fxLineIndex)`**: a multi-document payment has one aggregate FX line, so the line is reversed and replaced
**once** with the recomputed aggregate of every row sharing it (unchanged rows keep their share), on `date` by
EG-1 rule 3; the allocation row gets a `reversal` and a new
row with the new `documentRate` (so the rows always match the GL). **Marking:** `recordAllocation` and
`reverseAllocation` mark nothing; a change of an allocated document's amount or rate (in `commitLedgerBulk`)
marks `fx-settlement` / documentId from `min(row.date)` — EG-1's table, owned there. Rows with
`dateSource = 'inferred'` are listed in EG-1's preview as "date estimated".

### Readers

- **Open amount as of D** = `amountCents@D − Σ rows with date ≤ D` (doc currency); base at the document rate =
  `round(amountCents@D × minorUnitRate(documentRate@D, currency, baseCurrency)) − Σ baseClearedCents`.
  `amountCents@D` / `documentRate@D` / void status are the **document posting version in force at D**: the
  document's entry and any EG-1 correction or void entry dated ≤ D (read from the document's posted entries,
  not the current record), so a correction or void made after D does not change an earlier as-of. Documents
  dated > D are not open at D.
- **Aging** gets `asOf`: `computePartyAging(parties, documents, side, today, allocations?)`. With allocations it
  uses `openAmountAsOf`; without (browser fallback) it keeps today's `calculateAmountDue`. Buckets still from
  `daysOverdue(doc, asOf)`.
- **Statements** read rows: activity = documents by date, **cash** by payment date (full amount, so the customer
  sees what they paid), **credits** by credit date, **write-offs** by write-off date (new line), and the
  allocation rows as a sub-list "applied to" under each payment/credit dated in the period. An allocation
  dated in the period whose parent is outside it (an October advance applied on 11-10) or that has no parent
  line (`manual`, `deposit`, `reversal`) is a **standalone line** on its own date: informational, zero effect
  on the running balance, when its cash was already shown (advance applications); a settlement line that moves
  the balance when the row itself changes it (write-off, manual, deposit, reversal). Unapplied amounts stay visible as
  "unapplied" (balance unchanged: the customer is owed it). The closing balance per currency (one statement
  per currency; a mixed-currency contact gets one section per currency) equals Σ open amounts as of the end
  date − unapplied payments and credits as of that date.
- **Report** `GET /api/v1/reports/payment-ledger?workspaceId&from&to&partyId&documentId`: one line per row with
  source, document, date, amount, both rates, base cleared/settled, realized FX, `dateSource`; totals by party
  and by kind. CSV export like other reports.

### Reconciliation (EG-10, `src/server/services/ledgerHealthService.ts` gains two checks)

1. **Rows vs cache:** for each document, `Σ live rows.amountCents = amountPaidCents + depositAppliedCents` (the
   deposit counted as a row). Any difference lists the document, the two figures and the rows.
2. **GL vs payment ledger at D** (per A/R and A/P account, base currency):
   `s × GL balance(account, D)` (from L-123 `balancesAsOf`, which is debit-positive; `s` = +1 for A/R, −1 for
   A/P, so an unpaid bill of 100 gives +100; every term below is side-normalized the same way)
   `= Σ open documents at D (base at document rate) − Σ unapplied credits at D and unapplied payments **held in the control account itself** at D (base)
     + Σ FX revaluation entries on the account at D` (`fxRevaluationService.ts`, kept as its own line)
   `+ explained other entries` (manual journals to A/R/A/P: listed, not netted).
   Unapplied payments held in a separate advance account (`advanceAccountId` ≠ the control account, e.g.
   Customer Deposits) never touched A/R/A/P and are not subtracted; they are reconciled on that account's own
   line (GL advance account = Σ unapplied held there).
   The report shows each term, the difference, and the entries that make it (manual journals, documents posted
   to another A/R account, inferred backfill rows).

## What moves, in order (each step shippable, each with its tests)

1. **Table and writers, payments only.** Migration `paymentAllocations` (server-only, `lf_guard`, member read),
   `allocationLedger.ts`; `createPaymentInTransaction` and `applyUnappliedPayment` write rows (the latter with
   its `date`); per-row FX split by largest remainder; `amountPaidCents` keeps its additive update (the
   recompute from Σ rows switches on only after step 3).
   - *Test:* a payment over two EUR invoices at 1.12 vs 1.10: Σ row `realizedFxCents` = the entry's FX line; the
     worked example's payment rows.
   - *Test:* `applyUnappliedPayment` on 11-10 for a 10-01 advance: row dated 11-10.
   - *Test:* retrying an idempotent payment writes no second row (deterministic id).
2. **Credits, write-offs, deposits, manual.** `applyCredit` / `autoApplyCredits` take a `date` and write `credit`
   rows; the `credit-application-fx` entry when rates differ; `writeOffInvoice` / `reverseWriteOff` write and
   reverse rows.
   - *Test:* the worked example's credit row: realized gain 1.00 and A/R for the invoice ends at 0.00 in base.
   - *Test:* write off, reverse, write off again: three rows, Σ = one write-off.
3. **Backfill** (below) as an owner-run, resumable job, then the reconciliation check (rows vs cache); once
   it is 0 for a workspace, the cache cutover: `amountPaidCents` / `settledByRecordsCents` are set from Σ rows.
   - *Test:* backfill of the gold ledgers (W1, W3W4, FX, YEAR-END) gives Σ rows = `amountPaidCents` for every
     document, and running it twice writes nothing.
4. **Payment void on the server.** `POST /api/v1/payments/:id/void`: reversal entry (as `paymentPosting.ts`),
   `reversal` rows, reversals of the payment's `payment-application` entries, documents' `amountPaidCents` from Σ rows, `unappliedCents` 0.
   - *Test:* void the 10-15 payment of the example: invoice open €900 again; statement shows the reversal.
5. **Refund movements, then aging and statements read rows.** Dated `creditMovements` (refunds, from
   `refundCredit` and backfilled from its entries) ship **first in this step**: "unapplied credits as of D"
   needs them (a credit refunded in November was still outstanding on 10-31). Then `asOf` aging (server route and `PartyAgingReportView`), statement with
   write-offs, applied-to lines, per-currency sections.
   - *Test:* the worked example's statements and aging at 10-31 and 11-30, run on 12-01.
6. **Report and EG-10 check.** Payment-ledger report, GL vs payment ledger in ledger health.
   - *Test:* a manual journal to A/R shows as an explained difference; a deleted row (forced in SQL) shows as an
     unexplained one.
7. **EG-1 step 3 switches** its `allocationsOf` to this table.

## The backfill

One run per workspace (`POST /api/v1/payment-ledger/backfill`, owner, `dryRun`), chunked by party, resumable by
`backfillRunId`; every row it writes has `backfillRunId` and a `dateSource` other than `recorded`.

| Source | Rows | Date | Recoverable? |
|---|---|---|---|
| `payments.allocations[]` created with the payment | `payment` | payment `date` (`dateSource: payment-date`) | yes; per-row FX split from the payment's `realizedFxCents` by largest remainder; rates from `metadata.ratesUsed` |
| allocations appended by `applyUnappliedPayment` | `advance_application` | the `payment-application` entry whose `metadata.documents` contains the document (`application-entry`); when the advance sat in A/R itself no entry exists → the payment date (`inferred`) | amount yes; **the date is lost when no entry was posted**. Told apart from creation-time allocations by `allocations` beyond the payment's original total (`amountCents − unappliedCents` history is not kept, so the split is by the audit log `PAYMENT_APPLIED` rows when present, else `inferred`) |
| credits applied | `credit` | `inferred`: the later of the credit's date and the document's date | **which document is lost.** Rows only where evidence names the target (an audit-log `CREDIT_APPLIED` entry or a transaction carrying the document id). Matching totals are **not** evidence: `applyCredit` takes an explicit document, so oldest-first replay could invent history. Everything else is an `unmatched` line per party and currency in the report (used credit vs unexplained `settledByRecordsCents`), no guessed rows |
| write-offs | `write_off` | `writtenOffAt` (`write-off-date`) | yes (past reversed write-offs only via audit log; not rebuilt) |
| document deposits | `deposit` | document date (`inferred`) | amount yes |
| manual "paid" (`amountPaidCents − settledByRecordsCents`) | `manual` | document date (`inferred`) | amount yes, date no |
| voided payments whose documents still count them | none; listed as `void-still-applied` for the owner to fix with the step-4 route | | — |

Rows the backfill can't place are not invented: the run's report lists, per document, the residual
`amountPaidCents − Σ rows`; the rows-vs-cache check shows them until fixed. The UI marks inferred dates with
"date estimated" in the report, statements and EG-1's preview.

## Worked example

Books in USD. Invoice INV-1 to Acme, **€1,000.00 at 1.10**, dated 10-01, due 10-31 (base 1,100.00 DR A/R).

| # | Event | Date | Row (kind, amount €) | documentRate | settlementRate | baseCleared | baseSettled | Realized FX |
|---|---|---|---|---|---|---|---|---|
| A1 | Payment PAY-1, €400 received at 1.12 | 10-15 | `payment`, 400.00 | 1.10 | 1.12 | 440.00 | 448.00 | **+8.00 gain** |
| A2 | Credit note CN-1, €100, issued 10-20 at 1.11, applied | 10-20 | `credit`, 100.00 | 1.10 | 1.11 | 110.00 | 111.00 | **+1.00 gain** |
| A3 | Payment PAY-2, €500 received at 1.08 | 11-02 | `payment`, 500.00 | 1.10 | 1.08 | 550.00 | 540.00 | **−10.00 loss** |

EUR and USD both have 2 minor digits, so `minorUnitRate` = the rate; side `receivable`, so gain = settled −
cleared. Net realized FX −1.00. GL entries: PAY-1 DR Bank 448 / CR A/R 440 / CR FX 8 (today's code). CN-1 at issue DR
Revenue 111 / CR A/R 111 (today). Application: **new** `credit-application-fx` DR A/R 1 / CR FX 1 — without it
A/R would hold −1.00 for a paid invoice (today's behaviour). PAY-2 DR Bank 540 / DR FX 10 / CR A/R 550.
A/R: 1,100 − 440 − 111 + 1 − 550 = **0.00**. Σ rows = €1,000 = `amountPaidCents`.

(If CN-1 were at 1.10, A2's realized FX is 0 and no extra entry is posted.)

**Statement at 10-31** (period 10-01 … 10-31, EUR):

| Date | Line | Amount | Balance |
|---|---|---|---|
| 10-01 | Invoice INV-1 | 1,000.00 | 1,000.00 |
| 10-15 | Payment PAY-1 (applied to INV-1 €400.00) | −400.00 | 600.00 |
| 10-20 | Credit note CN-1 (applied to INV-1 €100.00) | −100.00 | 500.00 |
| | **Closing** | | **€500.00** (base at document rate 550.00) |

**Aging at 10-31** (run any day later): INV-1 open €1,000 − (400 + 100) = **€500.00 / 550.00 base**,
due 10-31 → 0 days → **Current**. Today, run on or after 11-02, it shows 0.00 (it reads the document as it is now).
GL check at 10-31: A/R = 1,100 − 440 − 111 + 1 = 550.00 = Σ open documents 550.00 (no revaluation run;
a 10-31 revaluation would be its own line in the check).

**Statement at 11-30** (period 11-01 … 11-30): opening €500.00; 11-02 Payment PAY-2 (applied to INV-1 €500.00)
−500.00; **closing €0.00**.

**Aging at 11-30:** INV-1 open 0 → not listed; Acme total 0.00. GL check: A/R 0.00 = 0.00.

**Payment-ledger report, Oct–Nov:** three rows above; totals: cleared 1,100.00, settled 1,099.00, realized −1.00
(gain 9.00, loss 10.00).

## What does not change

- Payment, credit, write-off and document entries as posted today (except the new small credit-application FX
  entry when rates differ, and the new server void route).
- `amountPaidCents`, `remainingCents` (credits), `unappliedCents`, `settledByRecordsCents` stay on their records
  and keep the same meaning; screens reading "due now" are untouched.
- The rule that one payment pays documents of one currency and one rate.
- Bank deposits (`depositService.ts`), FX revaluation (`fxRevaluationService.ts`), the lock rules.
- `payments.allocations[]` keeps being written (the browser and exports read it); rows are the source of truth.

## Risks and how each is met

| Risk | Answer |
|---|---|
| A writer path forgets a row, cache and rows drift | Every writer goes through `allocationLedger.ts`; `amountPaidCents` is set from Σ rows in the same transaction; the rows-vs-cache check in ledger health; a test enumerates every `amountPaidCents` writer (grep-based guard test). |
| Per-document FX split doesn't add up to the posted FX line | Largest-remainder split against the entry's figures; test with three documents and odd cents. |
| Backfill invents history | Only recoverable facts get `recorded`/`payment-date`; everything else is `inferred` or listed as unmatched, never guessed per document. |
| Immutable rows vs `reversedBy` | `reversedBy` is the only later write, by the server in the reversal's transaction; `lf_guard` blocks browser writes entirely. |
| Credit application now posts an entry (closed period) | Dated the application date; refused in a locked period like any posting (`assertPostingOpen`). |
| Statement totals change for customers who have seen old ones | Only where today's were wrong (write-offs, mixed currency); release note and a "statement changed" line in FOR_YOU. |
| Large parties | Indexed by party and date; statements read one party's rows. |

## Open questions for AI #1 (defaults used if no answer)

1. **Credit application date:** a new input on apply, or always today? *Default: input, defaulting to today* in
   the workspace timezone; `autoApplyCredits` uses today.
2. **Credit at a different rate than the invoice:** post the small FX entry, or require equal rates? *Default:
   post it* (`credit-application-fx`), so A/R clears; nothing when rates are equal.
3. **Statement for a mixed-currency contact:** one section per currency, or convert to base? *Default: one
   section per currency*, base totals shown underneath.
4. **Advance applied later to a document at another rate:** today one rate per payment; should the application
   realize FX between the advance's rate and the document's? *Default: yes, on the application row and entry*
   — step 1 refuses such applications; this lands in step 2 with its entry.
5. **Backfill of applied credits with no matching evidence:** *Decided (review): unmatched*; no oldest-first
   replay, even when the party's totals match.
6. **Payment void:** reversal rows dated the void date, or the payment date? *Default: `reversalDate` rule* (the
   payment's date while open, else today: `reversalDate` in postingCore.ts), same as the reversal entry.
7. **Refunds of credits** as rows in this table or a separate credit-movements view? *Default: a separate dated
   `creditMovements` record, shipped in step 5 before the as-of statement reader*; the table stays about documents.

## Tests (summary)

- Worked example end to end: rows A1–A3 with +8.00, +1.00, −10.00; A/R 0.00; Σ rows = `amountPaidCents`.
- Statements and aging at 10-31 and 11-30, computed on 12-01, give the figures above.
- `applyUnappliedPayment` stores its date; a statement shows the application on that date.
- FX split: Σ row FX = entry FX line, odd cents, three documents.
- Dates: an application dated before its payment/credit or its document is refused.
- As-of with a later correction: an invoice corrected (or voided) on 11-05 keeps its 10-31 aging at the old
  amount and rate.
- Idempotence: auto-apply of two credits to one document writes two rows; retried payment, retried credit application, second backfill: no new rows.
- Void: reversal rows, documents due again, statement shows the reversal.
- Write-off → reverse → write-off: rows net to one write-off; statement shows them.
- Reconciliation: rows vs cache = 0 on the gold ledgers after backfill; GL vs payment ledger = 0 at every month
  end on the FX and W3W4 gold ledgers; a manual A/R journal is listed as an explained difference.
- As-of: an allocation reversed later still counts in an earlier as-of query; JPY→USD rows use `minorUnitRate`;
  a payable paid at a higher rate is a loss.
- EG-1: `liveAllocationsOf` returns live rows in date order; a shared FX line is replaced once; the EG-1 step 3 test (100 EUR @ 1.10 paid @ 1.15,
  rate corrected to 1.12, correction −2.00) passes on these rows.
- Backfill: inferred rows are marked; a party with unmatched credits gets no guessed rows.
- RLS: a browser cannot insert, update or delete `paymentAllocations` (`supabase/tests/rls.test.sql`).
