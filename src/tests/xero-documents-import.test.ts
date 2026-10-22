import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readXeroDocumentsCsv, xeroMoneyCents, xeroQuantity } from '../lib/xeroDocumentsImport';

/**
 * E-28 worked figures, computed by hand from the fixtures:
 *
 * sales-invoices.csv (ILS workspace, account 4000 known)
 *   INV-1001, two lines: 10 × 150.00 = 1,500.00 net, tax 255.00
 *                        1 × 120.50 =   120.50 net, tax  20.49
 *                        → net 1,620.50, tax 275.49, total 1,895.99 (the export's Total agrees)
 *   INV-1002, one line:  2 × 800.00 = 1,600.00 net, tax 272.00 → total 1,872.00
 *
 * bills.csv (account 5000)
 *   BILL-500, two lines: 3 × 40.00 = 120.00 net, tax 20.40
 *                        1 × 20.00 =  20.00 net, tax  3.40
 *                        → net 140.00, tax 23.80, total 163.80
 */
const fixture = (name: string) => readFileSync(new URL('./fixtures/xero/' + name, import.meta.url), 'utf8');
const options = {
  kind: 'invoices' as const,
  dateOrder: 'dmy' as const,
  currency: 'ILS',
  accountCodes: ['4000', '5000'],
};

test('E-28 groups a Xero invoice export into documents with worked totals', () => {
  const result = readXeroDocumentsCsv(fixture('sales-invoices.csv'), options);
  assert.equal(result.skipped.length, 0);
  assert.equal(result.documents.length, 2);

  const [first, second] = result.documents;
  assert.equal(first.number, 'INV-1001');
  assert.equal(first.contactName, 'Acme Ltd');
  assert.equal(first.reference, 'PO-77');
  assert.equal(first.date, '2024-02-01');
  assert.equal(first.dueDate, '2024-02-15');
  assert.equal(first.currency, 'ILS');
  assert.equal(first.status, 'draft');
  assert.equal(first.posted, false);
  assert.deepEqual(first.lines.map(line => [line.description, line.quantity, line.unitAmountCents, line.netCents, line.taxAmountCents, line.accountCode]), [
    ['Consulting hours', 10, 15000, 150000, 25500, '4000'],
    ['Travel', 1, 12050, 12050, 2049, '4000'],
  ]);
  assert.equal(first.netCents, 162050);
  assert.equal(first.taxCents, 27549);
  assert.equal(first.totalCents, 189599);

  assert.equal(second.number, 'INV-1002');
  assert.equal(second.reference, undefined);
  assert.equal(second.date, '2024-02-05');
  assert.equal(second.dueDate, '2024-03-05');
  assert.equal(second.netCents, 160000);
  assert.equal(second.taxCents, 27200);
  assert.equal(second.totalCents, 187200);
  // the header names actually used are reported, so the screen can show them
  assert.equal(result.columns.number, 'InvoiceNumber');
  assert.equal(result.columns.date, 'InvoiceDate');
});

test('E-28 reads a bill export: Date column, supplier names, same totals', () => {
  const result = readXeroDocumentsCsv(fixture('bills.csv'), { ...options, kind: 'bills' });
  assert.equal(result.documents.length, 1);
  const bill = result.documents[0];
  assert.equal(bill.kind, 'bills');
  assert.equal(bill.number, 'BILL-500');
  assert.equal(bill.contactName, 'Office Supplies Ltd');
  assert.equal(bill.date, '2024-02-03');
  assert.equal(bill.dueDate, '2024-03-03');
  assert.equal(bill.netCents, 14000);
  assert.equal(bill.taxCents, 2380);
  assert.equal(bill.totalCents, 16380);
  assert.equal(result.columns.date, 'Date');
});

test('E-28 the date order is the user\'s and an impossible date is refused', () => {
  const dmy = readXeroDocumentsCsv(fixture('sales-invoices.csv'), options);
  assert.deepEqual(dmy.documents.map(doc => doc.date), ['2024-02-01', '2024-02-05']);
  // the same dates read month/day when the user says so (this file's 15/02 due date is impossible that way)
  const both = 'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxAmount\nAcme,INV-8,01/02/2024,03/02/2024,Work,1,10.00,4000,1.70';
  assert.equal(readXeroDocumentsCsv(both, { ...options, dateOrder: 'mdy' }).documents[0].date, '2024-01-02');
  assert.equal(readXeroDocumentsCsv(both, { ...options, dateOrder: 'mdy' }).documents[0].dueDate, '2024-03-02');
  // 15/02 is fine both ways; 13/02 only as day/month
  const row = (date: string) => `ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxAmount\nAcme,INV-9,${date},${date},Work,1,10.00,4000,1.70`;
  assert.equal(readXeroDocumentsCsv(row('13/02/2024'), { ...options, dateOrder: 'dmy' }).documents[0].date, '2024-02-13');
  assert.throws(() => readXeroDocumentsCsv(row('13/02/2024'), { ...options, dateOrder: 'mdy' }), /row 2: The document date "13\/02\/2024" is not a real date/);
  assert.throws(() => readXeroDocumentsCsv(row('31/02/2024'), options), /not a real date/);
  assert.throws(() => readXeroDocumentsCsv(row('01/02/24'), options), /four-digit year/);
  assert.throws(() => readXeroDocumentsCsv(row('2024-02-01').replace('2024-02-01,2024-02-01', '2024-02-01,2024-01-05'), options), /due date 2024-01-05 is before the document date/);
});

