# QuickBooks Desktop IIF import (E-29)

Settings → **Import data** → *CSV source* = **QuickBooks Desktop IIF** reads the `.iif` file QuickBooks
Desktop writes (File → Utilities → Export → Lists) into the **existing** validated import flow — the same
preview, column mapping, server-side checks and undo as every other list import.

| File | What it does |
|---|---|
| `src/lib/iifImport.ts` | Pure reader: sections → the app's own import tables |
| `src/components/platform/settings/ImportSettings.tsx` | The *IIF* source, the `.iif`/`.qbi` file path, and the panel that reports what was read and what was refused |
| `src/tests/iif-import.test.ts` | Reader + shared-importer tests (6) |
| `src/tests/iif-import-view.test.tsx` | Screen tests (4) |
| `src/tests/fixtures/iif/lists.iif` | One file holding all four list sections **and** a journal |

## What is read

| IIF section | Fields used | Import type |
|---|---|---|
| `!ACCNT` | `NAME`, `ACCNUM`, `ACCNTTYPE`, `DESC` | Accounts |
| `!CUST` | `NAME`, `EMAIL`, `PHONE1`, `BADDR1…5`, `NOTE`, `TERMS` | Customers |
| `!VEND` | `NAME`, `EMAIL`, `PHONE1`, `VTYPE` | Vendors |
| `!ITEM` | `NAME`, `SKU`, `DESC`/`SALESDESC`, `PRICE`, `COST`, `INVITEMTYPE` | Items |

The QuickBooks account-type codes are translated to the words the shared parser already understands, so
one validation rule set covers both paths:

`BANK`→Bank · `AR`→Accounts Receivable · `AP`→Accounts Payable · `OCASSET`→Other Current Asset ·
`FIXASSET`→Fixed Asset · `OASSET`→Other Asset · `CCARD`→Credit Card · `OCLIAB`→Other Current Liability ·
`LTLIAB`→Long Term Liability · `EQUITY`→Equity · `INCOME`→Income · `COGS`→Cost of Goods Sold ·
`EXPENSE`→Expense · `OTHINCOME`→Other Income · `OTHEXPENSE`→Other Expense.

## What is refused — and why it matters

| Refused | Reason |
|---|---|
| **`TRNS` / `SPL` records** (journals, invoices, bills, payments) | A list import must never post money. They are counted and the screen says how many were left out. |
| A row before its `!SECTION` column header | Its fields cannot be read; reported with the line number. |
| A row with no `NAME` | Nothing to identify or de-duplicate. |
| An account with an unknown `ACCNTTYPE` | Guessing an account type would change every report that reads it. |
| A file with no `!HDR` and no list section | Not an IIF; refused whole rather than half-read. |
| Sections this import does not handle (`!CLASS`, `!BUD`, …) | Named once on screen, not imported. |

**On-hand quantity is deliberately left blank.** An IIF list carries no reliable stock figure, and a list
import must not invent one (the same rule the QBO path follows).

## Worked figures (the fixture, checked by hand and by the tests)

`lists.iif`:

| Section | Imported | Refused |
|---|---|---|
| Accounts | 5 — Checking 1010 (Bank), A/R 1100, A/P 2000, Consulting Income 4000, Office Costs 5000 | 1 — `Ask Me Later` with type `WEIRDTYPE` (line 8) |
| Customers | 2 — Acme Ltd (Net 30), Beta Co (Net 15) | 1 — a row with no `NAME` (line 12) |
| Vendors | 1 — Office Supplies Ltd | — |
| Items | 2 — Consulting hour 150.00; Paper box 40.00 price / 25.00 cost | — |
| Transactions | 0 | 2 records — one `TRNS`, one `SPL` |

The tests then run those tables through the **shared** `guessMapping` → `applyMapping` → `prepareImport`
chain and assert the prepared records: `Checking` → asset, `Accounts Payable` → liability,
`Consulting Income` → revenue, `Office Costs` → expense; `Consulting hour` → 15000 / 0 cents with no
stock; `Paper box` → 4000 / 2500 cents with no stock.

## Checks run (22 Oct 2026)

- `npx tsx --test src/tests/iif-import.test.ts` — **6/6**
- `npx tsx --test src/tests/iif-import-view.test.tsx` — **4/4**
- `npx tsc --noEmit` clean · `npm run lint:eslint` 0 errors / baseline warnings
- quality ratchet unchanged: no new view (`untestedViews` 44), `filesOver800` 0, `arrayIndexKeys` 0
- no posting code, no `src/server/` change, no migration, no money arithmetic

## Not in this change

- IIF **transactions** (journals, invoices, bills, payments) — deliberately out of scope here; they belong
  to the document paths with their own validation and posting.
- Attachments, price levels, employees, classes/locations.
- Any claim that every QuickBooks edition's IIF variant is supported: the reader follows the documented
  section/column vocabulary and refuses what it cannot map.
