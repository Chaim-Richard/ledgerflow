import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIifExport, quickBooksAccountType } from '../lib/iifExport';
import { readIif, IIF_HEADERS } from '../lib/iifImport';
import type { ChartAccount, Customer, Vendor, InventoryItem } from '../types';

const account = (over: Partial<ChartAccount>): ChartAccount =>
  ({ id: 'a', uid: 'u', workspaceId: 'w', code: '', name: 'Account', type: 'asset', balanceCents: 0, ...over }) as ChartAccount;
const customer = (over: Partial<Customer>): Customer =>
  ({ id: 'c', uid: 'u', workspaceId: 'w', name: 'Customer', ...over }) as Customer;
const vendor = (over: Partial<Vendor>): Vendor =>
  ({ id: 'v', uid: 'u', workspaceId: 'w', name: 'Vendor', category: 'Standard', ...over }) as Vendor;
const item = (over: Partial<InventoryItem>): InventoryItem =>
  ({ id: 'i', uid: 'u', workspaceId: 'w', name: 'Item', sku: '', unitPriceCents: 0, unitCostCents: 0, quantityAtHand: 0, reorderPoint: 0, createdAt: '2026-01-01', ...over }) as InventoryItem;

test('E-53 account type codes are the reader\'s own codes, picked by category/subtype before the plain type', () => {
  assert.equal(quickBooksAccountType(account({ subtype: 'bank' })), 'BANK');
  assert.equal(quickBooksAccountType(account({ category: 'Cash' })), 'BANK');
  assert.equal(quickBooksAccountType(account({ category: 'Receivables' })), 'AR');
  assert.equal(quickBooksAccountType(account({ category: 'Accounts Receivable' as ChartAccount['category'] })), 'AR');
  assert.equal(quickBooksAccountType(account({ type: 'liability', category: 'Payables' })), 'AP');
  assert.equal(quickBooksAccountType(account({ type: 'liability', subtype: 'credit_card' })), 'CCARD');
  assert.equal(quickBooksAccountType(account({ category: 'Fixed Assets' })), 'FIXASSET');
  assert.equal(quickBooksAccountType(account({ category: 'Inventory' })), 'OCASSET');
  assert.equal(quickBooksAccountType(account({})), 'OCASSET', 'a plain asset is Other Current Asset');
  assert.equal(quickBooksAccountType(account({ type: 'liability', category: 'Debt' })), 'LTLIAB');
  assert.equal(quickBooksAccountType(account({ type: 'liability' })), 'OCLIAB');
  assert.equal(quickBooksAccountType(account({ type: 'equity' })), 'EQUITY');
  assert.equal(quickBooksAccountType(account({ type: 'income' })), 'INCOME');
  assert.equal(quickBooksAccountType(account({ type: 'revenue' })), 'INCOME');
  assert.equal(quickBooksAccountType(account({ type: 'cost_of_goods' })), 'COGS');
  assert.equal(quickBooksAccountType(account({ type: 'expense' })), 'EXPENSE');
});

test('E-53 the file is exact QuickBooks Desktop IIF: header, four sections, tab-separated, no transactions', () => {
  const { text, counts, skipped } = buildIifExport({
    accounts: [
      account({ code: '1010', name: 'Checking', category: 'Cash', subtype: 'bank', description: 'Main operating account', balanceCents: 100_000_00 }),
      account({ code: '4000', name: 'Consulting Income', type: 'income' }),
    ],
    customers: [customer({ name: 'Acme Ltd', address: '1 Herzl St, Tel Aviv', phone: '+972-3-555-0101', email: 'acme@example.com', notes: 'VIP' })],
    vendors: [vendor({ name: 'Office Supplies Ltd', address: '5 Haifa Rd', phone: '03-555-0303', email: 'supplies@example.com', category: 'Supplier' })],
    items: [
      item({ name: 'Consulting hour', sku: 'CONS-1', itemType: 'service', unitPriceCents: 150_00, unitCostCents: 0, description: 'Hourly consulting' }),
      item({ name: 'Paper box', sku: 'PAP-1', unitPriceCents: 40_00, unitCostCents: 25_00, quantityAtHand: 999 }),
    ],
  });

  assert.deepEqual(counts, { accounts: 2, customers: 1, vendors: 1, items: 2 });
  assert.deepEqual(skipped, []);
  assert.equal(text, [
    '!HDR\tPROD\tVER\tREL\tIIF\tEDITION',
    '!ACCNT\tNAME\tACCNTTYPE\tDESC\tACCNUM',
    'ACCNT\tChecking\tBANK\tMain operating account\t1010',
    'ACCNT\tConsulting Income\tINCOME\t\t4000',
    '!CUST\tNAME\tBADDR1\tPHONE1\tEMAIL\tNOTE\tTERMS',
    'CUST\tAcme Ltd\t1 Herzl St, Tel Aviv\t+972-3-555-0101\tacme@example.com\tVIP\t',
    '!VEND\tNAME\tBADDR1\tPHONE1\tEMAIL\tVTYPE',
    'VEND\tOffice Supplies Ltd\t5 Haifa Rd\t03-555-0303\tsupplies@example.com\tSupplier',
    '!ITEM\tNAME\tINVITEMTYPE\tDESC\tSALESDESC\tPRICE\tCOST\tSKU',
    'ITEM\tConsulting hour\tSERV\tHourly consulting\tHourly consulting\t150.00\t0.00\tCONS-1',
    'ITEM\tPaper box\tINVENTORY\t\t\t40.00\t25.00\tPAP-1',
    '',
  ].join('\n'));

  assert.ok(!text.includes('!TRNS') && !text.includes('!SPL'), 'no transaction sections are ever written');
  assert.ok(!text.includes('100000'), "the checking account's balance is not in the file (lists only, no figures posted elsewhere)");
  assert.ok(!text.includes('999'), "the item's stock quantity is not in the file either");
});

