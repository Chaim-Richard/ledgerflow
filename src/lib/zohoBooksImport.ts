/**
 * E-46: Zoho Books CSV exports → the app's own import columns.
 *
 * Zoho's export is **template-driven** (Settings → Export Data, or the per-module Export
 * Customers/Vendors/Items/Chart of Accounts): the user picks the fields, so no fixed export
 * layout exists to mirror. This reader keys on the field names Zoho documents for customers,
 * vendors, chart of accounts and items — the same names its import sample files use:
 * - Customers/vendors: `Customer Display Name` / `Vendor Display Name` (Zoho's own mandatory
 *   field), `Company Name`, `Customer Email` / `Vendor Email`, `Customer Phone` / `Vendor Phone`,
 *   `Payment Terms`, `Currency Code`, `Website`, and the `Billing Address`, `Billing Street2`,
 *   `Billing City`, `Billing State`, `Billing Code`, `Billing Country` address fields
 *   (zoho.com/us/books/help/contacts/, …/import-export/export.html).
 * - Chart of accounts: `Account Name`, `Account Code`, `Account Type`, `Description`.
 * - Items: `Item Name`, `SKU`, `Description`, `Rate`, `Purchase Rate`.
 *
 * Honesty rules: everything is header-name keying; an export whose chosen fields omit a required
 * column fails the required-name check instead of being guessed; `Account Type` text passes
 * straight to the shared parser — a Zoho type it does not know (`Payment Clearing Account`,
 * Zoho-specific sub-types) is a visible row error to fix, never a silent reclassification; item
 * price and purchase rate are read into the catalogue fields but stock quantities are never
 * staged into an opening-stock posting (the same rule the QuickBooks Online reader follows).
 * Nothing here validates, posts or writes.
 */
import type { ImportKind } from './recordImport';
import { columnText, joinedAddress } from './providerListCsv';

const ACCOUNTS_HEADER = ['Name', 'Code', 'Type', 'Category', 'Subtype', 'Description', 'Currency'];
const CUSTOMERS_HEADER = ['Name', 'Email', 'Phone', 'Address', 'Currency', 'Notes', 'Payment terms', 'Website'];
const VENDORS_HEADER = ['Name', 'Email', 'Phone', 'Address', 'Category', 'Tax ID'];
const ITEMS_HEADER = ['Name', 'SKU', 'Description', 'Sale price', 'Cost', 'Quantity on hand', 'Reorder point', 'Unit'];

export function normalizeZohoBooksCsv(kind: ImportKind, table: readonly (readonly string[])[]): string[][] {
  if (!table.length) return [];
  const [header, ...rows] = table;

  if (kind === 'accounts') {
    return [
      ACCOUNTS_HEADER,
      ...rows.map(row => [
        columnText(header, row, 'Account Name', 'Name'),
        columnText(header, row, 'Account Code', 'Code'),
        columnText(header, row, 'Account Type', 'Type'),
        '',
        '',
        columnText(header, row, 'Description'),
        columnText(header, row, 'Currency Code', 'Currency'),
      ]),
    ];
  }

  if (kind === 'customers' || kind === 'vendors') {
    const customers = kind === 'customers';
    const outHeader = customers ? CUSTOMERS_HEADER : VENDORS_HEADER;
    const address = (row: readonly string[]) => joinedAddress(
      columnText(header, row, 'Billing Address', 'Address'),
      columnText(header, row, 'Billing Street2', 'Street 2'),
      columnText(header, row, 'Billing City'),
      columnText(header, row, 'Billing State'),
      columnText(header, row, 'Billing Code', 'Billing Zip'),
      columnText(header, row, 'Billing Country'),
    );
    const name = (row: readonly string[]) =>
      columnText(header, row, customers ? 'Customer Display Name' : 'Vendor Display Name',
        'Display Name', customers ? 'Customer Name' : 'Vendor Name', 'Name') ||
      columnText(header, row, 'Company Name', 'Company');
    return [
      outHeader,
      ...rows.map(row => {
        const base = [
          name(row),
          columnText(header, row, customers ? 'Customer Email' : 'Vendor Email', 'Email ID', 'EmailID', 'Email'),
          columnText(header, row, customers ? 'Customer Phone' : 'Vendor Phone', 'MobilePhone', 'Mobile Phone', 'Phone'),
          address(row),
        ];
        return customers
          ? [...base, columnText(header, row, 'Currency Code', 'Currency'), columnText(header, row, 'Notes', 'Remarks'), columnText(header, row, 'Payment Terms', 'Payment Terms Label'), columnText(header, row, 'Website')]
          : [...base, columnText(header, row, 'Category'), columnText(header, row, 'Tax Number', 'TaxNumber', 'Tax ID')];
      }),
    ];
  }

  return [
    ITEMS_HEADER,
    ...rows.map(row => [
      columnText(header, row, 'Item Name', 'Name'),
      columnText(header, row, 'SKU', 'Item Code'),
      columnText(header, row, 'Description'),
      columnText(header, row, 'Rate', 'Sales Rate', 'Selling Price'),
      columnText(header, row, 'Purchase Rate', 'Cost', 'Purchase Cost'),
      '', // never stage opening stock from a catalogue export
      columnText(header, row, 'Reorder Point', 'Reorder Level'),
      columnText(header, row, 'Usage unit', 'Unit', 'UOM'),
    ]),
  ];
}
