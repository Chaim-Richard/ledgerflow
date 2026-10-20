import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCamt053Import } from '../lib/camt053Import';

const ntry = (amt: string, cur: string, dir: string, date: string, id: string, desc: string) =>
  '<Ntry><NtryRef>' + id + '</NtryRef><Amt Ccy="' + cur + '">' + amt +
  '</Amt><CdtDbtInd>' + dir + '</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts>' +
  '<BookgDt><Dt>' + date + '</Dt></BookgDt>' +
  '<NtryDtls><TxDtls><RmtInf><Ustrd>' + desc + '</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>';
const wrap = (...rows: string[]) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt>' +
  '<Stmt><Id>Statement-2026-10</Id><Acct><Id><IBAN>DE44500105175407324931</IBAN></Id><Ccy>EUR</Ccy></Acct>' +
  rows.join('') + '</Stmt></BkToCstmrStmt></Document>';

const sample = wrap(
  ntry('1234.56', 'EUR', 'CRDT', '2026-10-07', 'ref-1', 'Rechnung &amp; Service'),
  ntry('25.05', 'EUR', 'DBIT', '2026-10-09', 'ref-2', 'שירות'),
);

test('E-31: two CAMT.053 entries stage separately with exact integer cents, calendar dates and Unicode', () => {
  const got = parseCamt053Import(sample, 'EUR');
  assert.deepEqual(got, [
    { date: '2026-10-07', amountCents: 123456, description: 'Rechnung & Service', reference: 'ref-1', type: 'credit' },
    { date: '2026-10-09', amountCents: -2505, description: 'שירות', reference: 'ref-2', type: 'debit' },
  ]);
});

test('E-31: prefixed namespace syntax also stages valid entries', () => {
  const prefixed = sample
    .replace('<Document ', '<ns:Document ')
    .replace('</Document>', '</ns:Document>')
    .replaceAll('<Ntry>', '<ns:Ntry>')
    .replaceAll('</Ntry>', '</ns:Ntry>')
    .replaceAll('<Amt ', '<ns:Amt ')
    .replaceAll('</Amt>', '</ns:Amt>');
  assert.deepEqual(parseCamt053Import(prefixed, 'EUR'), parseCamt053Import(sample, 'EUR'));
});

test('E-31: missing date, invalid day or missing entry currency refuse the whole file', () => {
  assert.throws(() => parseCamt053Import(sample.replace('<BookgDt><Dt>2026-10-07</Dt></BookgDt>', ''), 'EUR'), /booking date/);
  assert.throws(() => parseCamt053Import(sample.replace('2026-10-09', '2026-02-30'), 'EUR'), /invalid booking date/);
  assert.throws(() => parseCamt053Import(sample.replace('Amt Ccy="EUR"', 'Amt'), 'EUR'), /no currency/);
  assert.throws(() => parseCamt053Import(sample.replace('CdtDbtInd>DBIT', 'CdtDbtInd>UNKNOWN'), 'EUR'), /CRDT or DBIT/);
});

test('E-31: no silent rounding, amount guessing, wrong currency or overflow', () => {
  assert.throws(() => parseCamt053Import(sample.replace('1234.56', '1234.567'), 'EUR'), /two decimal|two decimal places|at most two/);
  assert.throws(() => parseCamt053Import(sample.replace('1234.56', '0.00'), 'EUR'), /zero or out-of-range/);
  assert.throws(() => parseCamt053Import(sample.replace('1234.56', '9999999999999999.99'), 'EUR'), /zero or out-of-range/);
  assert.throws(() => parseCamt053Import(sample, 'USD'), /Account currency differs/);
  assert.throws(() => parseCamt053Import(sample.replace('Ccy="EUR">25.05', 'Ccy="USD">25.05'), 'EUR'), /currency USD differs/);
  assert.throws(() => parseCamt053Import(sample.replace('<Ccy>EUR</Ccy>', '<Ccy>USD</Ccy>'), 'USD'), /currency EUR differs|currency differs/);
});

test('E-31: rejects unsupported aggregation, XML entities, corrections, unbooked entries and missing close', () => {
  const first = ntry('5.00', 'EUR', 'CRDT', '2026-10-05', 'id-1', 'Fee');
  const extra = first.replace('</NtryDtls>', '<TxDtls><RmtInf><Ustrd>Second</Ustrd></RmtInf></TxDtls></NtryDtls>');
  assert.throws(() => parseCamt053Import(wrap(extra), 'EUR'), /multiple transaction details/);
  assert.throws(() => parseCamt053Import(wrap(first.replace('</Ntry>', '')), 'EUR'), /Missing closing/);
  assert.throws(() => parseCamt053Import(sample.replace('BOOK</Cd>', 'PDNG</Cd>'), 'EUR'), /not booked/);
  assert.throws(() => parseCamt053Import(sample.replace('<Amt Ccy="EUR">', '<RvslInd>true</RvslInd><Amt Ccy="EUR">'), 'EUR'), /reversal information/);
  assert.throws(() => parseCamt053Import('<!DOCTYPE data [<!ENTITY foo SYSTEM "file:///etc/passwd">]>' + sample, 'EUR'), /DTD/);
  assert.throws(() => parseCamt053Import(sample.replace('Rechnung &amp; Service', 'Rechnung &danger; Service'), 'EUR'), /Unsupported XML entity/);
  assert.throws(() => parseCamt053Import(sample.replace('</Stmt>', '</Stmt><Stmt></Stmt>'), 'EUR'), /exactly one bank statement/);
  assert.throws(() => parseCamt053Import('<Ntry>123</Ntry>', 'EUR'), /complete CAMT\.053/);
  assert.throws(() => parseCamt053Import('x'.repeat(5_000_001), 'EUR'), /oversized/);
});
