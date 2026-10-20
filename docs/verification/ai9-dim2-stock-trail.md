# DIM-2 phase 1: where stock came from and where it went (AI #9)

**Task:** DIM-2 (GitHub #132), phase 1 of 4. **Branch:** `ai9/DIM-2` from main 2cca8686. **Read-only:** nothing is
written, there is no migration and no second ledger.

## What changed

- **`src/lib/stockTrail.ts` (pure).** It follows each stock move to its document and the party on that document:

  | Move | Document | Party |
  |---|---|---|
  | Purchase | its bill, plus the purchase order the bill was made from and that order's goods receipts | vendor |
  | Sale | its invoice, or for a delivery the sales order named on the delivery's entry | customer |
  | Customer return | its credit note | customer |
  | Sent back to the vendor | its vendor credit | vendor |
  | Opening stock, imports | none | "Origin not recorded"; never given a vendor |
  | Adjustments, counts, moves between locations | none | "Inside the business" |

- **Missing links are named:**
  - no document is linked;
  - the document is not in the books;
  - the document names no vendor or customer;
  - a delivery names no sales order.
- **Capped or still-loading document lists.** A document that cannot be found is "not among the documents loaded"
  rather than "not in the books".
- **Stock history window** (`StockHistoryDialog.tsx`): a new "From / to" column, plus a summary of how the units came
  in. The column goes after "Value" so the existing row checks keep their order.

## Worked units (`src/tests/dim2-stock-trail.test.ts`)

Widget had 4 on hand when the history began.

| Change | Units | Document | Party |
|---|---:|---|---|
| Bought | +10 | bill B-1 (from PO-7, received GR-1) | Acme |
| Sold | −3 | INV-1 | Dune |
| Delivered | −2 | order SO-1 | Elm |
| Returned | +1 | CN-1 | Dune |
| Bought | +5 | bill B-9, which is not in the books | missing link |
| Opening stock | +6 | — | not recorded |
| Adjusted | −1 | — | inside the business |
| Sent back | −2 | VC-1 | Acme |

On hand: 4 + 10 − 3 − 2 + 1 + 5 + 6 − 1 − 2 = 18.

- **Units in:** 11 recorded (10 + 1). 10 have no recorded origin (4 before the history + 6 opening). 5 have a missing
  document.
- **Units out:** 7 recorded (3 + 2 + 2). 1 inside the business.

## Results

- `dim2-stock-trail.test.ts` 4/4 and `dim2-stock-trail-dialog.test.tsx` 1/1 pass.
- The existing `stock-moves.test.tsx` and `stock-locations.test.tsx` pass unchanged.

## Next phases (#132)

2. Save the source document line ids and the supplier when goods are received.
3. Record destination labels and purpose on each move.
4. The reconciliation report.
