# W3W4-GOLD: worked-figure tests for W3 and W4 (AI #9)

**Task:** W3W4-GOLD (P0, stage A). **Branch:** `ai9/W3W4-GOLD` from main 2cca8686.
**Test:** `src/tests/w3w4-gold.test.ts`, on the local test database (`LF_TEST_DATABASE_URL`).

## What it runs

Both journeys use one business, Cedar Hardware (USD). Checking opens on 2026-04-01 with 5,000.00, already reconciled
in April. Each step goes through the code the app uses:

| Step | Code |
|---|---|
| Accounts, vendors and the customer | `POST /workspaces/:id/import-records` |
| Bills and the invoice | `postBillLedger` / `postInvoiceLedger` (the browser's posting code) |
| Payment run | `billsDueBy` → `paymentPlan` → `recordPayments` (the Payment run dialog's code) → `POST /payments` |
| Vendor statement, A/P ageing | `GET /reports/statement`, `GET /reports/aging`, `computePartyAging` (fixed dates) |
| Bank file | `parseUsBankCsv(…, 'chase-checking')` → `POST /transactions/bulk` with `bankLines` |
| Matching | `POST /bank-lines/:id/pay` (deposit pays the invoice), `POST /reconcile` (ACH to the run), `POST /bank-lines/:id/split` (fee) |
| Reconciliation | `bankClearance`, the general ledger, a `reconciliations` record saved as the Ledger screen saves it, `reconciliationDrift` |

## Worked figures (cents)

**W3.** Bills: A-101 Acme 120,000 (due 1 May), A-102 Acme 80,000 (due 20 May), B-201 Beta 45,000 (due 9 Jun).

- **Ageing on 2026-05-20:** Acme has 80,000 current and 120,000 in 1–30 (A-101 is 19 days late), 200,000 in all. Beta
  has 45,000 current. The total is 245,000, which is also the A/P account balance.
- **Run "due by 2026-05-20", paid 21 May:** one payment to Acme of 200,000 (A-101 + A-102). B-201 waits. The entry is
  DR A/P 200,000 / CR Checking 200,000.
- **Acme's statement:** 0 → 120,000 → 200,000 → 0. Beta's ends at 45,000.
- **Ageing on 2026-06-30:** Beta has 45,000 in 1–30 (21 days late). That equals the A/P balance.

**W4.** INV-501 to Dune LLC is 250,000. Rent cheque #1042 is 30,000, written 30 May and not yet cashed.

- **Bank file:** the fee −3,500 on 31 May, the deposit +250,000 on 25 May, the ACH −200,000 on 21 May. The statement
  ends at 5,465.00.
- **Reconciliation:** beginning 500,000 + cleared (250,000 − 200,000 − 3,500 = 46,500) = 546,500, the statement's
  ending balance, so the difference is 0.
- **Books:** 516,500. Cheque #1042 is outstanding at 30,000, so the bank should show 546,500, which it does.
- **Drift check:** the kept difference is −30,000 (the cheque). A 10.00 entry backdated into May moves it to −31,000,
  and the drift check reports it.

## Results

- `w3w4-gold.test.ts`: 6/6 pass.
- With two expected figures changed by one cent (the 30 May ageing and the book balance), the 2 tests holding them
  fail.
- No product code changed.

## Not covered here

- The bank file goes through the US Chase layout reader. Other layouts (OFX, CAMT.053) have their own tests.
- Withholding at source on a payment run is D-33's goldens.
- The browser journeys are F-42 and F-43 (RELEASE_GATE "Browser").
