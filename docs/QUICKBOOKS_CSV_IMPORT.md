# E-20 — QuickBooks Online list CSV import

From **Settings → Import Data**, choose **QuickBooks Online CSV**, then select **Customers**, **Vendors**, **Items**, or **Accounts** before choosing the exported CSV or Excel file. Review the mapped columns, errors and server dry-run before importing. The existing checked server importer performs duplicate detection, role checks and eligible undo.

Supported source reports:

| Import kind | QuickBooks Online report | Fields mapped |
| --- | --- | --- |
| Accounts | Account List / Account Listing | Account, Number, Type, Detail Type, Description, Currency |
| Customers | Customer Contact List | Customer, Company, Email, Phone Numbers, Billing Street/City/State/ZIP/Country |
| Vendors | Vendor Contact List | Vendor, Company, Email, Phone Numbers, vendor category where supplied |
| Items | Item Listing / Products and Services | Product/Service, SKU, Sales Description, Sales Price/Rate, Purchase Cost, Type |

**Important boundaries:**
- This imports **master records only**, not transactions, invoices, bills, outstanding customer/vendor balances, opening account balances or historical payments. It never treats a QuickBooks account balance as a journal entry.
- Item *Qty on Hand* is intentionally not imported into opening stock. Opening quantity/value and all account balances require a separate reconciliation, not an unreviewed financial entry.
- QBO account **Type** is interpreted through LedgerFlow's existing `parseAccountType` rules; **Detail Type** is retained as a subtype for review. It is not allowed to overwrite fixed Cash/Receivables/Payables accounting categories.
- QuickBooks exports sometimes put a title or blank rows above the header. Remove them so the first spreadsheet row holds column headers. Incorrect/unsupported headers trigger the existing required-field validation; there is no fallback that guesses a chart of accounts from balances.
- Some reports have fewer columns or custom labels; verify the preview and correct mapping as needed. This is a CSV/XLSX list bridge, not the QBO API, a full company migration, or proof that all records were exported.
- On a real migration, import and review accounts first, then contacts, then products/services. Accounts from a different country or configuration may need manual category review.

Official Intuit references:
- https://quickbooks.intuit.com/learn-support/en-us/help-article/list-management/export-reports-lists-data-quickbooks-online/L1xleDrLp_US_en_US
- https://quickbooks.intuit.com/learn-support/en-us/help-article/small-business-processes/move-lists-balances-quickbooks-online-quickbooks/L7pZVGPCE_US_en_US
- https://quickbooks.intuit.com/learn-support/en-us/help-article/migrate-services/move-lists-quickbooks-online/L6v7AmS9l_US_en_US
