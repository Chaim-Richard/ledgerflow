# Xero invoices and bills import (E-28)

Settings → **Import data** → *Xero invoices and bills* reads a Xero **Sales invoices** or **Bills** CSV
into **draft** documents for review. Nothing is sent, approved, paid or posted.

| File | What it does |
|---|---|
| `src/lib/xeroDocumentsImport.ts` | Pure reader: groups line rows into documents, checks every number, returns drafts |
| `src/components/platform/settings/XeroDocumentsImport.tsx` | The panel: type, date order, file, preview, blocked/skipped reasons, "Save N draft documents" |
| `src/tests/xero-documents-import.test.ts` | The reader's worked figures and refusals (9 tests) |
| `src/tests/xero-documents-import-view.test.tsx` | The panel: date order required, preview totals, blocks, the exact saved payload, viewer lock (6 tests) |

## Why a draft posts nothing

`src/services/ledgerPost/invoicePosting.ts` returns before building any ledger line when the status is
`draft` (the same for bills). Saving through the normal entity path therefore writes only the document.
Sending or approving it — a deliberate step in Sales / Bills — is what posts. This is the line E-28 draws
and the tests assert it: every saved payload carries `status: 'draft'` and `posted: false`.

## Columns read (by name, never by position)

| Field | Header names recognised |
|---|---|
| Number | InvoiceNumber · BillNumber · Number · Invoice No |
| Contact | ContactName · Contact · CustomerName · SupplierName |
| Reference | Reference · Ref |
| Date | InvoiceDate · Date · BillDate · IssueDate |
| Due date | DueDate · Due Date |
| Description | Description · LineItemDescription · Item Description · Details |
| Quantity | Quantity · Qty |
| Unit amount | UnitAmount · Unit Price · Rate · Price |
| Account code | AccountCode · Account Code · Code |
| Tax amount | TaxAmount · Tax Amount · VatAmount |
| Tax type | TaxType · Tax Rate (recorded, not used for arithmetic) |
| Currency | Currency · CurrencyCode |
| Status | Status (read only to refuse voided documents) |
| Total | Total · InvoiceTotal · DocumentTotal (checked, never trusted) |
| Discount | Discount (read only to refuse a non-zero one) |

A file without the number, contact, date, due-date, description, quantity, unit-amount and account-code
columns is refused whole, with the missing column named.

**This is not a claim that every Xero CSV variant is supported.** Xero's export columns differ by product
and version; this reads the documented line-item layout. A different layout must be re-exported with these
columns or entered by hand.

## What it refuses, and why

| Refusal | Reason |
|---|---|
| No date order chosen | `01/02/2024` is 1 February or 2 January. The user chooses; nothing is inferred. |
| A date impossible in the chosen order | Reinterpreting it would move money to another period. |
| Two-digit year, `31/02`, a due date before the document date | Not a real document. |
| A row with no invoice number | Nothing to trace, de-duplicate or display. |
| One number under two different contacts | Two documents pretending to be one. |
| A line with no account code | A draft whose line has no account could never be sent. |
| A line outside the workspace chart of accounts | Reported per document; the account is not silently substituted. |
| A contact that is not a customer/vendor here | Reported per document; import the contact list first (Settings → Import data). |
| Missing/zero quantity, negative unit amount or tax | Not a valid line. |
| Three decimals, exponent, unsafe range | Integer cents only. |
| A non-zero discount | The export does not say whether that column is a percentage or an amount. |
| A foreign-currency document in another workspace currency | No conversion is invented on import. |
| A voided document | Not imported. |
| A number already in the books | Skipped with the reason; never duplicated. |
| **A total that disagrees with the lines** | One of the two numbers is wrong, so the document is skipped, not guessed. |

The total check reads the export's own total column in either shape Xero uses: one figure repeated on every
row is a **document total** and must equal net + tax; a different figure per row is a **per-line total** and
must equal that line's net + tax. A column that mixes the two is reported as uncheckable.

## Worked figures (the fixtures, computed by hand)

`sales-invoices.csv` (ILS):

| Document | Lines | Net | Tax | Total |
|---|---|---|---|---|
| INV-1001 | 10 × 150.00 · 1 × 120.50 | 1,620.50 | 275.49 | **1,895.99** |
| INV-1002 | 2 × 800.00 | 1,600.00 | 272.00 | **1,872.00** |
| preview | | 3,220.50 | 547.49 | **3,767.99** |

`bills.csv`: BILL-500 = 3 × 40.00 + 1 × 20.00 → net 140.00, tax 23.80, total **163.80**.

Fractional quantities are exact: `0.3333 × 3.00` → 99.99 cents → **1.00**, rounded half-up once in integers.

## What is saved (the exact record the tests assert)

```
number, customerId/vendorId (+ name), date, dueDate, reference,
amountCents = total including tax, taxAmountCents, taxVersion: 2, lineSumCents = net,
pricesIncludeTax: false, currency, items[{ accountId, description, quantity, rateCents, amountCents }],
status: 'draft', posted: false, metadata: { source: 'xero-csv', importedAt }
```

## Checks run (22 Oct 2026)

- `npx tsx --test src/tests/xero-documents-import.test.ts` — **9/9**
- `npx tsx --test src/tests/xero-documents-import-view.test.tsx` — **6/6**
- the import screens' existing tests — **16/16** (the panel is mounted inside Settings → Import data)
- `npx tsc --noEmit` clean · `npm run lint:eslint` 0 errors / baseline warnings
- quality ratchet unchanged: no new view (`untestedViews` 44), `filesOver800` 0, `arrayIndexKeys` 0

## Not in this change

- Creating customers/vendors or accounts from the same file (E-20 does lists; E-28 deliberately requires
  them to exist first, so one import cannot silently invent a contact).
- Payments, credit notes, journals and attachments from Xero (separate queue items).
- Any Xero API connection; this reads the CSV the user exports.