test('E-28 money and quantities are exact integer cents, never floats', () => {
  assert.equal(xeroMoneyCents('1,234.56'), 123456);
  assert.equal(xeroMoneyCents('(12.00)'), -1200);
  assert.equal(xeroMoneyCents('$1,000'), 100000);
  assert.equal(xeroMoneyCents(''), 0);
  assert.equal(xeroQuantity('1.5'), 15000);
  assert.equal(xeroQuantity('0.3333'), 3333);
  assert.equal(xeroQuantity('12'), 120000);
  for (const bad of ['1.23456', '1e3', 'abc', '--1']) {
    assert.throws(() => xeroQuantity(bad, 7), /row 7: .* is not a quantity/);
  }
  for (const bad of ['1.234', 'x', '1,2.00']) {
    assert.throws(() => xeroMoneyCents(bad, 7), /row 7: .* is not an amount/);
  }
  // 0.3333 × 3.00 = 0.9999 → 1.00, rounded half-up once, in integers
  const row = 'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxAmount\nAcme,INV-9,01/02/2024,01/02/2024,Work,0.3333,3.00,4000,0';
  assert.equal(readXeroDocumentsCsv(row, options).documents[0].lines[0].netCents, 100);
});

test('E-28 refuses a row without the facts a draft needs', () => {
  const base = 'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxAmount\n';
  const line = 'Acme,INV-9,01/02/2024,01/02/2024,Work,1,10.00,4000,1.70';
  assert.throws(() => readXeroDocumentsCsv(base + line.replace('INV-9', ''), options), /row 2: Missing invoice\/bill number/);
  assert.throws(() => readXeroDocumentsCsv(base + line.replace('Acme,', ','), options), /Missing contact name/);
  assert.throws(() => readXeroDocumentsCsv(base + line.replace(',Work,', ',,'), options), /Missing line description/);
  assert.throws(() => readXeroDocumentsCsv(base + line.replace(',4000,', ',,'), options), /has no account code/);
  assert.throws(() => readXeroDocumentsCsv(base + line.replace(',1,10.00,', ',0,10.00,'), options), /positive quantity/);
  assert.throws(() => readXeroDocumentsCsv(base + line.replace(',10.00,', ',-10.00,'), options), /negative unit amount/);
  assert.throws(() => readXeroDocumentsCsv(base + line.replace(',1.70', ',-1.70'), options), /negative tax amount/);
  assert.throws(() => readXeroDocumentsCsv('ContactName,InvoiceDate,DueDate,Description,Quantity,UnitAmount\nAcme,01/02/2024,01/02/2024,Work,1,10.00', options), /No invoice\/bill number column/);
  assert.throws(() => readXeroDocumentsCsv('ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxAmount\n', options), /no document rows/);
  assert.throws(() => readXeroDocumentsCsv(base + line, { ...options, dateOrder: 'ymd' as never }), /Choose the date order/);
});

test('E-28 skips what cannot be imported safely, with the reason and the row', () => {
  const result = readXeroDocumentsCsv(fixture('invoices-with-problems.csv'), { ...options, existingNumbers: ['inv-1001'] });
  assert.deepEqual(result.documents.map(doc => doc.number), ['INV-2006']);
  const reasons = new Map(result.skipped.map(entry => [entry.number, entry.reason]));
  assert.match(reasons.get('INV-1001') || '', /already exists/);
  assert.match(reasons.get('INV-2001') || '', /is VOIDED in Xero/);
  assert.match(reasons.get('INV-2002') || '', /in USD .* keeps its books in ILS/);
  assert.match(reasons.get('INV-2003') || '', /not in this workspace's chart of accounts/);
  assert.match(reasons.get('INV-2004') || '', /has a discount/);
  assert.match(reasons.get('INV-2005') || '', /the export's total is 999\.00 but its lines add up to 117\.00/);
  assert.equal(result.documents[0].totalCents, 11700);
});

test('E-28 a document is all or nothing: one refused line drops the whole document', () => {
  const csv = [
    'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxAmount',
    'Acme,INV-9,01/02/2024,01/02/2024,Fine,1,10.00,4000,1.70',
    'Acme,INV-9,01/02/2024,01/02/2024,Bad account,1,10.00,7777,1.70',
    'Acme,INV-10,01/02/2024,01/02/2024,Other document,1,10.00,4000,1.70',
  ].join('\n');
  const result = readXeroDocumentsCsv(csv, options);
  assert.deepEqual(result.documents.map(doc => doc.number), ['INV-10']);
  assert.match(result.skipped[0].reason, /7777/);
});

test('E-28 the same invoice number under two contacts is refused, not merged', () => {
  const csv = [
    'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxAmount',
    'Acme,INV-9,01/02/2024,01/02/2024,One,1,10.00,4000,1.70',
    'Beta,INV-9,01/02/2024,01/02/2024,Two,1,10.00,4000,1.70',
  ].join('\n');
  assert.throws(() => readXeroDocumentsCsv(csv, options), /names two different contacts/);
});

test('E-28 a draft is what comes out: every document says draft, unposted, and never carries an id', () => {
  const result = readXeroDocumentsCsv(fixture('sales-invoices.csv'), options);
  for (const doc of result.documents) {
    assert.equal(doc.status, 'draft');
    assert.equal(doc.posted, false);
    assert.equal('id' in doc, false);
  }
});
