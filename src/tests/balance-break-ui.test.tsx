/**
 * Since when don't the books balance? on Data Health (A-4, CA-34): what the panel says when the
 * books are off, that each entry of the break day opens in the usual record viewer, and that it
 * reports the balanced case as balanced. The search itself is in `src/tests/balance-break.test.ts`;
 * here it is the screen, read-only, with the report code run over the loaded records.
 *
 * `./helpers/dom` must be the first import; a DOM element is never asserted against null with
 * `assert.equal` (see the note at the top of `src/tests/cash-movement-ui.test.tsx`).
 */
import './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BalanceBreakPanel from '../components/system/BalanceBreakPanel';
import DataHealthView from '../components/system/DataHealthView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { makeChartAccount, makeTransaction } from './fixtures';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';
import type { ChartAccount } from '../types';

const bank: ChartAccount = makeChartAccount({ id: 'bank', code: '1010', name: 'Bank', type: 'asset', category: 'Cash' });
const sales: ChartAccount = makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'income', category: 'Revenue' });
const rent: ChartAccount = makeChartAccount({ id: 'rent', code: '6100', name: 'Rent', type: 'expense', category: 'Operating Expenses' });
const accounts = [bank, sales, rent];

const entry = (id: string, date: string, description: string, lines: Array<[string, number]>) => makeTransaction({
  id, date, description,
  lines: lines.map(([accountId, amountCents]) => ({ id: `line-${id}-${accountId}`, accountId, amountCents })),
});
const sale = (id: string, date: string) => entry(id, date, `Sale ${id}`, [['bank', 1000], ['sales', -1000]]);

describe('Since when the books don\'t balance (Data Health)', () => {
  beforeEach(() => {
    setComponentWorkspace('owner');
    useLedgerStore.setState({ accounts, transactions: [] });
  });
  afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

  test('a broken history names the day, the amount, and each entry’s share', () => {
    useLedgerStore.setState({
      transactions: [
        sale('t1', '2026-03-01'),
        entry('t2', '2026-03-05', 'Rent paid from the bank', [['rent', 30000], ['bank', -20000]]),
      ],
    });
    render(<BalanceBreakPanel />);
    const panel = screen.getByRole('region', { name: /Since when don.t the books balance/ });
    assert.match(panel.textContent || '', /stopped balancing on 2026-03-05/);
    assert.match(panel.textContent || '', /still balanced on 2026-03-01/);
    assert.match(panel.textContent || '', /off by \$100\.00/, '300.00 of rent against 200.00 out of the bank');
    assert.match(panel.textContent || '', /Rent paid from the bank/);
    assert.match(panel.textContent || '', /off by \$100\.00 \(adds to the difference\)/);
    assert.match(panel.textContent || '', /Read-only/);
  });

  test('each entry opens the usual record viewer, and a balanced history says so', () => {
    useLedgerStore.setState({ transactions: [sale('t1', '2026-03-01'), entry('t2', '2026-03-05', 'Odd entry', [['rent', 30000], ['bank', -20000]])] });
    render(<BalanceBreakPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the entry' }));
    assert.deepEqual(useUIStore.getState().focusRecord, { type: 'transaction', id: 't2' });
    assert.match(window.location.hash, /transactions\/transaction\/t2/);

    cleanup();
    useLedgerStore.setState({ transactions: [sale('t1', '2026-03-01'), sale('t2', '2026-03-05')] });
    render(<BalanceBreakPanel />);
    const balanced = screen.getByRole('region', { name: /Since when don.t the books balance/ });
    assert.match(balanced.textContent || '', /The books balance on/);
    assert.ok(screen.queryByRole('button', { name: 'Open the entry' }) === null, 'nothing to open when nothing is off');
  });

  test('the panel is part of Data Health, above the findings', () => {
    markComponentCollectionsLoaded('bankLines', 'bills', 'inventory', 'invoices', 'recurring');
    useLedgerStore.setState({
      transactions: [entry('t1', '2026-03-02', 'Cash sale entered short', [['bank', 50000], ['sales', -40000]])],
    });
    render(<DataHealthView />);
    assert.ok(screen.getByRole('heading', { name: 'Data health' }));
    const panel = screen.getByRole('region', { name: /Since when don.t the books balance/ });
    assert.match(panel.textContent || '', /stopped balancing on 2026-03-02/);
    assert.match(panel.textContent || '', /Cash sale entered short/);
    assert.ok(screen.getByRole('heading', { name: 'Entries whose debits and credits differ' }), 'the checks still run beside it');
  });
});
