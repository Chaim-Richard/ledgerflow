import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOFXStatement } from '../lib/ofxParser';

const sgml = [
  'OFXHEADER:100', 'DATA:OFXSGML', 'VERSION:102', '',
  '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>',
  '<CURDEF>USD<BANKACCTFROM><BANKID>000001<ACCTID>000012345</BANKACCTFROM>',
  '<BANKTRANLIST><DTSTART>20261001<DTEND>20261031',
  '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005080000<TRNAMT>-12.30<FITID>statement-1<NAME>Books &amp; stationery<MEMO>Monthly order</STMTTRN>',
  '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261006<TRNAMT>100.05<FITID>statement-2<NAME>הפקדה</STMTTRN>',
  '</BANKTRANLIST><LEDGERBAL><BALAMT>1500.00</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>',
].join('\n');

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<?OFX OFXHEADER="200" VERSION="211"?>',
  '<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>',
  '<CURDEF>USD</CURDEF><CCACCTFROM><ACCTID>XXXX4321</ACCTID></CCACCTFROM>',
  '<BANKTRANLIST><STMTTRN><TRNTYPE>PAYMENT</TRNTYPE>',
  '<DTPOSTED>20261009153000.000[-5:EST]</DTPOSTED><TRNAMT>123.45</TRNAMT>',
  '<FITID>card-ref-4</FITID><NAME>Refund</NAME></STMTTRN></BANKTRANLIST>',
  '</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>',
].join('');

test('E-30: OFX SGML bank statement preserves sign, posted day, FITID and Hebrew, ignores balance as transaction', () => {
  const actual = parseOFXStatement(sgml, 'USD');
  assert.deepEqual(actual, [
    { date: '2026-10-05', amountCents: -1230, description: 'Books & stationery — Monthly order', reference: 'statement-1', type: 'debit' },
    { date: '2026-10-06', amountCents: 10005, description: 'הפקדה', reference: 'statement-2', type: 'credit' },
  ]);
  assert.equal(actual.length, 2);
});

test('E-30: XML-style QFX card statement uses amount sign and full timestamp date', () => {
  assert.deepEqual(parseOFXStatement(xml, 'USD'), [
    { date: '2026-10-09', amountCents: 12345, description: 'Refund', reference: 'card-ref-4', type: 'credit' },
  ]);
});

test('E-30: rejects currency mismatch or unsupported minor units without guessing rates', () => {
  assert.throws(() => parseOFXStatement(sgml, 'EUR'), /differs from workspace currency EUR/);
  assert.throws(() => parseOFXStatement(xml.replace('<CURDEF>USD', '<CURDEF>JPY'), 'JPY'), /two-decimal|Unsupported statement currency/);
  assert.throws(() => parseOFXStatement(xml.replace('<CURDEF>USD', '<CURDEF>KWD'), 'KWD'), /two-decimal|Unsupported statement currency/);
});

test('E-30: decimal precision, negative entries and oversized amounts refuse complete file', () => {
  assert.throws(() => parseOFXStatement(sgml.replace('-12.30', '-12.301'), 'USD'), /TRNAMT/);
  assert.throws(() => parseOFXStatement(sgml.replace('-12.30', 'not-number'), 'USD'), /TRNAMT/);
  assert.throws(() => parseOFXStatement(sgml.replace('-12.30', '9999999999999999999.99'), 'USD'), /safe integer/);
  assert.throws(() => parseOFXStatement(sgml.replace('-12.30', '0.00'), 'USD'), /zero amount/);
});

test('E-30: malformed, ambiguous and multi-account statement files refuse', () => {
  const broken = sgml.replace('</STMTTRN>', '');
  assert.throws(() => parseOFXStatement(broken, 'USD'), /Transaction blocks/);
  assert.throws(() => parseOFXStatement(sgml.replace('<CURDEF>USD', ''), 'USD'), /CURDEF/);
  assert.throws(() => parseOFXStatement(sgml.replace('<ACCTID>000012345', ''), 'USD'), /identifier/);
  assert.throws(() => parseOFXStatement(sgml.replace('20261006', '20260230'), 'USD'), /invalid calendar date/);
  assert.throws(() => parseOFXStatement(sgml.replace('statement-2', 'statement-1'), 'USD'), /Duplicate FITID/);
  assert.throws(() => parseOFXStatement(sgml.replace('</OFX>', '</OFX>' + xml), 'USD'), /one complete bank or credit-card account/);
  assert.throws(() => parseOFXStatement(sgml.replace('</STMTTRN>', '<CORRECTACTION>REPLACE</STMTTRN>'), 'USD'), /correction review/);
  assert.throws(() => parseOFXStatement('<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + sgml, 'USD'), /DTD/);
  assert.throws(() => parseOFXStatement('not an OFX file'), /Missing OFX/);
  assert.throws(() => parseOFXStatement('X'.repeat(5_000_001)), /oversized/);
});

test('E-30: numeric XML entities decode but external entities and FX annotations refuse', () => {
  const withNumeric = xml.replace('Refund', '&#x5E9;&#1500;&#1493;&#1501;');
  const parsed = parseOFXStatement(withNumeric);
  assert.equal(parsed[0].description, 'שלום');
  assert.throws(() => parseOFXStatement(xml.replace('<NAME>Refund', '<CURRENCY><CURRATE>1.1</CURRATE></CURRENCY><NAME>Refund')), /currency or correction review/);
});
