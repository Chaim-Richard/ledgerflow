/** Totals under the invoice and bill lists (I-14): per currency, drafts and voided not counted. */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import DocumentTotalsFoot from '../components/ui/DocumentTotalsFoot';
import { documentTotals } from '../lib/documentTotals';

afterEach(() => cleanup());

const docs = [
  { status: 'sent', amountCents: 10000 },
  { status: 'partially_paid', amountCents: 5000, amountPaidCents: 2000 },
  { status: 'sent', amountCents: 3000, depositCents: 1000, currency: 'usd' },
  { status: 'draft', amountCents: 99999 },
  { status: 'void', amountCents: 88888 },
  { status: 'paid', amountCents: 700, amountPaidCents: 700, currency: 'EUR' },
];

test('one line per currency, the home currency first; drafts and voided left out', () => {
  assert.deepEqual(documentTotals(docs, 'USD'), [
    { currency: 'USD', count: 3, amountCents: 18000, dueCents: 15000 },
    { currency: 'EUR', count: 1, amountCents: 700, dueCents: 0 },
  ]);
  assert.deepEqual(documentTotals([{ status: 'draft', amountCents: 5 }], 'USD'), []);
});

test('the footer row shows count, total and still due', () => {
  render(<table><DocumentTotalsFoot docs={docs.slice(0, 3)} homeCurrency="USD" colSpan={8} noun="invoice" /></table>);
  const row = screen.getByRole('row', { name: 'Totals in USD' });
  assert.match(row.textContent || '', /3 invoices \(drafts and voided not counted\)/);
  assert.match(row.textContent || '', /Total \$180\.00/);
  assert.match(row.textContent || '', /Still due \$150\.00/);
});
