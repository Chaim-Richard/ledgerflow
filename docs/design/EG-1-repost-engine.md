# EG-1 — one repost service: recompute what depends on entries after a backdated change

AI #9, 23 Oct 2026. Status: step 1 built (branch ai9/EG-1-S1); revised after the review of PR #348. Reviewer: AI #1, before any code. Goes with L-123 (server balances)
and, later, EG-2 (payment ledger).

## Today

1. **Entries are built once and never recomputed.** Documents post through `postDocument`
   (`src/server/services/documentPostService.ts`) and the builders in `src/services/ledgerPost/*`
   (`invoicePosting.ts`, `billPosting.ts`, `creditPosting.ts`, `paymentPosting.ts`, through `postTxsServerApi` in
   `postingCore.ts`); the server writes them in one transaction in `commitLedgerBulk` (`ledgerBulkCommit.ts`).
   An edit, void or delete reverses the old entries and posts new ones (`deletePostings.ts`; the date comes from
   `reversalDate`: the original's date while open, else today). Closed periods are corrected by "Reverse & Correct"
   (`src/server/routes/transactions/reverseRoutes.ts`, `correctsTxId`). Nothing looks at entries **after** the
   changed one.
2. **Moving-average cost runs in write order, not date order.** `prepareStockMoves`
   (`src/server/services/cogsStockService.ts`) keeps one running `unitCostCents` on the `inventory` document:
   each purchase does `cost = round((max(0, before) × cost + value) / after)` with `before` = quantity on hand
   **now**. `planInvoiceCogs` (`src/services/invoiceCogs.ts`) prices a sale at the item's `unitCostCents` at the
   moment of posting. A bill dated before an earlier-posted sale therefore:
   - blends into today's average (not the average at its date);
   - leaves the earlier sale's COGS entry and its `stockMoves` row untouched.
   **Confirmed: a backdated purchase leaves later COGS wrong.** The worked figures are in step 1 below.
3. **Other things that depend on earlier entries, and what they do today:**

| Dependent | Where | Today after a backdated change |
|---|---|---|
| Stock value, average cost | `cogsStockService.ts`, `stockMoveService.ts` (`writeStockMoves`), `stockRevaluationService.ts` `revalueStock` (ISS-130) | Wrong from the change date on. `stockMoves.quantityBefore/After` of later rows are wrong too. |
| COGS on later invoices / deliveries | `invoiceCogs.ts`, `deliveryService.ts` | Wrong; nobody re-prices them. |
| Payment allocation, realized FX | `paymentService.ts` `createPaymentInTransaction` (`realizedFxCents = cashBaseCents − baseAmountCents`), `applyUnappliedPayment` | If an invoice's rate or amount is corrected after it was paid, the realized gain or loss stays at the old figure. |
| FX revaluation | `fxRevaluationService.ts` `revaluateForeignBalances` / `undoRevaluation` | A revaluation run on a balance that later changed is wrong; only a manual undo and rerun fixes it. |
| L-123 snapshots | `balanceService.ts`, `periodBalances` trigger | Already handled: the trigger marks them stale, the reader skips them, they are rebuilt. |
| Report cache | `reportRoutes.ts` `REPORT_CACHE` (key carries the snapshot checksum) | Open-year entries change the answer but not the key until the TTL ends. |
| Depreciation | `depreciationService.ts` `runDepreciation` (posts "through the month minus what was posted before") | Self-correcting at the next run if cost or in-service date changes, but the catch-up lands in the run month, not in the months it belongs to. |
| Bad debt, prepaid spreads | `badDebtService.ts` `writeOffInvoice`, `prepaidService.ts` `spreadDocument` | Fixed amounts from the document at the time; an edited document leaves them wrong. |

4. **Locks**: `isLockedDate(date, lockDate, lockException)` (`src/lib/periodLock.ts`), `verifyLockDate` in
   `postingCore.ts`, `assertPeriodOpen` (`src/server/db/firestore.ts`), the `requireOpenPeriod` middleware
   (`src/server/middleware/periodLock.ts`), and the reopened range (`lockException`) from `periodRoutes.ts`.
5. **Audit**: `writeServerAuditLog` / `buildAuditLogRecord` (`auditLogService.ts`): action, entity, a description
   and free details.

## The goal

After any change dated before later entries that depend on it, the server knows **what** is now wrong and
**from which date**, shows it, and on request posts the corrections: reversals and replacements (or adjustment
entries), never edits of posted entries, never in a locked period unless a lock exception covers it, with an
audit record of every figure before and after. Running it twice posts nothing the second time.

## The model

### A dirty mark per dependent, with its first affected date

A new server-only table **`repostQueue`** (RLS like `stockMoves` and `periodBalances`): one document per workspace,
**kind** and **key**.

| Field | Meaning |
|---|---|
| `workspaceId`, `kind`, `key` | what to recompute: `stock-cost` + itemId; `fx-settlement` + documentId; `fx-revaluation` + accountId; `depreciation` + assetId; `spread` + documentId; `bad-debt` + invoiceId |
| `fromDate` | the earliest book date affected among the causes still outstanding (`min(old, new)` while dirty; a clean row dirtied again starts from the new cause alone) |
| `cause` | the entry ids and document that made it dirty (capped list, newest 50) |
| `status` | `dirty` → `running` → `clean` (or `blocked`: needs a locked period) |
| `blockedBy` | the lock date, when the earliest correction would land in a locked period |
| `markedAt`, `runId`, `lastRunAt` | for the UI and for resuming |

### What marks what (detection)

Marking runs **in the same database transaction** as the change. For stock it is a database trigger on
`stockMoves` (`lf_repost_mark`, security definer), the one boundary every stock-writing path shares:
`commitLedgerBulk` (`prepareStockMoves`), `adjustStock`, manual cost of goods in `inventoryRoutes.ts` and
`revalueStock` all write their own moves in their own transactions, so a hook in `commitLedgerBulk` alone would
miss them (review of PR #348).

| Change | Marks | First affected date |
|---|---|---|
| Any stock move for an item (purchase, sale, delivery, return, adjustment, manual cost of goods, revaluation, or their reversals; not the repost's own `cost-repost` rows), dated D, with any `stockMoves` row for that item dated > D. An outbound move changes the quantity later purchases average over, so it counts too. (= D is not marked: ties replay in write order, so a same-day move written last changes nothing.) | `stock-cost` / item | D |
| An invoice or credit note amount or rate changed (reversal + replacement) and it has payments | `fx-settlement` / document (also `bad-debt` if written off, `spread` if spread) | the earliest payment date (or write-off / spread start) |
| An entry on a foreign-currency account dated ≤ a revaluation date of that account | `fx-revaluation` / account | the first revaluation date ≥ D |
| Asset cost, in-service date or method changed | `depreciation` / asset | the in-service month (or the change date if later) |
| An entry in a closed year | nothing new: the L-123 trigger marks `periodBalances` stale | `asOf` ≥ D |

The check "is there a later move?" is one query on the item's `stockMoves` rows (index `(workspace_id, itemId,
seq)`); when none, nothing is marked (the common case: moves dated today).

### The repost run

`POST /api/v1/repost` (`{ workspaceId, kinds?, keys?, runId }`), owner or accountant. Server-side only, in a new
`src/server/services/repostService.ts` with one **recomputer** per kind:

```
recompute(db, t, ws, key, fromDate) → { corrections: PostableTransaction[], stateWrites, before, after }
```

1. **Replay from `fromDate`.** The recomputer reads the state at `fromDate − 1` and replays every relevant entry
   in date order (ties: `date`, then the `stockMoves.seq` / `createdAt` of first writing), computing what each
   dependent figure *should* have been.
2. **Compare with what was posted.** For each dependent entry whose figure differs, it builds a correction.
   - "What was posted" is the original entry **plus every live earlier repost adjustment** with the same
     `correctsTxId`; only the remaining difference is posted (50 → 75, then a target of 80 posts 5, not 30).
   - Corrections are new entries written in the **key's own transaction** (one transaction for the corrections,
     the item state, the queue row and the audit row), through `ledgerWrite` and `TransactionValidator`, with the
     lock rule below; the snapshot trigger applies as to any entry. `commitLedgerBulk` opens its own transaction, so
     it is not used for corrections. Either an adjustment entry for the difference, or a reversal of the old entry
     plus a replacement, per kind (below). **No posted entry is ever updated.**
   - A correction copies the corrected entry's accounts and dimension labels (project, location, …), each line
     scaled by the difference, so margin-by-label reports and required-label rules hold.
   - Each correction carries `metadata.repostRunId`, `metadata.repostKind`, `metadata.correctsTxId` and a
     deterministic id `repost-{kind}-{key}-{correctsTxId}-{n}`, where `n` counts earlier corrections of that entry.
3. **Dating rule** (same as `reversalDate` in `postingCore.ts`): a correction is dated on the **date of the entry it
   corrects** when that day is open (or inside a lock exception); otherwise **today**. This keeps each month's
   margin right while the month is open, and puts closed-period differences into the current period, as Reverse &
   Correct does.
4. **Locked periods.** If replay starts in a locked period, the recomputer still replays from there (the figures
   must be right), but every correction for a locked date is moved by rule 3 to today, and the
   queue row says so. If the owner sets `strictLock` on the run, the run refuses instead (status `blocked`,
   `blockedBy` = lock date) and posts nothing. Item state writes (`unitCostCents`) are never dated, so they always
   apply.
5. **Transactions and chunks.** One recomputer key = one database transaction (state read, corrections posted,
   state written, queue row set to `clean`, audit row). A run over many keys is a list of these, resumable by
   `runId`: a retry skips keys already `clean` for that run. A key with more than 2,000 dependent entries is
   split by month: each month is its own transaction and moves `fromDate` forward on success.
6. **Idempotent.** The deterministic ids mean a retried chunk finds its entries and posts nothing; a second run
   after success finds no difference and posts nothing. The queue row is only set `clean` in the same transaction
   as the corrections.
7. **Concurrency.** Step 1 relies on the key's SERIALIZABLE transaction: a posting that marks the same key while
   the run reads it conflicts, one side retries, and the key is dirty again for the next run. (The `running` lease
   of 5 minutes is needed once a key spans several month transactions.)
8. **No opening basis.** `stockMoves` were not backfilled. When an item's kept history does not start from zero
   (its first move's `quantityBefore` ≠ 0: stock from before the history, with no opening average), the item is
   **refused** ("history incomplete", `blocked`, `blockedBy: 'history-incomplete'`) rather than given an invented
   average. A later step may seed it from an explicit opening valuation.
9. **Stale quantities.** The stored `quantityBefore/After` of a move are those of the moment it was written. Readers
   that show a day's stock (`itemDetails`, `stockAging` in `src/lib/stockMoves.ts`) derive the quantities in date
   order from the moves' deltas (`datedMoves`), so "as of 01-07" counts a backdated bill on its own date. The
   stored rows are not rewritten.

### The audit record

One `auditLogs` row per key per run, `action: 'repost'`, `entityType: kind`, `entityId: key`, with details:

```
{ description, runId, fromDate, cause: [entryIds], lockDate, movedToOpenDay: bool,
  corrections: [{ entryId, correctsTxId, date, account, beforeCents, afterCents, deltaCents }],
  state: { before: { unitCostCents, quantityAtHand, inventoryValueCents }, after: {...} } }
```

and one summary row per run (`entityType: 'repostRun'`): keys done, entries posted, total moved per account.

### The UI

- **Banner** on the dashboard, the Inventory list and the affected report screens: "3 items and 1 payment need
  reposting after changes dated before later entries. [Review]" (reads `GET /api/v1/repost/queue`).
- **Review page** (Settings → Books → Repost): one row per queue entry: what, from which date, why (link to the
  cause entries), and a **preview**: the run in dry-run mode (`?dryRun=1` returns the corrections without posting:
  before, after, delta, date, and whether it lands on today because of a lock).
- **Run** button for owners and accountants (all, or selected rows). Afterwards the row links to the posted
  corrections and the audit record.
- Reports read normally; a report whose range includes a dirty key shows a small "repost pending" note.

### How it relates to L-123 and EG-2

- **L-123:** corrections are ordinary entries, so the `periodBalances` trigger already marks snapshots stale
  when a correction lands in a reopened range; a run ends by asking `balanceService` to rebuild stale snapshots
  of that workspace (it does this in the background anyway). The **report cache** key gains a workspace
  `ledgerVersion`, bumped at a shared boundary (a database trigger on `transactions`, like the `periodBalances`
  stale mark), not only in `commitLedgerBulk`, since other paths write entries too; this also fixes the open-year
  staleness noted above.
  `repostQueue` and the snapshot staleness share one rule: *dirty from the earliest date, rebuilt forward*.
- **EG-2 (payment ledger):** `applyUnappliedPayment` stores no per-allocation date, so the `fx-settlement`
  recomputer is deferred to EG-2, which owns dated allocation rows. Today allocations live on payments and documents. The `fx-settlement` recomputer
  is written against a small interface (`allocationsOf(documentId)`: date, cents, rate) that today reads
  `paymentService` data and later reads EG-2's allocation rows; EG-2 then owns marking (an allocation change
  marks the document).

## What moves, in order (each step shippable, each with its tests)

1. **Stock cost after a backdated purchase (the first step).**
   - `repostQueue` migration and the marker in `commitLedgerBulk` for `stock-cost` only.
   - `repostService.ts` with the `stock-cost` recomputer, `POST /api/v1/repost` (with `dryRun`),
     `GET /api/v1/repost/queue`.
   - Replay: every `stockMoves` row of the item, in date order (from zero: see rule 8), recomputing the average and
     each sale's cost; a customer return (`credit-return-auto`, which comes back at its sale's cost,
     `planReturnEntries`) is revalued at its sale's replayed cost (DR Inventory / CR COGS for the difference), so
     Inventory ends at quantity × replayed average; returns whose sale is not in the replay, and delivery returns,
     are listed, not corrected. Each sale (`invoice-cogs-auto`, `delivery-cogs-auto`) dated ≥ `fromDate` whose cost
     differs gets one
     adjustment entry: DR COGS / CR Inventory (or the reverse) for the difference, `metadata.type:
     'repost-cogs-adjust'`, no quantity, so `prepareStockMoves` moves no units. A `stockMoves` row of kind
     `cost-repost` (quantity 0, value = delta) keeps the stock ledger equal to the Inventory account. The item's
     `unitCostCents` is set to the replayed average.
   - **Worked figures** (one item, all periods open):

     | Posted (write order) | Date | Qty | Today's average | COGS posted |
     |---|---|---|---|---|
     | Bill A: 10 @ 10.00 | 01-05 | +10 | 10.00 | |
     | Invoice: 5 sold | 01-10 | −5 | 10.00 | 50.00 |
     | Bill B (backdated): 10 @ 20.00 | 01-03 | +10 | (5 × 10 + 200) / 15 = 16.67 | |

     Today the ledger shows Inventory 250.00 (100 + 200 − 50) for 15 units at 16.67, COGS 50.00.

     Replay in date order: 01-03 10 @ 20.00 → 01-05 20 units, (200 + 100) / 20 = **15.00** → 01-10 sale of 5 at
     15.00 = **75.00**. Remaining 15 units at 15.00 = 225.00.

     The repost posts one entry **dated 01-10** (the sale's date, open): DR COGS 25.00 / CR Inventory 25.00,
     `correctsTxId` = the invoice's COGS entry. After it: COGS 75.00, Inventory 225.00 = 15 × 15.00,
     `unitCostCents` = 1500. If 01-10 were locked, the same entry would be dated today.
   - **Why this rule:** dated on the sale's day, January's gross margin is right (the point of the correction);
     an adjustment rather than a reversal + replacement keeps the sale's stock move untouched (reversing a COGS
     entry would put units back through `putBack` and take them out again: two extra moves per sale and a
     re-check of below-zero stock for no change in quantity). Closed days fall back to today, the
     same rule as `reversalDate` (today) and Reverse & Correct.
   - *Test:* the figures above, end to end through `commitLedgerBulk`: queue row marked at Bill B; dry run shows
     +25.00; run posts it; second run posts nothing; retry of the same `runId` posts nothing.
   - *Test:* locked 01-10: the correction is dated today; `strictLock` refuses.
   - *Test:* review findings: a backdated sale marks and is repriced; a second backdated bill posts only the
     remaining difference; no opening basis is refused; "as of 01-07" shows 20 units; the correction keeps the sale's
     labels; a customer return is revalued and Inventory = quantity × average.
   - *Test:* stock ledger value (Σ `stockMoves.valueCents`) = Inventory account balance after the run, on the gold
     stock ledgers; sales below zero (no average) are reported, not corrected (open question 3).
2. **Report cache and snapshots.** `ledgerVersion` in the cache key; a run ends with a snapshot rebuild request.
   - *Test:* a report read, an open-year entry posted, the same report read again shows the new figure at once.
3. **FX settlement** (after EG-2: allocations need their own dates). `fx-settlement` recomputer: realized
   gain/loss per allocation against the document's corrected base amount; correction = a targeted A/R ↔ realized
   FX adjustment entry, on the payment date by rule 3. The payment entry is not reversed and replaced: that would
   break its bank matches.
   - *Test:* invoice 100 EUR @ 1.10 paid @ 1.15 (gain 5.00), rate corrected to 1.12 → gain 3.00, correction −2.00.
4. **FX revaluation.** `fx-revaluation` recomputer with its own correction logic: undo-then-rerun does not work
   today, since `revaluateForeignBalances` refuses a same-date revaluation once the earlier one carries a
   `reversalEventId`. It computes the revaluation the corrected balance needs at each affected date ≥ `fromDate` and
   posts the difference.
   - *Test:* a backdated foreign bill before a month-end revaluation: the rerun equals a fresh revaluation.
5. **Depreciation, bad debt, prepaid spreads.** Recomputers that diff the schedule against posted entries and
   post month-by-month corrections in open months (closed months go to today).
   - *Test:* asset cost corrected from 1,200 to 1,800 after three monthly runs: three corrections in their own
     months (when open), not one catch-up.
6. **UI.** Banner, review page with dry run, run button, report note.
   - *Test:* component and route tests; an employee cannot run or see the preview.

## What does not change

- How documents are built and posted (L-94), and the reversal rules in `prepareStockMoves`.
- Posted entries: never updated by a repost.
- The lock, `lockException` and who may reopen a period.
- `revalueStock` (ISS-130) as a manual tool; a revaluation is just another stock move the replay honours (it sets
  the average from its date).
- L-123's snapshot rule and trigger.

## Risks and how each is met

| Risk | Answer |
|---|---|
| A repost changes closed books | It never dates an entry in a locked period without a lock exception; it moves the correction to today, or refuses under `strictLock`. |
| A run fails half-way | One key (or one month of a key) per transaction; resume by `runId`; deterministic ids. |
| Two runs at once | Lease on the queue row; a second run skips a `running` key. |
| Corrections cascade (a COGS change changes nothing else) | COGS adjustments carry no quantity and do not mark `stock-cost`; corrections from a run are excluded from marking. |
| Replay differs from the original because of rounding | Replay uses the same formula and rounding as `prepareStockMoves` (one shared function, extracted in step 1); a test replays the gold ledgers with no backdating and expects zero corrections. |
| Large items (thousands of sales) | Month chunks; dry run shows the count before running. |
| Sales below zero (no meaningful average) | Not corrected; listed in the preview as "needs a stock count". |
| Silent dirtiness | Banner, report note, and ledger health (`ledgerHealthService.ts`) lists keys dirty for more than 7 days. |

## Open questions for AI #1 (defaults used if no answer)

1. **Run automatically, or only on an owner's click?** *Default: owner's click* (with a dry-run preview). An
   automatic run after each backdated bill can follow once step 1 has run in practice.
2. **Correction date when the corrected entry's day is open: that day, or today?** *Default: that day* (the
   `reversalDate` rule), so each month's margin is right; a locked day falls back to today, as `reversalDate` does.
3. **Sales below zero:** correct them at the next purchase's cost, or leave them? *Default: leave them* and list
   them for a stock count.
4. **Locked period without an exception:** move to today, or refuse? *Default: move*, with
   `strictLock` per run to refuse instead.
5. **COGS: adjustment entry or reversal + replacement?** *Default: adjustment entry* (no stock moves), for the
   reason given in step 1. FX settlement also uses a targeted adjustment (A/R ↔ FX), so the payment and its bank
   match stay as they are.
6. **Who may run it?** *Default: owners and accountants*; employees see the banner only.

## Tests (summary)

- Step 1 worked figures: +25.00 dated 01-10; COGS 75.00, Inventory 225.00, `unitCostCents` 1500.
- Idempotence: a second run and a retried `runId` post nothing; deterministic ids.
- Locks: correction moved to today; `strictLock` refuses; a lock exception lets it land in place.
- No false positives: replaying the gold ledgers without backdating posts zero corrections.
- Stock ledger = Inventory account after every run.
- Marking: every posting path through `commitLedgerBulk` marks; a purchase dated today with no later moves does not.
- Audit: one row per key with before, after and every correction; one summary row per run.
- L-123: a correction in a reopened range marks the snapshot stale and the rebuild matches a full recompute.
- RLS: a browser cannot write `repostQueue` (`supabase/tests/rls.test.sql`).
