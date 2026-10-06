/**
 * Deferred-revenue waterfall (J-14): per spread invoice (or bill), what is earned in each month of the
 * period, by its end, and still deferred after it; read from the monthly entries, so a voided share
 * doesn't count; the report shows it, switchable to prepaid expenses.
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SpreadWaterfallView from '../components/reporting/SpreadWaterfallView';
import { monthsBetween, spreadWaterfall } from '../lib/spreadWaterfall';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';

const share = (id: string, docId: string, date: string, cents: number, over: Record<string, unknown> = {}) =>
  ({ id, date, status: 'completed', totalAmountCents: cents, metadata: { type: 'revenue-recognition', spreadOfInvoiceId: docId, scheduled: true }, ...over });
const entries = [
  share('a1', 'i1', '2026-09-30', 10000), share('a2', 'i1', '2026-10-31', 10000), share('a3', 'i1', '2026-11-30', 10000), share('a4', 'i1', '2026-12-31', 10011),
  share('b1', 'i2', '2026-10-31', 5000), share('b2', 'i2', '2026-11-30', 5000, { status: 'void' }),
  { id: 'first', date: '2026-09-15', status: 'completed', totalAmountCents: 40011, metadata: { type: 'deferred-revenue', spreadOfInvoiceId: 'i1' } },
  share('p1', 'b9', '2026-10-31', 700, { metadata: { type: 'prepaid-recognition', spreadOfBillId: 'b9' } }),
];
const invoices = [{ id: 'i1', number: 'INV-1', customerName: 'Acme' }, { id: 'i2', number: 'INV-2', customerName: 'Beta' }];

describe('The waterfall', () => {
  test('months of the period', () => {
    assert.deepEqual(monthsBetween('2026-11-15', '2027-02-10'), ['2026-11', '2026-12', '2027-01', '2027-02']);
    assert.equal(monthsBetween('2020-01-01', '2026-12-31').length, 36, 'at most three years of columns');
  });

  test('earned per month, by the end, and still deferred; voided shares and the first move are not income', () => {
    const w = spreadWaterfall(entries, invoices, 'invoice', { startDate: '2026-10-01', endDate: '2026-11-30' });
    assert.deepEqual(w.months, ['2026-10', '2026-11']);
    assert.deepEqual(w.rows.map(r => [r.label, r.byMonth, r.earnedCents, r.deferredCents]), [
      ['Invoice INV-1 · Acme', { '2026-10': 10000, '2026-11': 10000 }, 30000, 10011],
      ['Invoice INV-2 · Beta', { '2026-10': 5000 }, 5000, 0],
    ]);
    assert.deepEqual(w.totals, { byMonth: { '2026-10': 15000, '2026-11': 10000 }, earnedCents: 35000, deferredCents: 10011 });
  });

  test('the same for prepaid expenses', () => {
    const w = spreadWaterfall(entries, [{ id: 'b9', number: 'B-9', vendorName: 'Shield' }], 'bill', { startDate: '2026-10-01', endDate: '2026-10-31' });
    assert.deepEqual(w.rows.map(r => [r.label, r.earnedCents]), [['Bill B-9 · Shield', 700]]);
  });
});

describe('The report', () => {
  beforeEach(() => {
    setComponentWorkspace('viewer');
    markComponentCollectionsLoaded('transactions', 'invoices', 'bills');
    useLedgerStore.setState({ transactions: entries as never, invoices: invoices as never, bills: [{ id: 'b9', number: 'B-9', vendorName: 'Shield' }] as never });
  });
  afterEach(() => cleanup());

  test('shows the invoices by month with totals, and switches to bills', () => {
    render(<SpreadWaterfallView startDate="2026-10-01" endDate="2026-11-30" />);
    const region = screen.getByRole('region', { name: 'Deferred revenue waterfall' });
    assert.ok(screen.getByRole('columnheader', { name: 'Earned by 2026-11-30' }));
    assert.match(region.textContent || '', /Invoice INV-1 · Acme\$100\.00\$100\.00\$300\.00\$100\.11/);
    assert.match(region.textContent || '', /Total\$150\.00\$100\.00\$350\.00\$100\.11/);
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'bill' } });
    assert.ok(screen.getByRole('columnheader', { name: 'Still prepaid after 2026-11-30' }));
    assert.match(region.textContent || '', /Bill B-9 · Shield/);
  });

  test('an invalid period says so', () => {
    render(<SpreadWaterfallView startDate="" endDate="" />);
    assert.equal(screen.getByRole('alert').textContent, 'Choose a valid report period.');
  });
});
