/**
 * R-09 close comparison panel (AI #3, A-1): what the person closing the month sees beside the two
 * comparisons, and that looking at it never writes anything.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CloseComparisonPanel from '../components/ledger/CloseComparisonPanel';
import { useLedgerStore } from '../stores/useLedgerStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount, makeTransaction } from './fixtures';

const accounts = [
  makeChartAccount({ id: 'cash', code: '1000', name: 'Cash', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'ar', code: '1100', name: 'Accounts receivable', type: 'asset', category: 'Receivables' }),
  makeChartAccount({ id: 'ap', code: '2000', name: 'Accounts payable', type: 'liability', category: 'Payables' }),
  makeChartAccount({ id: 'sales', code: '4000', name: 'Sales', type: 'revenue', category: 'Revenue' }),
  makeChartAccount({ id: 'rent', code: '5000', name: 'Rent', type: 'expense', category: 'Expenses' }),
];

const line = (accountId: string, amountCents: number) => ({ id: `${accountId}-${amountCents}`, accountId, amountCents });
const tx = (id: string, date: string, lines: Array<{ id: string; accountId: string; amountCents: number }>) =>
  makeTransaction({ id, date, status: 'completed', lines: lines as ReturnType<typeof makeTransaction>['lines'] });

const transactions = [
  tx('t1', '2026-09-10', [line('ar', 100_000), line('sales', -100_000)]),
  tx('t3', '2026-09-20', [line('cash', 50_000), line('sales', -50_000)]),
  tx('t2', '2026-09-15', [line('rent', 20_000), line('cash', -20_000)]),
  tx('t4', '2026-08-10', [line('ar', 40_000), line('sales', -40_000)]),
  tx('t5', '2026-08-15', [line('rent', 10_000), line('cash', -10_000)]),
  tx('t6', '2025-09-10', [line('ar', 10_000), line('sales', -10_000)]),
  tx('t7', '2025-09-15', [line('rent', 5_000), line('rent', 0), line('ap', -5_000)]),
];

function setup(role: 'owner' | 'viewer' = 'owner') {
  setComponentWorkspace(role);
  useLedgerStore.setState({ accounts, transactions });
}

function statementTable(name: RegExp): HTMLElement {
  return screen.getByRole('table', { name });
}

function rowOf(table: HTMLElement, label: string): HTMLElement {
  const row = within(table).getAllByRole('row')
    .find(candidate => (candidate.querySelector('th[scope="row"]')?.textContent || '').startsWith(label));
  assert.ok(row, `a row starting with "${label}"`);
  return row;
}

const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map(cell => cell.textContent);

describe('close comparison panel', () => {
  afterEach(() => cleanup());

  test('shows the month beside the previous month and the same month last year', () => {
    setup();
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => { calls.push(String(input)); return new Response('{}'); }) as typeof fetch;
    render(<CloseComparisonPanel month="2026-09" currency="USD" />);

    assert.ok(screen.getByRole('heading', { name: 'Compare September 2026' }));
    const pl = statementTable(/Profit & loss: September 2026 beside August 2026 and September 2025/);
    const salesRow = rowOf(pl, 'Sales');
    assert.deepEqual(cells(salesRow), ['$1,500.00', '$400.00', '+$1,100.00 (275.0%)', '$100.00', '+$1,400.00 (1400.0%)']);
    assert.ok(within(salesRow).getByText('Big move'), 'the 275% sale is flagged');
    const rentRow = rowOf(pl, 'Rent');
    assert.deepEqual(cells(rentRow), ['$200.00', '$100.00', '+$100.00 (100.0%)', '$50.00', '+$150.00 (300.0%)']);
    assert.equal(within(rentRow).queryByText('Big move'), null, 'under the default $1,000, so plain');

    const bs = statementTable(/Balance sheet: September 2026 beside August 2026 and September 2025/);
    assert.deepEqual(cells(rowOf(bs, 'Total assets')), ['$1,700.00', '$400.00', '+$1,300.00 (325.0%)', '$100.00', '+$1,600.00 (1600.0%)']);
    assert.deepEqual(cells(rowOf(bs, 'Total liabilities and equity')), ['$1,700.00', '$400.00', '+$1,300.00 (325.0%)', '$100.00', '+$1,600.00 (1600.0%)']);
    assert.match(screen.getByText(/big moves? to look at before closing:/).textContent || '', /^9 big moves/);

    assert.deepEqual(calls, [], 'looking at the comparison must not write or fetch anything');
  });

  test('the amount to look for changes the flags, and nonsense falls back to the default', () => {
    setup();
    render(<CloseComparisonPanel month="2026-09" currency="USD" />);
    const threshold = screen.getByLabelText('Flag moves of at least');
    fireEvent.change(threshold, { target: { value: '200000' } });
    assert.equal(screen.queryAllByText('Big move').length, 0);
    assert.ok(screen.getByText('No moves this big in either comparison.'));

    fireEvent.change(threshold, { target: { value: 'abc' } });
    assert.match(screen.getByText(/Not an amount/).textContent || '', /using \$1,000\.00/);
    assert.ok(screen.getAllByText('Big move').length > 0, 'the default amount applies again');

    fireEvent.change(threshold, { target: { value: '1,500' } });
    assert.equal(screen.queryByText(/Not an amount/), null);
    assert.ok(screen.getAllByText('Big move').length > 0);
  });

  test('a quieter month says so, and the panel never hides the totals', () => {
    setup();
    useLedgerStore.setState({
      accounts,
      transactions: [tx('quiet', '2026-08-10', [line('ar', 1_000), line('sales', -1_000)])],
    });
    render(<CloseComparisonPanel month="2026-09" currency="USD" />);
    assert.ok(screen.getByText('No moves this big in either comparison.'));
    const pl = statementTable(/Profit & loss: September 2026 beside August 2026 and September 2025/);
    assert.ok(within(pl).getByText('Total income'), 'totals stay in the table');
    assert.ok(within(pl).getByText('Net income'));
  });
});
