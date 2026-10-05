/**
 * The Account Register (H-27, finance screens): an account's entries newest first with the running
 * balance from its opening balance; money in raises an asset, a charge raises a card's balance;
 * drafts are left out.
 */
import { stubFetch } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AccountRegisterView } from '../components/finance/AccountRegisterView';
import { useLedgerStore } from '../stores/useLedgerStore';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { TransactionLine } from '../types';

const line = (accountId: string, amountCents: number): TransactionLine => ({ accountId, accountName: accountId, amountCents });
const balanceCard = (label: string) => screen.getByText(label).parentElement!.textContent || '';
const rows = () => within(screen.getByRole('table', { name: 'Account Register' })).getAllByRole('row').slice(1).map(r => r.textContent || '');

describe('Account Register', () => {
  beforeEach(() => {
    stubFetch(404);
    useLedgerStore.setState({
      accounts: [
        makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', openingBalanceCents: 100000 }),
        makeChartAccount({ id: 'card', name: 'Visa', type: 'liability', category: 'Credit Card' }),
        makeChartAccount({ id: 'sales', name: 'Sales', type: 'income' }),
        makeChartAccount({ id: 'cogs', name: 'Cost of goods', type: 'cogs' as never }),
      ],
      transactions: [
        makeTransaction({ id: 't1', date: '2026-05-01', description: 'Sale', lines: [line('bank', 50000), line('sales', -50000)] }),
        makeTransaction({ id: 't2', date: '2026-05-03', description: 'Stock bought on card', lines: [line('cogs', 20000), line('card', -20000)] }),
        makeTransaction({ id: 't3', date: '2026-05-05', description: 'Card paid', lines: [line('card', 20000), line('bank', -20000)] }),
        makeTransaction({ id: 'd', date: '2026-05-06', description: 'Draft', status: 'draft', lines: [line('bank', 999900), line('sales', -999900)] }),
      ],
    });
  });
  afterEach(() => cleanup());

  test('bank: newest first, running balance from the opening balance, drafts left out', () => {
    render(<AccountRegisterView />);
    assert.match(balanceCard('Current Register Balance'), /\$1,300\.00/);
    const [paid, sale] = rows();
    assert.match(paid, /Card paid.*1300\.00/);
    assert.match(sale, /Sale.*1500\.00/);
    assert.equal(rows().length, 2);
  });

  test('a credit card: a charge raises what is owed, the payment brings it back to zero', () => {
    render(<AccountRegisterView />);
    fireEvent.change(screen.getByLabelText('Register account'), { target: { value: 'card' } });
    const [payment, charge] = rows();
    assert.match(charge, /Stock bought on card.*200\.00/);
    assert.match(payment, /Card paid.*0\.00/);
  });

  test('cost of goods (type cogs) goes up with a debit, like other expenses', () => {
    render(<AccountRegisterView />);
    fireEvent.change(screen.getByLabelText('Register account'), { target: { value: 'cogs' } });
    assert.match(balanceCard('Current Register Balance'), /\$200\.00/);
  });
});