test('E-53 written lists read back through the E-29 reader with nothing refused and nothing reported', () => {
  const { text, counts } = buildIifExport({
    accounts: [
      account({ code: '1010', name: 'Checking', category: 'Cash', subtype: 'bank' }),
      account({ code: '1100', name: 'Accounts Receivable', category: 'Receivables' }),
      account({ code: '2000', name: 'Accounts Payable', type: 'liability', category: 'Payables' }),
      account({ code: '2100', name: 'Visa card', type: 'liability', subtype: 'credit_card' }),
      account({ code: '1500', name: 'Equipment', category: 'Fixed Assets' }),
      account({ code: '2500', name: 'Long term loan', type: 'liability', category: 'Debt' }),
      account({ code: '3000', name: 'Owner equity', type: 'equity' }),
      account({ code: '4000', name: 'Sales', type: 'revenue' }),
      account({ code: '5000', name: 'Materials', type: 'cost_of_goods' }),
      account({ code: '6000', name: 'Rent', type: 'expense' }),
    ],
    customers: [customer({ name: 'Acme Ltd', address: '1 Herzl St', email: 'acme@example.com' })],
    vendors: [vendor({ name: 'Office Supplies Ltd', category: 'Supplier' })],
    items: [item({ name: 'Paper box', sku: 'PAP-1', unitPriceCents: 40_00, unitCostCents: 25_00 })],
  });

  const read = readIif(text);
  assert.deepEqual(read.counts, counts);
  assert.equal(read.transactionsRefused, 0);
  assert.deepEqual(read.skipped, []);
  assert.deepEqual(read.unknownSections, []);

  const names = (table: string[][]) => table.slice(1).map(row => row[0]);
  assert.deepEqual(names(read.tables.accounts), ['Checking', 'Accounts Receivable', 'Accounts Payable', 'Visa card', 'Equipment', 'Long term loan', 'Owner equity', 'Sales', 'Materials', 'Rent']);
  assert.deepEqual(read.tables.accounts[0], IIF_HEADERS.accounts);
  // the reader's own type words: Checking → Bank, Sales → Income, Materials → Cost of Goods Sold…
  const types = read.tables.accounts.slice(1).map(row => row[2]);
  assert.deepEqual(types, ['Bank', 'Accounts Receivable', 'Accounts Payable', 'Credit Card', 'Fixed Asset', 'Long Term Liability', 'Equity', 'Income', 'Cost of Goods Sold', 'Expense']);
  assert.deepEqual(names(read.tables.customers), ['Acme Ltd']);
  assert.deepEqual(names(read.tables.vendors), ['Office Supplies Ltd']);
  assert.deepEqual(names(read.tables.items), ['Paper box']);
  // the item's catalogue money survives the round-trip
  const paperBox = read.tables.items.slice(1).find(row => row[0] === 'Paper box')!;
  const priceAt = IIF_HEADERS.items.indexOf('Sale price');
  const costAt = IIF_HEADERS.items.indexOf('Cost');
  assert.equal(paperBox[priceAt], '40.00');
  assert.equal(paperBox[costAt], '25.00');
});

test('E-53 tabs and line breaks inside a name or note are flattened, never written into the file structure', () => {
  const { text, counts } = buildIifExport({
    customers: [customer({ name: 'Acme\tLtd\nBerlin', notes: 'VIP\r\nsecond line' })],
  });
  assert.equal(counts.customers, 1);
  assert.equal(text.split('\n').filter(line => line.startsWith('CUST\t')).length, 1, 'a line break in a name cannot forge two records');
  assert.ok(!text.includes('\tLtd\n'), 'no raw break survives');
  assert.ok(text.includes('CUST\tAcme Ltd Berlin\t\t\t\tVIP second line\t\n'), `tab/break-flattened row expected, got:\n${text}`);
});

test('E-53 archived accounts, nameless records and duplicate names are counted with the reason, not dropped quietly', () => {
  const { counts, skipped } = buildIifExport({
    accounts: [
      account({ code: '1010', name: 'Checking' }),
      account({ code: '1020', name: 'Old petty cash', archived: true }),
      account({ code: '1030', name: '' }),
    ],
    customers: [
      customer({ name: 'Acme Ltd' }),
      customer({ name: 'acme ltd' }),
      customer({ name: '  ' }),
    ],
  });
  assert.equal(counts.accounts, 1);
  assert.equal(counts.customers, 1);
  assert.deepEqual(skipped, [
    { section: 'ACCNT', name: 'Old petty cash', reason: 'archived accounts are not exported; restore it if the accountant needs it.' },
    { section: 'ACCNT', name: '(no name)', reason: 'a record without a name cannot sit in a list QuickBooks keys by name.' },
    { section: 'CUST', name: 'acme ltd', reason: 'another record named "acme ltd" is already in this file; QuickBooks would silently merge the second one, so only the first is written.' },
    { section: 'CUST', name: '(no name)', reason: 'a record without a name cannot sit in a list QuickBooks keys by name.' },
  ]);
});

test('E-53 an empty workspace still exports a valid list file with zero-count sections', () => {
  const { text, counts, skipped } = buildIifExport({});
  assert.deepEqual(counts, { accounts: 0, customers: 0, vendors: 0, items: 0 });
  assert.deepEqual(skipped, []);
  const read = readIif(text);
  assert.deepEqual(read.counts, counts);
  assert.deepEqual(read.skipped, []);
});
