# Provider CSV list imports (E-44 Xero · E-45 Wave · E-46 Zoho Books · E-47 Sage 50)

**Where:** Settings → Import data → **CSV source**. Each provider reader reshapes that product's
export into the app's own columns; the existing `guessMapping` / `prepareImport` / duplicate
review / checked server route then govern everything (rows with problems are named, nothing is
saved until every row is correct, all rows or none). None of the readers validates, posts,
converts money, or stages opening stock from a catalogue export.

**The honesty rule every reader follows:** columns are read **by header name** (alias lists; the
first alias found wins, independent of column order — `columnText` in `src/lib/providerListCsv.ts`).
A file whose headers do not match fails the required-name check rather than being guessed, and an
account type word the shared parser does not know becomes a visible row error, never a silent
reclassification. Balances, YTD figures, exports' "current balance" columns and stock quantities
are never carried.

## E-44 — Xero (chart of accounts, contacts) · `src/lib/xeroChartContactsImport.ts`

- **Chart of accounts** (Accounting → Chart of accounts → Export): keyed columns `*Code`, `*Name`,
  `*Type`, `Tax Code`, `Description` (`*Code` and `Code` are both read — Xero stars required
  columns). `Type` passes to the shared parser; the fixture's Bank, Current Asset, Fixed Asset,
  Liability, Revenue, Depreciation and Equity rows all parse. No YTD figures (Xero's export does
  not carry them and they would not be posted anyway).
- **Contacts CSV** (`*Name`, `EmailAddress`, `POAddressLine1…4`, `POCity`, `PORegion`,
  `POPostalCode`, `POCountry`, `PhoneNumber`, `MobileNumber`, `TaxNumber`) into customers **or**
  vendors — a Xero contacts file is mixed, and the screen's kind choice is the pick; nothing is
  reclassified. `*Name` empty → `FirstName LastName`.
- Invoices and bills are **E-28** (`xeroDocumentsImport.ts`, the Xero panel below the import
  card), so exporting from Xero to here covers: lists (this), documents (E-28).
- Sources (25 Oct 2026): Xero Central "Export or print your chart of accounts"
  (central.xero.com/0/article/Export-or-print-your-chart-of-accounts) and the contacts/chart
  import templates. Fixture-informed, shaped on the documented templates — the honest claim is
  header-name reading of the documented layouts, not "every Xero CSV variant".
- Fixtures: `src/tests/fixtures/xero/chart-of-accounts.csv`, `contacts.csv`.

## E-45 — Wave (customers) · `src/lib/waveImport.ts`

- Wave documents exactly one list CSV: customers (Sales & Payments → Customers → Import or
  Export). Keyed columns: `Customer Name`, `First Name`, `Last Name`, `Email`, `Phone`, `Mobile`,
  `Currency`, `Address line 1/2`, `City`, `State/Province`, `Postal/Zip Code`, `Country`,
  `Account Number`, `Notes`. Name order: Customer Name → Business → person (first last) — Wave's
  own import requires at least one of company/first/last name.
- Scope, said on the screen: Wave has **no vendor CSV export** to key a header read on; a Wave
  chart-of-accounts CSV rides the standard spreadsheet source because the shared parser already
  recognises Wave's account-type names (CE-09/BK-03); Wave's accountants' data download is
  **transactions** — money, deliberately untouched by a list path.
- Source: support.waveapps.com article 208623076 and the Wave Connect upload column set.
- Fixture: `src/tests/fixtures/wave/customers.csv` (US + Israeli rows, Hebrew notes — kept as-is).

## E-46 — Zoho Books · `src/lib/zohoBooksImport.ts`

