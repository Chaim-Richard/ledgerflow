# AI #9 — ISS-130 revaluing stock on hand through a balanced entry

GitHub #130. Approved scope (AI #1, 20 Oct evening): one PR with the revaluation route, the ledger posting and the
migration, tested on the local test database; AI #1 reviews it and applies the migration to Supabase.

**Before.** Item unit cost could be edited in the browser even with stock on hand (the inline Unit cost field and
the item form). That changed Inventory Valuation and later cost of goods sold with no ledger entry: in the issue's
example, 10 units bought at $10 and edited to $12 showed $120 of stock against $100 in the books.

**Now.**
- **`POST /api/v1/inventory/revalue`** (owners and accountants) runs `stockRevaluationService.ts`. In one database
  transaction it:
  - checks the open period, the workspace's own accounts (two different ones), that the item belongs to this
    workspace and has stock on hand, and a reason;
  - posts quantity × new cost − quantity × old cost to the Inventory account against the chosen offset account,
    through the ledger door (`TransactionValidator`, `ledgerWrite`);
  - changes the cost;
  - writes a `revaluation` stock move (no units, the value change), so the past-date valuation (ISS-131) includes it
    on its date.
- **Retries.** A request id makes a retry return the first result (`replayed: true`) and post nothing again.
- **Undo.** Revalue back to the earlier cost; both entries stay.
- **Past entries.** Sales posted before keep their cost; nothing posted is touched.
- **Migration** `20261020120000_inventory_cost_server_only.sql` adds a trigger that refuses a browser change to
  `unitCostCents` while `quantityAtHand` is not zero. Server writes are unaffected. An item with nothing on hand keeps
  an editable cost template, and names, prices and other fields stay editable.
- **Screen.**
  - The inline cost of a stocked item is read-only, with a "Revalue <item>" action for owners and accountants.
  - The item form shows the cost read-only with "Revalue cost", and no longer sends the cost, so an ordinary edit
    cannot overwrite the moving average.
  - A new Revalue stock dialog shows the value change before saving, needs a reason, and keeps one request id for
    retries.

**Worked figures** (`src/tests/iss130-stock-revaluation.test.ts`, run on the local test database):
| Case | Change in Inventory |
|---|---|
| 10 widgets, opening at 10.00, revalued to 12.00 | +2,000 (Inventory +2,000, revaluation −2,000) |
| 3 gears, 3.33 → 2.50 | 750 − 999 = **−249** |
| 2.5 rods, 10.00 → 10.01 | round(2,502.5) − 2,500 = **+3** |

For the widgets, Inventory Valuation afterwards shows 10 × 12.00 = 12,000 of stock against 10,000 + 2,000 = 12,000
in the books: difference 0. The stock move records quantity 0 (10 → 10), value +2,000 and the entry id.

A retry with the same request id gives the same entry, no second entry, and the cost unchanged by the retry's own
value.

Refused:
- a bookkeeper or viewer (403);
- another workspace's item (404);
- no stock on hand;
- the same cost;
- an empty reason;
- the Inventory account as the offset;
- a locked period.

None of the refused calls changes anything.

**Browser rule** (`supabase/tests/rls.test.sql`, `npm run test:rules`):
- **Allowed:** setting the cost with nothing on hand; renaming a stocked item.
- **Refused:** a bookkeeper or the owner changing the cost of stock on hand from the browser.

With the trigger dropped, the rule test fails ("expected to be refused, but it succeeded"); with it, all pass.

**Not in this PR:** pre-existing direct cost writes made outside the screens (imports) go through the server's own
paths, which the trigger does not restrict.

Release gate: W13. Cost edits on stock in hand now reach the books; W13 stays Partly (DIM-2, full stock journey).
