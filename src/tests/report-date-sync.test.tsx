import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import ProfitAndLossView from '../components/ledger/ProfitAndLossView';
import BalanceSheetView from '../components/ledger/BalanceSheetView';
import TrialBalanceView from '../components/ledger/TrialBalanceView';
import CashFlowView from '../components/ledger/CashFlowView';
import StatementView from '../components/reporting/StatementView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { usePageSyncedState } from '../hooks/usePageSyncedState';

const dates = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="date"]'));
const period = { startDate: '2026-03-01', endDate: '2026-03-31' };
const nextPeriod = { startDate: '2026-04-01', endDate: '2026-04-30' };

describe('Report page date synchronization', () => {
  beforeEach(() => {
    stubFetch(404);
    useAuthStore.setState({ user: null, currentWorkspaceId: null, workspaces: [] });
    useLedgerStore.setState({ transactions: [], accounts: [], customers: [], vendors: [], invoices: [], bills: [], payments: [], journalEntries: [] });
  });
  afterEach(cleanup);

  for (const [name, View] of [['P&L', ProfitAndLossView], ['Cash Flow', CashFlowView], ['Statement', StatementView]] as const) {
    test(`${name}: local edits survive rerenders and changed page dates win`, () => {
      const view = render(<View {...period} />);
      assert.deepEqual(dates(view.container).slice(0, 2).map(input => input.value), Object.values(period));
      fireEvent.change(dates(view.container)[0], { target: { value: '2026-03-12' } });
      view.rerender(<View {...period} />);
      assert.equal(dates(view.container)[0].value, '2026-03-12');
      view.rerender(<View {...nextPeriod} />);
      assert.deepEqual(dates(view.container).slice(0, 2).map(input => input.value), Object.values(nextPeriod));
      view.rerender(<View />);
      assert.deepEqual(dates(view.container).slice(0, 2).map(input => input.value), Object.values(nextPeriod));
    });
  }

  test('Balance Sheet: changed page date restores the page date and comparison date', () => {
    const props = { accounts: [], formatCurrency: (value: number) => String(value) };
    const view = render(<BalanceSheetView {...props} asOfDate="2026-03-31" compareEndDate="2025-03-31" />);
    assert.deepEqual(dates(view.container).map(input => input.value), ['2026-03-31', '2025-03-31']);
    fireEvent.change(dates(view.container)[0], { target: { value: '2026-03-12' } });
    view.rerender(<BalanceSheetView {...props} asOfDate="2026-03-31" compareEndDate="2025-03-31" />);
    assert.equal(dates(view.container)[0].value, '2026-03-12');
    view.rerender(<BalanceSheetView {...props} asOfDate="2026-04-30" compareEndDate="2025-04-30" />);
    assert.deepEqual(dates(view.container).map(input => input.value), ['2026-04-30', '2025-04-30']);
    view.rerender(<BalanceSheetView {...props} asOfDate="2026-05-31" />);
    assert.deepEqual(dates(view.container).map(input => input.value), ['2026-05-31']);
  });

  test('P&L sends the page date immediately, without a stale default-period request', async () => {
    const urls = stubFetch(404);
    useAuthStore.setState({ currentWorkspaceId: 'date-sync' });
    const view = render(<ProfitAndLossView {...period} />);
    await waitFor(() => assert.ok(urls.some(url => url.includes('/reports/profit-and-loss'))));
    const requests = () => urls.filter(url => url.includes('/reports/profit-and-loss')).map(url => new URL(url, 'http://localhost').searchParams);
    assert.ok(requests().every(params => params.get('startDate') === period.startDate && params.get('endDate') === period.endDate));
    const previousCount = requests().length;
    view.rerender(<ProfitAndLossView {...nextPeriod} />);
    await waitFor(() => assert.ok(requests().length > previousCount));
    assert.ok(requests().slice(previousCount).every(params => params.get('startDate') === nextPeriod.startDate && params.get('endDate') === nextPeriod.endDate));
  });

  test('empty statements say what to do next while keeping their report controls', () => {
    const pl = render(<ProfitAndLossView {...period} />);
    assert.ok(pl.getByText('No report rows in this period'));
    assert.ok(pl.getByText(/Add an entry, clear any label filter/));
    pl.unmount();

    const balance = render(<BalanceSheetView accounts={[]} formatCurrency={String} asOfDate="2026-10-25" compareEndDate="2026-09-25" />);
    assert.ok(balance.getByText('No accounts yet'));
    assert.equal(dates(balance.container).length, 2);
    balance.unmount();

    const trial = render(<TrialBalanceView accounts={[]} formatCurrency={String} onDrillDown={() => {}} />);
    assert.ok(trial.getByText('No accounts found'));
    assert.ok(trial.getByText(/Set up the chart of accounts/));
  });

  test('local functional updates and disabled page synchronization retain their value', () => {
    function Counter({ pageKey, pageValue }: { pageKey: string; pageValue?: number }) {
      const [value, setValue] = usePageSyncedState(pageKey, pageValue, 0);
      return <button onClick={() => setValue(previous => previous + 1)}>{value}</button>;
    }
    const view = render(<Counter pageKey="first" pageValue={4} />);
    fireEvent.click(view.getByRole('button'));
    assert.equal(view.getByRole('button').textContent, '5');
    view.rerender(<Counter pageKey="first" pageValue={4} />);
    assert.equal(view.getByRole('button').textContent, '5');
    view.rerender(<Counter pageKey="second" />);
    assert.equal(view.getByRole('button').textContent, '5');
    view.rerender(<Counter pageKey="third" pageValue={0} />);
    assert.equal(view.getByRole('button').textContent, '0');
  });
});
