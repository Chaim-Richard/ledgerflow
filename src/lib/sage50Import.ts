/**
 * E-47: Sage 50 (US) CSV exports → the app's own import columns.
 *
 * Sage 50's Select Import/Export templates write one CSV per list with the documented default
 * names (help-sage50.na.sage.com, "Chart of Accounts Fields (Import/Export)", "Customer List
 * Fields (Import/Export)", "Vendor List Fields (Import/Export)", "Inventory Item List Fields
 * (Import/Export)" — fetched 25 Oct 2026):
 * - `CHART.CSV`: `Account ID`, `Account Description`, `Inactive`, `Account Type` — the type is a
 *   **documented numeric code** (0=Cash, 1=Accounts Receivable, 2=Inventory, 3=Receivable
 *   Retainage, 4=Other Current Assets, 5=Fixed Assets, 6=Accumulated Depreciation, 8=Other
 *   Assets, 10=Accounts Payable, 11=Payable Retainage, 12=Other Current Liabilities, 14=Long
 *   Term Liabilities, 16=Equity-doesn't close, 18=Equity-Retained Earnings, 19=Equity-gets
 *   closed, 21=Income, 23=Cost of Sales, 24=Expenses).
 * - `CUSTOMER.CSV`: `Customer Name`, `Inactive`, `Customer Email`, `Telephone 1`, the
 *   `Bill to …` address fields, `Customer Web Site`.
 * - `VENDOR.CSV`: `Vendor Name`, `Inactive`, `Telephone 1`, address fields, `Vendor Type`,
 *   `1099 Type` (0=None, 1=Interest, 2=Misc), `Tax ID Number`.
 * - `ITEM.CSV`: `Item ID`, `Item Description`, `Description for Sales`, `Sales Price/Billing
 *   Rate 1`, `Last Unit Cost`, `UPC/SKU`, `Item Type`, `Minimum Stock`, `Stocking U/M`.
 *
 * Honesty rules: the numeric account type is translated **only** through the documented table
 * above; codes with no LedgerFlow equivalent (retainage, accumulated depreciation — a contra
 * account the import has no concept of) are emitted blank so the row is listed in the preview
 * for the user to fix, never silently reclassified. Export-only fields (`Current Balance`,
 * period debit/credit totals, receipts) are never read into anything — a list import carries
 * no figures. `Inactive=True` becomes an `inactive` status; a 1099 type of 1 or 2 (Interest,
 * Misc) marks the 1099 vendor flag, everything else leaves it unset. Prices are catalogue
 * figures; stock quantities are never staged into an opening-stock posting. Nothing here
 * validates, posts or writes.
 */
import type { ImportKind } from './recordImport';
import { columnText, joinedAddress, personName } from './providerListCsv';

const ACCOUNTS_HEADER = ['Name', 'Code', 'Type', 'Category', 'Subtype', 'Description', 'Currency'];
const CUSTOMERS_HEADER = ['Name', 'Email', 'Phone', 'Address', 'Website', 'Status'];
const VENDORS_HEADER = ['Name', 'Email', 'Phone', 'Address', 'Category', '1099 vendor', 'Tax ID', 'Status'];
const ITEMS_HEADER = ['Name', 'SKU', 'Description', 'Sale price', 'Cost', 'Quantity on hand', 'Reorder point', 'Unit', 'Category'];

/** Sage 50's documented numeric account-type codes → the words the shared parser recognises.
 *  Codes without a safe LedgerFlow equivalent map to '' (a visible row to fix, not a guess). */
const SAGE_ACCOUNT_TYPES: Record<string, string> = {
  '0': 'Cash',
  '1': 'Accounts Receivable',
  '2': 'Inventory',
  // 3 = Receivable Retainage: no LedgerFlow role — left for the user to fix in the preview
  '4': 'Other Current Assets',
  '5': 'Fixed Assets',
  // 6 = Accumulated Depreciation: a contra-asset the list import has no concept of — refused here
  '8': 'Other Assets',
  '10': 'Accounts Payable',
  // 11 = Payable Retainage: same reason as 3
  '12': 'Other Current Liabilities',
  '14': 'Long Term Liabilities',
  '16': 'Equity',
  '18': 'Equity', // documented as "Equity-Retained Earnings"
  '19': 'Equity', // documented as "Equity-gets closed"
  '21': 'Income',
  '23': 'Cost of Sales',
  '24': 'Expenses',
};

