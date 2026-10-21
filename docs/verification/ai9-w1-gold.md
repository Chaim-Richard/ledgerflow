# W1-GOLD — the first hour, worked figures (AI #9, 21 Oct 2026)

`src/tests/w1-gold.test.ts`, on a real database (`LF_TEST_DATABASE_URL`), through the app's own code: the chart from
`POST /workspaces/:id/apply-template` ("Creative Project"), the bank's opening balance from
`POST /workspaces/:id/opening-balances`, the customer's and vendor's opening balances as the opening documents the
app makes (`openingBalanceDocument` → `postInvoiceLedger` / `postBillLedger`), the first invoice through
`postInvoiceLedger`, and the P&L, balance sheet and trial balance from their report routes. Cents, books from 2026-01-01:

| Step | Entry |
|---|---|
| Bank opens at 5,000.00 | Main Checking DR 500,000 / Opening Balance Equity CR 500,000 |
| Acme Corp owes 1,200.00 | A/R DR 120,000 / Opening Balance Equity CR 120,000 |
| Paper Co is owed 800.00 | Opening Balance Equity DR 80,000 / A/P CR 80,000 |
| INV-0001, 2 × 150.00, 15 Jan | A/R DR 30,000 / Project Revenue CR 30,000 |

- **P&L January:** income 30,000, expenses 0, net income 30,000 (the opening documents are not income).
- **Balance sheet 31 Jan:** Checking 500,000 + A/R 150,000 = **650,000** = A/P 80,000 + Opening Balance Equity
  540,000 (500,000 + 120,000 − 80,000) + profit 30,000; balanced.
- **Trial balance 31 Jan:** Checking DR 500,000; A/R DR 150,000; A/P CR 80,000; Opening Balance Equity DR 80,000 /
  CR 620,000 (net 540,000); Project Revenue CR 30,000 → **730,000 = 730,000**.

With the browser journey (#282), RELEASE_GATE W1 "Verified" can move to Yes.
