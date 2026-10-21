# W5-BS — balance sheet by label (AI #9, 21 Oct 2026)

**What:** a user-facing Balance Sheet for one label value (Reports → Balance Sheet by Label), from the posted lines
that carry that value. Lines with no value for the label, and the accounts' opening balances (which carry no label),
are shown in their own "Not labelled" column with their totals and are never shared out. A value whose sheet does not
balance (an entry labelled on one side only) says so, with the difference.

**Code:** `balanceSheetByLabel` in `src/server/reports/byLabel.ts` (each value read with `getLineDimension`, the
reading Profit by label and the drill-down use; each sheet made by `computeBalanceSheet`, the balance sheet's own
code); route `GET /api/v1/reports/balance-sheet-by-label`; screen `src/components/reporting/LabelBalanceSheetReportView.tsx`.

**Worked figures** (`src/tests/w5bs-balance-sheet-by-label.test.tsx`, cents), AI #3's A-210 ledger:

| 31 Jan | Cash | A/R | A/P | Net tax | Profit | Assets | Liabilities + equity |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 5,185 | 3,704 | 3,334 | 555 | 5,000 | **8,889** | **8,889** |
| B | 8,815 | 6,296 | 5,666 | 945 | 8,500 | **15,111** | **15,111** |

- From the function and from the real route on a test database (accounts and entries stored, `GET` read back).
- Owner pays in 1,000 with no label, plus opening balances Cash 500 / Owner's equity 500 → Not labelled 1,500 = 1,500
  (2 lines, 2 opening balances); A and B unchanged.
- A deposit of 2,000 whose cash line says A and whose A/P line has no label → A 10,889 against 8,889, "does not balance
  by $20.00"; Not labelled A/P 2,000.
- A line labelled C, a draft labelled A and a February entry change none of A's figures on 31 Jan.
- The screen: Cash $71.85; A/P $33.34 | $20.00; Total assets $108.89; Total liabilities and equity $88.89 | $20.00.

**Next:** the browser journey (A-210, AI #3); DIM-3 balancing roles (AI #9).