/** `True`/`False` Sage switches → the app's status words; anything else stays blank. */
const sageStatus = (raw: string): string => {
  const value = raw.trim().toLowerCase();
  if (value === 'true' || value === 'yes') return 'inactive';
  if (value === 'false' || value === 'no') return 'active';
  return '';
};

/** `1099 Type`: 1=Interest and 2=Misc are 1099 vendors; 0=None and anything unknown is not marked. */
const sageIs1099 = (raw: string): string => (raw.trim() === '1' || raw.trim() === '2' ? 'yes' : 'no');

export function normalizeSage50Csv(kind: ImportKind, table: readonly (readonly string[])[]): string[][] {
  if (!table.length) return [];
  const [header, ...rows] = table;

  if (kind === 'accounts') {
    return [
      ACCOUNTS_HEADER,
      ...rows.map(row => {
        const code = columnText(header, row, 'Account ID');
        const typeRaw = columnText(header, row, 'Account Type');
        const typeWord = SAGE_ACCOUNT_TYPES[typeRaw];
        return [
          columnText(header, row, 'Account Description', 'Account Name', 'Description') || code,
          code,
          // Only the documented numeric table is translated; a text type passes through untouched
          // so a hand-made Sage-shaped CSV still reads. Unknown numbers stay blank for the preview.
          /^\d+$/.test(typeRaw) ? (typeWord ?? '') : typeRaw,
          '',
          '',
          '',
          '',
        ];
      }),
    ];
  }

  if (kind === 'customers' || kind === 'vendors') {
    const customers = kind === 'customers';
    const outHeader = customers ? CUSTOMERS_HEADER : VENDORS_HEADER;
    const address = (row: readonly string[]) => customers
      ? joinedAddress(
        columnText(header, row, 'Bill to Address-Line One', 'Bill to Address Line 1'),
        columnText(header, row, 'Bill to Address-Line Two', 'Bill to Address Line 2'),
        columnText(header, row, 'Bill to City'),
        columnText(header, row, 'Bill to State'),
        columnText(header, row, 'Bill to Zip', 'Bill to Zip Code'),
        columnText(header, row, 'Bill to Country'),
      )
      : joinedAddress(
        columnText(header, row, 'Address-Line 1', 'Address Line 1'),
        columnText(header, row, 'Address-Line 2', 'Address Line 2'),
        columnText(header, row, 'City'),
        columnText(header, row, 'State'),
        columnText(header, row, 'Zip Code', 'Zip'),
        columnText(header, row, 'Country'),
      );
    return [
      outHeader,
      ...rows.map(row => {
        const name = customers
          ? columnText(header, row, 'Customer Name', 'Customer ID') ||
            personName(columnText(header, row, 'Bill to Contact First Name'), columnText(header, row, 'Bill to Contact Last Name'))
          : columnText(header, row, 'Vendor Name', 'Vendor ID');
        const phone = columnText(header, row, 'Telephone 1', 'Phone');
        const status = sageStatus(columnText(header, row, 'Inactive'));
        // A nameless row still ships to the preview, which names the problem instead of hiding it.
        return customers
          ? [name, columnText(header, row, 'Customer Email', 'Email'), phone, address(row), columnText(header, row, 'Customer Web Site', 'Website'), status]
          : [name, columnText(header, row, 'Email', 'Email Address'), phone, address(row), columnText(header, row, 'Vendor Type'), sageIs1099(columnText(header, row, '1099 Type')), columnText(header, row, 'Tax ID Number', 'Tax ID'), status];
      }),
    ];
  }

  return [
    ITEMS_HEADER,
    ...rows.map(row => {
      const id = columnText(header, row, 'Item ID');
      return [
        columnText(header, row, 'Item Description', 'Description') || id,
        columnText(header, row, 'UPC/SKU', 'SKU') || id,
        columnText(header, row, 'Description for Sales'),
        columnText(header, row, 'Sales Price/Billing Rate 1', 'Sales Price 1', 'Price Level 1'),
        columnText(header, row, 'Last Unit Cost'),
        '', // never stage opening stock from a catalogue export
        columnText(header, row, 'Minimum Stock'),
        columnText(header, row, 'Stocking U/M', 'Unit of Measure'),
        columnText(header, row, 'Item Type'),
      ];
    }),
  ];
}
