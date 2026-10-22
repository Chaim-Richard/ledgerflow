/**
 * PREV-6: a small corpus of realistic (synthetic) export files, src/tests/fixtures/parsers.
 * Good files parse to exact, hand-checked rows; odd files are refused whole with a message
 * that says what is wrong. Nothing is ever partly read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseOFXStatement } from '../lib/ofxParser';
import { parseCamt053Import } from '../lib/camt053Import';
import { parseCsvChecked, parseCsv } from '../lib/csv';
import { assertReadableText, bankCsvAmountCents, bankCsvDate, mapBankCsvRows, type BankCsvMapping } from '../lib/bankCsvRows';
import { normalizeQuickBooksCsv } from '../lib/quickBooksCsvImport';
import { applyMapping, guessMapping, prepareImport, type ImportKind } from '../lib/recordImport';

/** As the browser reads an upload: bytes decoded as UTF-8, invalid bytes become U+FFFD. */
const file = (name: string) => new TextDecoder('utf-8').decode(readFileSync(new URL(`./fixtures/parsers/${name}`, import.meta.url)));
const AMOUNT: BankCsvMapping = { date: 0, description: 1, amount: 2, debit: -1, credit: -1, skipRows: 1 };
/** The "Other CSV" bank path as StatementImporter runs it. */
const bankCsv = (name: string, mapping = AMOUNT) => {
  const text = file(name);
  assertReadableText(text, name);
  return mapBankCsvRows(parseCsvChecked(text), mapping).map(({ date, description, amountCents }) => ({ date, description, amountCents }));
};
const records = (kind: ImportKind, name: string, quickBooks: boolean) => {
  const cells = parseCsvChecked(file(name));
  const table = quickBooks ? normalizeQuickBooksCsv(kind, cells) : cells;
  return prepareImport(kind, applyMapping(kind, table.slice(1), guessMapping(kind, table[0])));
};

test('PREV-6 corpus: US comma CSV with quotes, US/ISO/month-name dates, grouping and parentheses', () => {
  assert.deepEqual(bankCsv('bank-us-comma.csv'), [
    { date: '2026-10-01', description: 'Opening deposit', amountCents: 150000 },
    { date: '2026-10-02', description: 'Office Depot, Inc.', amountCents: -4599 },
    { date: '2026-10-03', description: "O'Brien Coffee", amountCents: -450 },
    { date: '2026-10-04', description: 'Client payment', amountCents: 125000 },
    { date: '2026-10-05', description: 'Bank fee', amountCents: -1200 },
  ]);
});

test('PREV-6 corpus: semicolon CSV with comma decimals and day.month.year dates is read in cents, not ×100', () => {
  assert.deepEqual(bankCsv('bank-eu-semicolon.csv'), [
    { date: '2026-10-01', description: 'Miete Oktober', amountCents: -125000 },
    { date: '2026-10-02', description: 'Kunde Müller GmbH', amountCents: 340050 },
    { date: '2026-10-03', description: 'Kaffee; Kuchen', amountCents: -450 },
  ]);
});

test('PREV-6 corpus: CSV with a byte-order mark and separate debit/credit columns', () => {
  assert.deepEqual(bankCsv('bank-bom-debit-credit.csv', { ...AMOUNT, amount: -1, debit: 2, credit: 3 }), [
    { date: '2026-10-06', description: 'Card payment', amountCents: -2500 },
    { date: '2026-10-07', description: 'Refund from supplier', amountCents: 1010 },
  ]);
  assert.equal(parseCsvChecked(file('bank-bom-debit-credit.csv'))[0][0], 'Date', 'the BOM is not part of the first header');
});

test('PREV-6 corpus: identical rows are two real purchases; both are kept for the duplicate review', () => {
  assert.deepEqual(bankCsv('bank-duplicate-rows.csv'), [
    { date: '2026-10-08', description: 'Coffee', amountCents: -350 },
    { date: '2026-10-08', description: 'Coffee', amountCents: -350 },
  ]);
});

test('PREV-6 corpus: odd bank CSV files are refused whole with a message naming the problem', () => {
  const refusals: Array<[string, RegExp]> = [
    ['empty.csv', /no transaction rows/],
    ['bank-header-only.csv', /no transaction rows/],
    ['bank-mismatched-columns.csv', /nothing was imported: row 3 has 4 cells but the header has 3/],
    ['bank-huge-amount.csv', /row 2: the amount is empty or not a number/],
    ['bank-non-numeric-amount.csv', /2 row\(s\) cannot be read.*row 2: the amount.*row 3: the amount/],
    ['bank-invalid-date.csv', /row 2: the date "2026-02-30" is not a real date; row 3: the date "13\/45\/2026"/],
    ['bank-truncated-quote.csv', /quoted cell is never closed.*Nothing was imported/],
    ['bank-latin1.csv', /bank-latin1\.csv is not UTF-8 text.*Nothing was imported/],
    ['bank-utf16.csv', /bank-utf16\.csv looks like UTF-16/],
  ];
  for (const [name, message] of refusals) assert.throws(() => bankCsv(name), message, name);
});

