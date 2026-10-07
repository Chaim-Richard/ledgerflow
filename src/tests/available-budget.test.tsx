/**
 * Available budget (M-20): for an account and a date, the budget for that period (month, quarter or
 * year), what the books already show spent, what is left, and whether this amount would go over;
 * the document being edited does not count against itself. Shown under the account where money is entered.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { availableBudget } from '../lib/availableBudget';
import { BudgetLeft } from '../components/common/BudgetLeft';
import { useLedgerStore } from '../stores/useLedgerStore';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { SavedBudget } from '../lib/budgetActual';

const accounts = [
  makeChartAccount({ id: 'rent', code: '6100', name: 'Rent', type: 'expense', category: 'Operating' }),
  makeChartAccount({ id: 'travel', code: '6200', name: 'Travel', type: 'expense', category: 'Operating' }),
  makeChartAccount({ id: 'bank', code: '1000', name: 'Bank', type: 'asset', category: 'Cash' }),
];
const spend = (id: string, date: string, account: string, cents: number, metadata = {}) => makeTransaction({
  id, date, status: 'completed', metadata, lines: [{ accountId: account, amountCents: cents }, { accountId: 'bank', amountCents: -cents }],
});
const transactions = [spend('t1', '2026-10-03', 'rent', 120_000), spend('t2', '2026-09-30', 'rent', 50_000), spend('t3', '2026-11-02', 'travel', 90_000, { billId: 'b9' })];
const budgets: SavedBudget[] = [
  { id: 'b-rent', uid: 'u', targetId: 'rent', targetType: 'account', period: 'monthly', amountCents: 200_000, createdAt: '2026-01-01', name: 'Rent' },
  { id: 'b-travel', uid: 'u', targetId: 'Travel', targetType: 'account', period: 'quarterly', amountCents: 300_000, createdAt: '2026-01-01' },
];

describe('What is left', () => {
  test('a month: 2,000.00 for October, 1,200.00 spent (September does not count), 800.00 left; 1,000.00 more would go over', () => {
    assert.deepEqual(availableBudget({ budgets, accounts, transactions, accountId: 'rent', date: '2026-10-20', addingCents: 100_000 }),
      { name: 'Rent', period: 'October 2026', budgetCents: 200_000, spentCents: 120_000, leftCents: 80_000, wouldExceed: true });
    assert.equal(availableBudget({ budgets, accounts, transactions, accountId: 'rent', date: '2026-10-20', addingCents: 80_000 })?.wouldExceed, false, 'exactly what is left fits');
  });

  test('a quarter, matched by the account name: Oct–Dec; the bill being edited is not counted against itself', () => {
    const left = availableBudget({ budgets, accounts, transactions, accountId: 'travel', date: '2026-11-15' })!;
    assert.deepEqual([left.period, left.budgetCents, left.spentCents, left.leftCents], ['Oct–Dec 2026', 300_000, 90_000, 210_000]);
    assert.equal(availableBudget({ budgets, accounts, transactions, accountId: 'travel', date: '2026-11-15', excludeDocumentId: 'b9' })?.spentCents, 0);
  });

  test('no budget on the account, or no account: nothing to say', () => {
    assert.equal(availableBudget({ budgets, accounts, transactions, accountId: 'bank', date: '2026-10-20' }), null);
    assert.equal(availableBudget({ budgets, accounts, transactions, accountId: '', date: '2026-10-20' }), null);
  });
});

describe('Under the account where money is entered', () => {
  afterEach(() => cleanup());

  test('says what is left, and in amber how far this amount goes over', () => {
    setComponentWorkspace('bookkeeper');
    useLedgerStore.setState({ budgets, accounts, transactions } as never);
    markComponentCollectionsLoaded('budgets');
    const { rerender } = render(<BudgetLeft accountId="rent" date="2026-10-20" addingCents={50_000} currency="USD" />);
    assert.equal(screen.getByRole('status').textContent, 'Rent, October 2026: $800.00 left of $2,000.00');
    rerender(<BudgetLeft accountId="rent" date="2026-10-20" addingCents={100_000} currency="USD" />);
    assert.equal(screen.getByRole('status').textContent, 'Rent, October 2026: $800.00 left of $2,000.00; this goes $200.00 over');
    rerender(<BudgetLeft accountId="bank" date="2026-10-20" addingCents={100_000} currency="USD" />);
    assert.equal(screen.queryByRole('status'), null);
  });
});
