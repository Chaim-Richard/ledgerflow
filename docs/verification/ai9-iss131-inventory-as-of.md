# AI #9 — ISS-131 Inventory Valuation as of a past date from the stock history

GitHub #131. Lane: inventory valuation (`src/lib/inventoryAsOf.ts`, new; the Inventory Valuation screen; a
`totalDisplay` prop on the shared report layout). No server, posting or migration change. The two readings use the
existing `GET /api/v1/reports/inventory-details` (J-10 `itemDetails`).

**Before.** For any date, the stock side was today's quantities × today's average cost, while the books side was as
of the date. In the issue's example, on 30 Sep it showed $300 of stock against $100 of books: a $200 "difference"
that did not exist. The CSV was named for the date but held today's figures.

**Now** (today's date behaves as before; a past date changes):
- **Where the figures come from.** Quantities and values come from the stock-moves ledger. The screen reads it twice,
  from its start to the date and from its start to today. The value is the sum of the moves' own values, so a later
  purchase or cost edit does not change a past figure.
- **When an item's figure is given.** Only when its history explains it: the history starts from zero and ends at
  today's quantity on hand. Otherwise the item is listed as **Unknown** with the reason — stock from before the history
  was kept, stock with no history at all, or a history that does not reach today's quantity — never 0 and never
  today's figure.
- **When the books are compared.** Only when both sides are complete and for the same date. Otherwise the screen says
  why, and the total is labelled "Stock value of the items known on the date". The comparison is also withheld when
  the loaded entries are capped.
- **When the history cannot be read** (e.g. 503, history not set up): "Not available", with no fallback to today.
- **CSV.** It is named `inventory_valuation_as_of_<date>.csv`, the quantity column says the date, and unknown rows
  say "unknown: <reason>". Today's CSV is named for today.

**Worked figures** (`src/tests/iss131-inventory-as-of.test.tsx`, cents). The issue's example:
- 1 Sep: 10 bolts at $10 (10,000). 5 Oct: 10 at $20 (20,000).
- As of 30 Sep: **10 bolts, $100.00, $10.00 each**, beside **$100.00** in the books: they agree.

Nuts (10 at $10, 10 at $20, 5 sold at the $15 average): 15 on hand, value 30,000 − 7,500 = **22,500**.

Unknown cases, each with its reason:
- Washers: history starts at 5.
- Screws: history ends at 6, with 7 on hand.
- Pins: 12 on hand with no history.

A deleted item is still read from its history: screws, 6 at $10.

Not in this change (raised under Messages): `computeInventoryValuation` reads the ledger side from the browser's
loaded entries. When those are capped, the screen now withholds the comparison, but a full-history server figure for
the books (issue point 4) is server work.

Release gate: W13. The valuation on a past date is now truthful; W13 stays Partly (ISS-130, DIM-2).

**Review fixes (#243, merged; follow-up PR from main 9bfccab6).**
1. **Backdated moves.** The past quantity and value are the sums of the moves dated on or before the date, not the
   last-written move's "quantity after". Rods bought 10 + 10, with a sale of 5 written last but dated 15 Sep, are 5
   on 30 Sep (5,000 cents), not 15. Because of this, one reading of the history, to today, is enough; the second
   reading is gone.
2. **A capped item list** withholds the comparison and says why.
3. **A date after today** says there is no valuation for it, and nothing is compared. A cleared date means today.
4. **Export** refuses while the history is still being read or could not be read; no empty file.
5. **A never-moved item at zero today** is zero on the date only when proven: it is a service, it was created after
   the date, or it was created after the stock history began. Otherwise it is unknown.
6. **A deleted item** whose history still holds stock is unknown: the deletion left no move saying when the stock
   went. The merged test that read it as known is updated to match.
