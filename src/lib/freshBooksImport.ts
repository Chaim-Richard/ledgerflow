/**
 * E-7: FreshBooks client/vendor/item CSV → LedgerFlow generic record-import columns.
 * No transactions, posting, database writes, or silent record merges are performed here.
 * Input is the parsed CSV's header row followed by data rows; the existing preview/server
 * importer performs validation and duplicate handling after this normalization.
 */
import type { ImportKind } from './recordImport';

const normalize = (value: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (s: unknown) => String(s ?? '').trim();
const cell = (headers: string[], row: readonly string[], ...aliases: string[]) => {
  const names = aliases.map(normalize);
  const at = headers.findIndex(name => names.includes(normalize(name)));
  return at >= 0 ? text(row[at]) : '';
};
const address = (headers: string[], row: readonly string[]) =>
  [
    cell(headers, row, 'Address Line 1', 'Address1', 'Street Address', 'Street 1'),
    cell(headers, row, 'Address Line 2', 'Address2', 'Street 2'),
    cell(headers, row, 'City'),
    cell(headers, row, 'State', 'Province', 'Region'),
    cell(headers, row, 'Zip', 'Zip Code', 'Postal Code'),
    cell(headers, row, 'Country'),
  ].filter(Boolean).join(', ');

const contactName = (headers: string[], row: readonly string[]) => {
  const company = cell(headers, row, 'Company Name', 'Company', 'Business Name', 'Organization');
  if (company) return company;
  const first = cell(headers, row, 'First Name', 'FirstName', 'Given Name');
  const last = cell(headers, row, 'Last Name', 'LastName', 'Surname');
  return [first, last].filter(Boolean).join(' ') || cell(headers, row, 'Client Name', 'Customer Name', 'Vendor Name', 'Name');
};

/** Return the same matrix expected by guessMapping/prepareImport. */
export function normalizeFreshBooksCsv(kind: ImportKind, table: readonly (readonly string[])[]): string[][] {
  if (!table.length || kind === 'accounts') return table.map(row => [...row]);
  const [headers, ...rows] = table;
  if (kind === 'customers') return [
    ['Name', 'Email', 'Phone', 'Address', 'Currency', 'Notes'],
    ...rows.map(row => [
      contactName([...headers], row),
      cell([...headers], row, 'Email', 'Email Address', 'Client Email'),
      cell([...headers], row, 'Phone', 'Phone Number', 'Business Phone'),
      address([...headers], row),
      cell([...headers], row, 'Currency', 'Currency Code'),
      cell([...headers], row, 'Notes', 'Note'),
    ]),
  ];
  if (kind === 'vendors') return [
    ['Name', 'Email', 'Phone', 'Category'],
    ...rows.map(row => [
      contactName([...headers], row),
      cell([...headers], row, 'Email', 'Email Address', 'Vendor Email'),
      cell([...headers], row, 'Phone', 'Phone Number'),
      cell([...headers], row, 'Category', 'Vendor Type'),
    ]),
  ];
  return [
    ['Name', 'SKU', 'Description', 'Sale price', 'Cost', 'Quantity on hand', 'Category'],
    ...rows.map(row => [
      cell([...headers], row, 'Name', 'Item Name', 'Product Name'),
      cell([...headers], row, 'SKU', 'Item Code', 'Product Code'),
      cell([...headers], row, 'Description', 'Details'),
      cell([...headers], row, 'Rate', 'Price', 'Unit Cost', 'Unit Price', 'Sales Price'),
      cell([...headers], row, 'Purchase Cost', 'Cost', 'Buy Price'),
      cell([...headers], row, 'Inventory', 'Quantity on Hand', 'Qty'),
      cell([...headers], row, 'Category', 'Type'),
    ]),
  ];
}
