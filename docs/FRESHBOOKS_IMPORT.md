# FreshBooks CSV import (E-7)

From **Settings → Import Data**, choose **FreshBooks CSV**, then **Customers**, **Vendors**, or **Items**, and upload its matching export file. Preview mapped columns and errors before the ordinary checked server import. Nothing is posted; this handles master records only, not invoices, expenses, bank activity, account balances, or payments. The existing importer checks duplicates in the file and the workspace, and can undo eligible imported records.

- Clients: company name if present, otherwise first + last name; email, phone, address components, currency and notes when exported.
- Vendors: company or first + last name, email, phone, category. FreshBooks' vendor address columns are not carried into LedgerFlow's existing vendor import schema.
- Items: name, SKU, description, sales Rate, purchase cost, quantity and category if the export includes them. Rate is parsed in cents by LedgerFlow's existing money parser. CSV export variants can have different headings; review preview and correct column mapping before continuing.
- LedgerFlow presently imports items as the existing item record kind; this does **not** automatically activate a service-specific stock policy.

Official FreshBooks instructions:
- https://support.freshbooks.com/hc/en-us/articles/360032628152-How-do-I-export-my-data
- https://support.freshbooks.com/hc/en-us/articles/217181797-What-are-clients
- https://support.freshbooks.com/hc/en-us/articles/360048531852-What-are-vendors
- https://support.freshbooks.com/hc/en-us/articles/360004173612-What-are-items

Use a small sample file first, verify name/amount columns, and do not treat the absence of errors as proof that exports contain every historical record.
