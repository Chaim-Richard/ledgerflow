import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyMapping, guessMapping, prepareImport } from '../lib/recordImport';
import { readIif } from '../lib/iifImport';

/**
 * E-29 worked figures (fixtures/iif/lists.iif):
 *   accounts 5 usable (BANK, AR, AP, INCOME, EXPENSE) + 1 refused (WEIRDTYPE)
 *   customers 2 usable (Acme Ltd, Beta Co) + 1 refused (no NAME)
 *   vendors   1 usable (Office Supplies Ltd)
 *   items     2 usable (Consulting hour 150.00 price; Paper box 40.00 price / 25.00 cost)
 *   transactions 2 records (one TRNS, one SPL) refused; the section markers are not records
 */
const fixture = (name: string) => readFileSync(new URL('./fixtures/iif/' + name, import.meta.url), 'utf8');

test('E-29 reads the four list sections into the app\'s own import columns', () => {
  const result = readIif(fixture('lists.iif'));
  assert.deepEqual(result.counts, { accounts: 5, customers: 2, vendors: 1, items: 2 });

  assert.deepEqual(result.tables.accounts[0], ['Name', 'Code', 'Type', 'Category', 'Subtype', 'Description', 'Currency']);
  assert.deepEqual(result.tables.accounts[1], ['Checking', '1010', 'Bank', '', '', 'Main operating account', '']);
  assert.deepEqual(result.tables.accounts[2], ['Accounts Receivable', '1100', 'Accounts Receivable', '', '', 'What customers owe', '']);
  assert.deepEqual(result.tables.accounts[4], ['Consulting Income', '4000', 'Income', '', '', 'Services', '']);

  assert.deepEqual(result.tables.customers[1], ['Acme Ltd', 'acme@example.com', '+972-3-555-0101', '1 Herzl St, Apt 4, Tel Aviv', '', 'VIP', 'Net 30']);
  assert.deepEqual(result.tables.customers[2], ['Beta Co', 'beta@example.com', '+972-2-555-0202', '9 Rothschild, Jerusalem', '', '', 'Net 15']);

  assert.deepEqual(result.tables.vendors[1], ['Office Supplies Ltd', 'supplies@example.com', '03-555-0303', '5 Haifa Rd, Haifa', 'Supplier']);

  assert.deepEqual(result.tables.items[1], ['Consulting hour', 'CONS-1', 'Hourly consulting', '150.00', '0', '', 'SERV']);
  assert.deepEqual(result.tables.items[2], ['Paper box', 'PAP-1', 'A box of paper', '40.00', '25.00', '', 'INVENTORY']);
});

test('E-29 transaction sections are refused and counted, never imported into a list', () => {
  const result = readIif(fixture('lists.iif'));
  assert.equal(result.transactionsRefused, 2, 'one TRNS record and one SPL split were refused');
  // no table row carries the journal's amount or its memo
  const everyCell = Object.values(result.tables).flat(2).join('|');
  assert.equal(everyCell.includes('Paper'), true, 'the item description legitimately contains "Paper box"');
  assert.equal(everyCell.includes('-100.00'), false);
  assert.equal(everyCell.includes('JOURNAL'), false);
});

test('E-29 a row it cannot read is reported with its line, never guessed', () => {
  const result = readIif(fixture('lists.iif'));
  assert.equal(result.skipped.length, 2);
  const accounts = result.skipped.find(entry => entry.type === 'ACCNT');
  assert.equal(accounts?.line, 8);
  assert.match(accounts?.reason || '', /WEIRDTYPE.*not a recognised account type/);
  const customers = result.skipped.find(entry => entry.type === 'CUST');
  assert.equal(customers?.line, 12);
  assert.match(customers?.reason || '', /no NAME/);
});

test('E-29 the tables feed the shared importer unchanged: the chart of accounts parses, no row invents stock', () => {
  const { tables } = readIif(fixture('lists.iif'));
  const accountsHeader = tables.accounts[0];
  const accountsMapping = guessMapping('accounts', accountsHeader);
  const preparedAccounts = prepareImport('accounts', applyMapping('accounts', tables.accounts.slice(1), accountsMapping));
  assert.equal(preparedAccounts.errors.length, 0);
  assert.deepEqual(preparedAccounts.records.map(record => [record.data.name, record.data.type]), [
    ['Checking', 'asset'],
    ['Accounts Receivable', 'asset'],
    ['Accounts Payable', 'liability'],
    ['Consulting Income', 'revenue'],
    ['Office Costs', 'expense'],
  ]);

  const itemsMapping = guessMapping('items', tables.items[0]);
  const preparedItems = prepareImport('items', applyMapping('items', tables.items.slice(1), itemsMapping));
  assert.equal(preparedItems.errors.length, 0);
  assert.deepEqual(preparedItems.records.map(record => [record.data.name, record.data.unitPriceCents, record.data.unitCostCents, record.data.quantityAtHand]), [
    ['Consulting hour', 15000, 0, 0],
    ['Paper box', 4000, 2500, 0],
  ]);

  const customersMapping = guessMapping('customers', tables.customers[0]);
  const preparedCustomers = prepareImport('customers', applyMapping('customers', tables.customers.slice(1), customersMapping));
  assert.equal(preparedCustomers.errors.length, 0);
  assert.deepEqual(preparedCustomers.records.map(record => record.data.name), ['Acme Ltd', 'Beta Co']);
});

test('E-29 an unknown section is named once and skipped; a file with no sections is refused', () => {
  const result = readIif([
    '!HDR\tPROD\tVER',
    '!CLASS\tNAME\tREFNUM',
    'CLASS\tRetail\tX1',
    '!CUST\tNAME\tEMAIL',
    'CUST\tAcme\ta@example.com',
  ].join('\n'));
  assert.deepEqual(result.unknownSections, ['!CLASS', 'CLASS']);
  assert.equal(result.counts.customers, 1);
  assert.throws(() => readIif('name,email\nAcme,a@example.com'), /does not look like a QuickBooks IIF file/);
  assert.throws(() => readIif('   '), /file is empty/);
});

test('E-29 a section that is not in the file yields its header and zero rows, so the screen can say so', () => {
  const result = readIif(['!HDR\tPROD', '!ACCNT\tNAME\tACCNTTYPE', 'ACCNT\tCash\tBANK'].join('\n'));
  assert.equal(result.counts.accounts, 1);
  assert.equal(result.counts.customers, 0);
  assert.deepEqual(result.tables.customers, [['Name', 'Email', 'Phone', 'Address', 'Currency', 'Notes', 'Payment terms']]);
});
