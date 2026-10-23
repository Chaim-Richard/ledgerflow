/**
 * E-20: QuickBooks Online report/list CSV → the existing validated record-import columns.
 * Source exports: Account List, Customer Contact List, Vendor Contact List,
 * Item Listing / Products and Services. Source headers must be on the first row.
 * No journal entries, account balances, opening stock, bills or invoices are imported.
 *
 * https://quickbooks.intuit.com/learn-support/en-us/help-article/list-management/export-reports-lists-data-quickbooks-online/L1xleDrLp_US_en_US
 * https://quickbooks.intuit.com/learn-support/en-us/help-article/small-business-processes/move-lists-balances-quickbooks-online-quickbooks/L7pZVGPCE_US_en_US
 */
import type { ImportKind } from './recordImport';

const clean = (s: string): string => String(s ?? '').trim();
const key = (value: string): string => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const col = (header: readonly string[], row: readonly string[], ...aliases: string[]) => {
  const names = aliases.map(key);
  const index = header.findIndex(cell => names.includes(key(cell)));
  return index < 0 ? '' : clean(row[index] || '');
};
const combinedAddress = (header: readonly string[], row: readonly string[]) => {
  const parts = [
    col(header, row, 'Billing Street', 'Bill to street', 'Bill To Address', 'Billing Address', 'Vendor Address', 'Company Address', 'Primary Address', 'Mailing Address', 'Address Line 1', 'Street Address', 'Street'),
    col(header, row, 'Billing Street 2', 'Address Line 2', 'Street 2'),
    col(header, row, 'Billing City', 'City'),
    col(header, row, 'Billing State', 'State', 'Province', 'Region'),
    col(header, row, 'Billing ZIP', 'ZIP', 'Zip Code', 'Postal Code'),
    col(header, row, 'Billing Country', 'Country'),
  ];
  return parts.filter(Boolean).join(', ');
};
const customerName = (header: readonly string[], row: readonly string[]) =>
  col(header, row, 'Customer', 'Customer Name', 'Display Name', 'Display Name As', 'Full Name') ||
  col(header, row, 'Company Name', 'Company') ||
  [col(header, row, 'First Name'), col(header, row, 'Last Name')].filter(Boolean).join(' ');
const vendorName = (header: readonly string[], row: readonly string[]) =>
  col(header, row, 'Vendor', 'Vendor Name', 'Supplier', 'Supplier Name', 'Display Name', 'Full Name') ||
  col(header, row, 'Company Name', 'Company') ||
  [col(header, row, 'First Name'), col(header, row, 'Last Name')].filter(Boolean).join(' ');

/**
 * Pure normalization; the shared prepareImport and checked server route remain
 * responsible for validation, duplicate detection, permissions and writes.
 * An unsupported report fails the existing required-field validation rather
 * than guessing fields. QBO Balance and Qty on Hand deliberately never post.
 */
export function normalizeQuickBooksCsv(kind: ImportKind, table: readonly (readonly string[])[]): string[][] {
  if (!table.length) return [];
  const [headers, ...data] = table;
  const rows = data.map(row => [...row]);
  if (kind === 'customers') return [
    ['Name', 'Email', 'Phone', 'Address', 'Currency', 'Notes'],
    ...rows.map(row => [
      customerName(headers, row),
      col(headers, row, 'Email', 'Email Address', 'Primary Email', 'Primary Email Address'),
      col(headers, row, 'Phone Numbers', 'Phone', 'Phone Number', 'Primary Phone', 'Main Phone'),
      combinedAddress(headers, row),
      col(headers, row, 'Currency', 'Currency Code'),
      col(headers, row, 'Notes', 'Memo'),
    ]),
  ];
  if (kind === 'vendors') return [
    ['Name', 'Email', 'Phone', 'Address', 'Category'],
    ...rows.map(row => [
      vendorName(headers, row),
      col(headers, row, 'Email', 'Email Address', 'Primary Email', 'Primary Email Address'),
      col(headers, row, 'Phone Numbers', 'Phone', 'Phone Number', 'Primary Phone', 'Main Phone'),
      combinedAddress(headers, row),
      col(headers, row, 'Vendor Type', 'Category'),
    ]),
  ];
  if (kind === 'items') return [
    ['Name', 'SKU', 'Description', 'Sale price', 'Cost', 'Quantity on hand', 'Category'],
    ...rows.map(row => [
      col(headers, row, 'Product/Service', 'Product Service', 'Product/Service Name', 'Product Name', 'Service Name', 'Item', 'Item Name', 'Name'),
      col(headers, row, 'SKU', 'Item Code', 'Product Code'),
      col(headers, row, 'Sales Description', 'Description', 'Purchase Description'),
      col(headers, row, 'Sales Price/Rate', 'Sales Price', 'Sales Price Rate', 'Sale Price', 'Rate', 'Unit Price', 'Price'),
      col(headers, row, 'Purchase Cost', 'Cost', 'Purchases Unit Price', 'Purchase Price'),
      '', // No silent opening-stock ledger posting from a QBO snapshot.
      col(headers, row, 'Category', 'Product/Service Type', 'Type'),
    ]),
  ];
  return [
    ['Name', 'Code', 'Type', 'Category', 'Subtype', 'Description', 'Currency'],
    ...rows.map(row => [
      col(headers, row, 'Account', 'Account Name', 'Name', 'Full Name'),
      col(headers, row, 'Number', 'Account Number', 'Account No', 'Code'),
      col(headers, row, 'Type', 'Account Type'),
      '', // Preserve category inferred by the shared parser (Cash, Receivables, Payables, etc.).
      col(headers, row, 'Detail Type', 'Detail', 'Sub Type', 'Subtype'),
      col(headers, row, 'Description'),
      col(headers, row, 'Currency', 'Currency Code'),
    ]),
  ];
}
