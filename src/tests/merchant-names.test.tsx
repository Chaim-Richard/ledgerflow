/**
 * Transaction enrichment (K-36): bank text becomes a readable payee name (card-processor prefixes,
 * card numbers, dates, store numbers and codes removed; well-known merchants named; non-Latin text
 * kept), and the bank's own text stays visible under it.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import BankLineName from '../components/ui/BankLineName';
import { cleanMerchantName, lineKind } from '../lib/merchantNames';

describe('Readable names', () => {
  test('typical card lines', () => {
    const cases: Array<[string, string]> = [
      ['SQ *JOES COFFEE 4421 SEATTLE WA', 'Joes Coffee'],
      ['POS PURCHASE SHELL OIL 57444 10/03', 'Shell Oil'],
      ['TST* THE BURGER JOINT', 'The Burger Joint'],
      ['CHECKCARD 1003 HOME DEPOT #4521', 'Home Depot'],
      ['DEBIT CARD PURCHASE XXXX1234 BEST BUY 00012345', 'Best Buy'],
      ['PAYPAL *ETSY INC', 'Etsy Inc'],
      ['Wix.com Ltd 800-123', 'Wix.com Ltd'],
      ['ACH TRANSFER TO SAVINGS 12345', 'Transfer to Savings'],
      ['Acme Design LLC', 'Acme Design LLC'],
    ];
    assert.deepEqual(cases.map(([raw]) => cleanMerchantName(raw)), cases.map(([, name]) => name));
  });

  test('well-known merchants get their usual name', () => {
    assert.deepEqual(['AMZN Mktp US*2K4L91TQ0', 'UBER EATS PENDING', 'GOOGLE *GSUITE_ACME', 'FACEBK *ADS 4X2'].map(cleanMerchantName), ['Amazon', 'Uber Eats', 'Google', 'Meta']);
  });

  test('Hebrew and other non-Latin text is kept, only the trailing number goes; empty stays empty', () => {
    assert.equal(cleanMerchantName('רמי לוי שיווק השקמה 1234'), 'רמי לוי שיווק השקמה');
    assert.equal(cleanMerchantName(''), '');
    assert.equal(cleanMerchantName('1234 5678'), '1234 5678', 'nothing readable: the text itself');
  });

  test('what kind of line it looks like', () => {
    assert.deepEqual(['MONTHLY SERVICE FEE', 'Interest payment', 'REFUND AMAZON', 'ZELLE TO DANA', 'ACME PAYROLL'].map(lineKind), ['fee', 'interest', 'refund', 'transfer', 'payroll']);
    assert.equal(lineKind('JOES COFFEE'), null);
  });
});

describe('On screen', () => {
  afterEach(() => cleanup());

  test('the clean name, with the bank text underneath and on hover', () => {
    render(<BankLineName text="SQ *JOES COFFEE 4421 SEATTLE WA" />);
    assert.ok(screen.getByText('Joes Coffee'));
    assert.ok(screen.getByText('SQ *JOES COFFEE 4421 SEATTLE WA'));
    assert.equal(screen.getByTitle('SQ *JOES COFFEE 4421 SEATTLE WA').textContent, 'Joes CoffeeSQ *JOES COFFEE 4421 SEATTLE WA');
  });

  test('a name that is already clean is shown once', () => {
    render(<BankLineName text="Acme Design LLC" />);
    assert.equal(screen.getAllByText('Acme Design LLC').length, 1);
  });
});