test('PREV-6: the bank CSV amount reader takes common formats exactly and refuses guesses', () => {
  const cases: Array<[string, number | null]> = [
    ['12.50', 1250], ['-12.5', -1250], ['+3', 300], ['1,234.56', 123456], ['1.234,56', 123456],
    ['-12,50', -1250], ['(12.00)', -1200], ['$1,250.00', 125000], ['-$5.00', -500], ['12.50-', -1250],
    ['1 234,56', 123456], ['0.00', 0], ['-0.00', 0], ['1.234', null], ['12.345', null], ['twelve', null],
    ['', null], ['1,2,3', null], ['--5', null], ['99999999999999999.99', null], ['1e5', null], ['NaN', null],
  ];
  for (const [raw, cents] of cases) assert.equal(bankCsvAmountCents(raw), cents, raw);
  assert.equal(Object.is(bankCsvAmountCents('-0.00'), -0), false, 'no negative zero');
});

test('PREV-6: the bank CSV date reader accepts only real calendar dates', () => {
  const cases: Array<[string, string]> = [
    ['2026-10-12', '2026-10-12'], ['2026/10/12', '2026-10-12'], ['2026-10-12T23:59:00Z', '2026-10-12'],
    ['10/12/2026', '2026-10-12'], ['12.10.2026', '2026-10-12'], ['Oct 12, 2026', '2026-10-12'],
    ['2024-02-29', '2024-02-29'], ['2026-02-29', ''], ['2026-13-01', ''], ['13/45/2026', ''],
    ['1', ''], ['20261012', ''], ['Total', ''], ['', ''],
  ];
  for (const [raw, iso] of cases) assert.equal(bankCsvDate(raw), iso, raw);
});

test('PREV-6: a debit column means money out whether the bank writes 25.00 or -25.00', () => {
  const rows = [['Date', 'Description', 'Debit', 'Credit'], ['2026-10-06', 'Fee', '-25.00', ''], ['2026-10-06', 'Fee', '25.00', '']];
  assert.deepEqual(mapBankCsvRows(rows, { ...AMOUNT, amount: -1, debit: 2, credit: 3 }).map(r => r.amountCents), [-2500, -2500]);
});

test('PREV-6: parseCsv keeps its lenient behaviour; parseCsvChecked refuses an unclosed quote', () => {
  assert.deepEqual(parseCsv('a,"b\n'), [['a', 'b']]);
  assert.throws(() => parseCsvChecked('a,"b\n'), /never closed/);
  assert.deepEqual(parseCsvChecked('a,"b ""c"""\n'), [['a', 'b "c"']]);
});

test('PREV-6 corpus: OFX 1.x SGML statement, entities, time zones and whole-dollar amounts', () => {
  assert.deepEqual(parseOFXStatement(file('ofx1-sgml.ofx'), 'USD'), [
    { date: '2026-10-02', amountCents: -8910, description: 'Smith & Sons Hardware — Invoice 4471', reference: '2026100201', type: 'debit' },
    { date: '2026-10-05', amountCents: 240000, description: 'ACME Corp payroll', reference: '2026100502', type: 'credit' },
    { date: '2026-10-09', amountCents: -15000, description: 'Check 1042', reference: '2026100903', type: 'debit' },
  ]);
});

test('PREV-6 corpus: OFX 2 XML statement in EUR', () => {
  assert.deepEqual(parseOFXStatement(file('ofx2-xml.ofx'), 'EUR'), [
    { date: '2026-10-03', amountCents: -125000, description: 'Miete Oktober', reference: 'X-1', type: 'debit' },
    { date: '2026-10-04', amountCents: 340050, description: 'Kunde Müller GmbH', reference: 'X-2', type: 'credit' },
  ]);
});

test('PREV-6 corpus: QFX credit-card statement (Quicken INTU.BID header)', () => {
  assert.deepEqual(parseOFXStatement(file('card.qfx'), 'USD'), [
    { date: '2026-10-11', amountCents: -2347, description: 'CLOUD HOSTING CO', reference: '320261011000001', type: 'debit' },
    { date: '2026-10-15', amountCents: 50000, description: 'PAYMENT THANK YOU', reference: '320261015000002', type: 'credit' },
  ]);
});

