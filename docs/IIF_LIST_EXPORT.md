# QuickBooks Desktop IIF list export (E-53)

**Where:** Settings → Backup & Export → **QuickBooks Desktop lists (IIF)**, next to the workspace
ZIP archive. Signed-in workspace **owner** only. Code: `src/lib/iifExport.ts` (writer),
`src/components/platform/settings/IifListExport.tsx` (screen). Import direction: E-29
(`src/lib/iifImport.ts`).

## What it is

One `.iif` file holding the workspace's **lists** for an accountant who still works in QuickBooks
Desktop: chart of accounts, customers, vendors, items. Import it there with
File → Utilities → Import → IIF Files. The lists come from the **verified, checksum-protected
server backup** (`verifiedBackupCollections` in `src/lib/workspaceArchive.ts`, same gate as the
E-21 archive: schema, workspace id, server metadata, SHA-256) — never from the browser cache,
which can be incomplete. A failed or tampered payload produces no file and the reason on screen.

## What is deliberately not in it

- **No transaction sections (`!TRNS`/`!SPL`).** An IIF that carries transaction rows **posts
  money in QuickBooks the moment it is imported**. This export is a list hand-off, not a posting
  path — the same reason the E-29 reader refuses them. Statement-to-statement figures belong to
  the period-based accountant export pack or the workspace archive.
- **No balances and no stock quantities.** A list file posts nothing; carrying balances would
  imply it does. Item sale price and cost are catalogue figures, copied from the item.
- **Archived accounts** (QuickBooks would un-archive them on import without asking), **nameless
  records** (QuickBooks keys lists by name), and **duplicate names** per section (QuickBooks would
  silently merge the second record — the first writing wins). All three are counted and listed on
  the screen after the download, with the reason.

## Structure

Tab-separated, `\n` endings, UTF-8. **IIF has no quoting** (QuickBooks Desktop does not quote), so
tabs, line breaks and control characters inside a name or note are flattened to spaces. Non-English
names (e.g. Hebrew) import on the matching-language QuickBooks Desktop edition.

Sections: `!HDR`, `!ACCNT` (NAME, ACCNTTYPE, DESC, ACCNUM), `!CUST` (NAME, BADDR1, PHONE1, EMAIL,
NOTE, TERMS), `!VEND` (NAME, BADDR1, PHONE1, EMAIL, VTYPE), `!ITEM` (NAME, INVITEMTYPE, DESC,
SALESDESC, PRICE, COST, SKU) — exactly the columns the reader maps. Account-type codes are only
ever codes in the reader's own table (`ACCOUNT_TYPES` in `iifImport.ts`): BANK, AR, AP, CCARD,
FIXASSET, OCASSET, OCLIAB, LTLIAB, EQUITY, INCOME, COGS, EXPENSE — picked by category/subtype
first (a bank that is an asset is BANK, not OCASSET), so an account kept here as a plain asset
becomes Other Current Asset, and a plain liability Other Current Liability. `itemType: 'service'`
writes SERV; everything else INVENTORY.

The round-trip is tested: `src/tests/iif-export.test.ts` builds files from hand-made lists,
compares the exact text, then feeds them to `readIif` and asserts counts, names, type words and
item prices — with nothing refused and nothing reported; `src/tests/iif-list-export-ui.test.tsx`
covers the owner gate, a failed server export (no browser-cache fallback), the downloaded blob
round-trip, the left-out list, and checksum tampering producing no file.

## Limits

- One IIF per download; no date filter (lists have no period).
- Terms are written only when the customer record carries them (`paymentTerms`); the customer
  model does not hold QuickBooks account numbers, so REFNUM columns are not written.
- QuickBooks Online does not read IIF at all — its direction is the QuickBooks Online CSV import,
  or the accountant export pack for figures.