- Zoho's export is **template-driven** (the user picks fields), so there is no single export
  layout to mirror; the reader keys on **Zoho's documented field names** — the import-sample
  names: `Customer Display Name`/`Vendor Display Name` (Zoho's mandatory field), `Company Name`,
  `Customer Email`, `Customer Phone`, `Payment Terms`, `Currency Code`, `Website`, `Billing
  Address/Street2/City/State/Code/Country` · `Account Name`, `Account Code`, `Account Type`,
  `Description` · `Item Name`, `SKU`, `Description`, `Rate`, `Purchase Rate`, `Reorder Point`.
- Chart types parse through the shared parser (Bank/Cash→Cash; Accounts Receivable/Payable;
  Other Current Asset→asset; Income; Cost Of Goods Sold; Expense). **Zoho-specific types
  (e.g. `Payment Clearing Account`) are refused with the row named** — the preview shows exactly
  which rows need a type chosen, instead of being filed under a guessed category.
- Item `Rate`/`Purchase Rate` → catalogue price/cost; stock quantities are never staged into an
  opening-stock posting (same rule as the QuickBooks Online reader).
- Source: zoho.com/us/books/help/import-export/export.html and contacts/chart-of-accounts help
  pages (25 Oct 2026). Fixtures: `src/tests/fixtures/zoho/{customers,vendors,chart-of-accounts,items}.csv`.

## E-47 — Sage 50 US · `src/lib/sage50Import.ts`

- Sage 50's Select Import/Export writes one CSV per list with documented default names
  (`CUSTOMER.CSV`, `VENDOR.CSV`, `CHART.CSV`, `ITEM.CSV`), and the field lists are published.
  Keyed columns: `Customer Name`, `Bill to Contact First/Last Name`, the `Bill to …` address
  fields, `Telephone 1`, `Customer Email`, `Customer Web Site`, `Inactive` · `Vendor Name`,
  `Address-Line 1/2`, `City`, `State`, `Zip Code`, `Country`, `Vendor Type`, `1099 Type`,
  `Telephone 1`, `Tax ID Number` · `Account ID`, `Account Description`, `Account Type` ·
  `Item ID`, `Item Description`, `Description for Sales`, `Sales Price/Billing Rate 1`,
  `Last Unit Cost`, `UPC/SKU`, `Item Type`, `Minimum Stock`, `Stocking U/M`.
- **The chart's `Account Type` is a documented numeric code** and is translated only through
  Sage's published table: 0=Cash, 1=Accounts Receivable, 2=Inventory, 4=Other Current Assets,
  5=Fixed Assets, 8=Other Assets, 10=Accounts Payable, 12=Other Current Liabilities, 14=Long Term
  Liabilities, 16/18/19=Equity, 21=Income, 23=Cost of Sales, 24=Expenses. **Codes with no
  LedgerFlow equivalent — 3 Receivable Retainage, 6 Accumulated Depreciation (a contra account
  the list import has no concept of), 11 Payable Retainage, and any unknown number — are emitted
  blank so the preview refuses the row with its problem named, never silently reclassified.**
  A hand-made Sage-shaped CSV with a text type still reads.
- `Inactive=True` → `inactive`; `1099 Type` 1 (Interest) or 2 (Misc) → 1099 vendor marked,
  everything else unset. Export-only columns (`Current Balance`, period debit/credit totals,
  receipts) are dropped: a list import carries no figures. Item stock: never staged.
- Source: help-sage50.na.sage.com "Chart of Accounts / Customer / Vendor / Inventory Item List
  Fields (Import/Export)" (2023/2024 help, fetched 25 Oct 2026).
- Fixtures: `src/tests/fixtures/sage/{chart,customers,vendors,items}.csv`.

## Tests

- Lib: `xero-chart-contacts-import.test.ts`, `wave-import.test.ts`, `zoho-books-import.test.ts`,
  `sage50-import.test.ts` — every fixture row's mapping asserted; refusal cases asserted by row.
- Screen: `provider-csv-import-view.test.tsx` — all four sources through the real upload → review
  flow (Sage chart: 10 ready / 1 refused; Zoho vendors; Xero contacts with tax number; Wave
  customers with a Hebrew note).