test('PREV-6 corpus: odd OFX files are refused whole', () => {
  const ofx = file('ofx1-sgml.ofx');
  assert.throws(() => parseOFXStatement(file('ofx-truncated.ofx'), 'USD'), /OFX\/QFX: Missing OFX document wrapper/);
  assert.throws(() => parseOFXStatement(ofx.replace('<FITID>2026100502', '<FITID>2026100201'), 'USD'), /Duplicate FITID/);
  assert.throws(() => parseOFXStatement(ofx.replace('20261005', '20260230'), 'USD'), /Transaction 2 has an invalid calendar date/);
  assert.throws(() => parseOFXStatement(ofx.replace('2400.00', '24,00'), 'USD'), /Transaction 2 needs a two-decimal numeric TRNAMT/);
  assert.throws(() => parseOFXStatement(ofx.replace('2400.00', '999999999999999999.99'), 'USD'), /exceeds safe integer cents/);
  assert.throws(() => parseOFXStatement(ofx, 'EUR'), /differs from workspace currency EUR/);
  assert.throws(() => parseOFXStatement('', 'USD'), /Empty or oversized/);
  // A transaction outside the list used to be dropped silently.
  const outside = ofx.replace('</BANKTRANLIST>', '</BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261010<TRNAMT>-1.00<FITID>z<NAME>Lost</STMTTRN>');
  assert.throws(() => parseOFXStatement(outside, 'USD'), /outside the statement transaction list/);
});

test('PREV-6 corpus: CAMT.053 statement with namespaces, balances and remittance text', () => {
  assert.deepEqual(parseCamt053Import(file('camt053.xml'), 'EUR'), [
    { date: '2026-10-07', amountCents: 123456, description: 'Rechnung 2026-117 & Service', reference: 'R-100', type: 'credit' },
    { date: '2026-10-09', amountCents: -2505, description: 'Kontoführung Oktober', reference: 'R-101', type: 'debit' },
  ]);
});

test('PREV-6 corpus: odd CAMT.053 files are refused whole', () => {
  const camt = file('camt053.xml');
  assert.throws(() => parseCamt053Import(file('camt053-truncated.xml'), 'EUR'), /CAMT\.053: Expected a complete CAMT\.053 Document/);
  assert.throws(() => parseCamt053Import(camt.replace('25.05', 'abc'), 'EUR'), /Entry 2 needs a nonnegative amount/);
  assert.throws(() => parseCamt053Import(camt.replace('<BookgDt><Dt>2026-10-09', '<BookgDt><Dt>2026-02-30'), 'EUR'), /Entry 2 has an invalid booking date/);
  // An entry outside the statement used to be dropped silently.
  const entry = camt.slice(camt.indexOf('<Ntry>'), camt.indexOf('</Ntry>') + 7);
  assert.throws(() => parseCamt053Import(camt.replace('</BkToCstmrStmt>', entry + '</BkToCstmrStmt>'), 'EUR'), /outside the statement/);
});

test('PREV-6 corpus: QuickBooks customer and product exports map to exact records; balances are not imported', () => {
  const customers = records('customers', 'quickbooks-customers.csv', true);
  assert.deepEqual(customers.errors, []);
  assert.deepEqual(customers.records.map(r => r.data), [
    { status: 'active', name: 'Acme LLC', email: 'office@example.test', phone: '555-1212', address: '11 Main St, Albany, NY, 12207, US' },
    { status: 'active', name: 'Baker, Smith & Co', email: 'ap@baker.example', address: 'Boston, MA, 02110, US' },
  ]);
  const items = records('items', 'quickbooks-items.csv', true);
  assert.deepEqual(items.errors, []);
  assert.deepEqual(items.records.map(r => [r.data.name, r.data.sku, r.data.unitPriceCents, r.data.unitCostCents, r.data.quantityAtHand]), [
    ['Consulting hour', 'SER-1', 12550, 8000, 0],
    ['Widget', 'W-10', 109999, 42010, 0],
  ]);
});

test('PREV-6 corpus: Xero chart of accounts export (starred headers) maps codes and types', () => {
  const accounts = records('accounts', 'xero-accounts.csv', false);
  assert.deepEqual(accounts.errors, []);
  assert.deepEqual(accounts.records.map(r => [r.data.code, r.data.name, r.data.type]), [
    ['090', 'Business Bank Account', 'asset'],
    ['200', 'Sales', 'revenue'],
    ['310', 'Cost of Goods Sold', 'cost_of_goods'],
    ['800', 'Accounts Payable', 'liability'],
  ]);
  assert.ok(accounts.records.every(r => !('balanceCents' in r.data)), 'the exported balance is never posted');
});

test('PREV-6 corpus: odd QuickBooks/Xero files list every problem row (the server then saves none)', () => {
  assert.deepEqual(records('customers', 'quickbooks-customers-duplicate.csv', true).errors, [{ row: 3, message: 'Same name as row 2' }]);
  assert.deepEqual(records('items', 'quickbooks-items-bad-price.csv', true).errors,
    [{ row: 3, field: 'unitPriceCents', message: 'Sale price: "ten dollars" is not an amount' }]);
  assert.match(records('accounts', 'xero-accounts-bad-type.csv', false).errors.map(e => `${e.row} ${e.message}`).join(), /^3 Type: "Wibble" is not an account type/);
  // A name of only control characters is missing, not an empty-named record (found by the fuzz test).
  const control = prepareImport('customers', [{ name: '\u000e\u0007' }]);
  assert.deepEqual(control.errors, [{ row: 2, field: 'name', message: 'Name is missing' }]);
  assert.equal(control.records.length, 0);
});
