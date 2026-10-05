/**
 * Money in / money out (BA-17), the rules the dialogs are built on: what may be recorded here, what is
 * refused and said in words, and the shape of the entry that comes out — two lines, whole cents,
 * summing to zero, the amount of the entry being what moved.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  cashAccountOptions, cashMovementProblem, cashMovementSentence, counterAccountChoices, createCashMovement,
} from '../lib/cashMovement';
import type { ChartAccount, Transaction } from '../types';
import { makeChartAccount } from './fixtures';

const accounts: ChartAccount[] = [
  makeChartAccount({ id: 'checking', name: 'Business Checking', code: '1000', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'petty', name: 'Petty Cash', code: '1010', type: 'asset', category: 'Cash' }),
  makeChartAccount({ id: 'ar', name: 'Accounts Receivable', code: '1200', type: 'asset', category: 'Accounts Receivable' }),
  makeChartAccount({ id: 'ap', name: 'Accounts Payable', code: '2000', type: 'liability', category: 'Accounts Payable' }),
  makeChartAccount({ id: 'deposits', name: 'Customer Deposits', code: '2100', type: 'liability', category: 'Current Liabilities' }),
  makeChartAccount({ id: 'rent', name: 'Rent', code: '6100', type: 'expense', category: 'Operating Expenses' }),
  makeChartAccount({ id: 'sales', name: 'Sales of Services', code: '4000', type: 'revenue', category: 'Sales' }),
  makeChartAccount({ id: 'equity-in', name: 'Owner Contributions', code: '3000', type: 'equity', category: 'Equity' }),
  makeChartAccount({ id: 'closed', name: 'Old Bank', code: '1099', type: 'asset', category: 'Cash', isArchived: true }),
];
const transactions: Transaction[] = [
  { id: 't1', lines: [{ accountId: 'rent', amountCents: 1000 }, { accountId: 'rent', amountCents: 200 }, { accountId: 'sales', amountCents: -1200 }] } as Transaction,
];

const money = (cents: number) => `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;
const inParams = {
  workspaceId: 'ws', uid: 'u', direction: 'in' as const,
  amountCents: 12550, date: '2026-10-05',
  cashAccount: { id: 'checking', name: 'Business Checking' },
  counterAccount: { id: 'sales', name: 'Sales of Services' },
  currency: 'USD',
};

describe('what the entry is', () => {
  test('money in: the bank account is taken, the account it is for is given, in whole cents', () => {
    const tx = createCashMovement(inParams);
    assert.deepEqual(tx.lines!.map(l => [l.accountId, l.amountCents]), [['checking', 12550], ['sales', -12550]]);
    assert.equal(tx.lines!.reduce((n, l) => n + l.amountCents, 0), 0, 'the entry balances to exactly zero');
    assert.equal(tx.totalAmountCents, 12550, 'the amount of the entry is what moved, not the sum of the lines');
    assert.equal(tx.currency, 'USD');
    assert.equal(tx.exchangeRate, 1, 'typed in the workspace currency, so there is nothing to convert');
    assert.equal(tx.status, 'completed');
    assert.equal(tx.date, '2026-10-05');
    assert.equal(tx.description, 'Money received: Sales of Services');
  });

  test('money out: the same entry the other way round', () => {
    const tx = createCashMovement({ ...inParams, direction: 'out', amountCents: 90000, counterAccount: { id: 'rent', name: 'Rent' } });
    assert.deepEqual(tx.lines!.map(l => [l.accountId, l.amountCents]), [['checking', -90000], ['rent', 90000]]);
    assert.equal(tx.totalAmountCents, 90000, 'money out is not a negative amount');
    assert.equal(tx.description, 'Money paid: Rent');
  });

  test('the bank line carries no description, the account line does', () => {
    const tx = createCashMovement({ ...inParams, description: 'October workshop' });
    assert.equal(tx.lines![0].description, undefined, 'the workspace must not learn that October workshop belongs to the bank account');
    assert.equal(tx.lines![1].description, 'October workshop');
    assert.equal(tx.description, 'October workshop');
  });

  test('a name is written into the description, and a reference only when there is one', () => {
    const named = createCashMovement({ ...inParams, contactName: '  Acme Ltd ' });
    assert.equal(named.description, 'Money received from Acme Ltd', 'the name is trimmed once');
    assert.equal(named.reference, undefined, 'no reference means no reference field');
    const withRef = createCashMovement({ ...inParams, reference: '1042' });
    assert.equal(withRef.reference, '1042');
  });

  test('the sentence after posting says the amount, who and which account', () => {
    assert.equal(cashMovementSentence({ ...inParams, contactName: 'Acme Ltd' }, money), 'Money received from Acme Ltd: $125.50 into Business Checking.');
    assert.equal(cashMovementSentence({ ...inParams, direction: 'out', counterAccount: { id: 'rent', name: 'Rent' } }, money), 'Money paid: $125.50 out of Business Checking.');
  });
});

describe('what is refused, and said out loud', () => {
  const draft = { direction: 'in' as const, amountCents: 5000, date: '2026-10-05', cashAccountId: 'checking', counterAccountId: 'sales' };

  test('a whole pair is fine', () => {
    assert.equal(cashMovementProblem(draft, accounts), null);
  });

  test('nothing at all, or not in whole cents', () => {
    assert.match(String(cashMovementProblem({ ...draft, amountCents: 0 }, accounts)), /whole cents/);
    assert.match(String(cashMovementProblem({ ...draft, amountCents: -5000 }, accounts)), /whole cents/);
    assert.match(String(cashMovementProblem({ ...draft, amountCents: 1250.5 }, accounts)), /whole cents/, 'half a cent cannot be posted');
  });

  test('a date, or none', () => {
    assert.match(String(cashMovementProblem({ ...draft, date: 'October' }, accounts)), /date/i);
  });

  test('both sides have to be chosen', () => {
    assert.match(String(cashMovementProblem({ ...draft, cashAccountId: '' }, accounts)), /which bank or cash account the money moves into/);
    assert.match(String(cashMovementProblem({ ...draft, direction: 'out', cashAccountId: '' }, accounts)), /out of/, 'money out is asked about in the other direction');
    assert.match(String(cashMovementProblem({ ...draft, counterAccountId: '' }, accounts)), /what the money is for/);
    assert.match(String(cashMovementProblem({ ...draft, direction: 'out', counterAccountId: '' }, accounts)), /what you paid for/);
  });

  test('two of your own accounts is a transfer, not money in', () => {
    assert.match(String(cashMovementProblem({ ...draft, counterAccountId: 'petty' }, accounts)),
      /Use Transfer Funds for money moving between them/);
  });

  test('money that settles a document goes on the document', () => {
    for (const id of ['ar', 'ap']) {
      assert.match(String(cashMovementProblem({ ...draft, counterAccountId: id }, accounts)),
        /keeps reading as owed/, `${id} is not what this dialog is for`);
    }
  });

  test('an account money does not sit in cannot be the side it lands in', () => {
    assert.match(String(cashMovementProblem({ ...draft, cashAccountId: 'rent' }, accounts)), /not an account money sits in/);
  });
});

describe('what the dialogs offer', () => {
  test('the money side: open accounts money sits in, by name', () => {
    assert.deepEqual(cashAccountOptions(accounts).map(a => a.value), ['checking', 'petty'], 'by name, and the closed one is not there');
  });

  test('the what-for side: no bank account, and not what holds what people owe', () => {
    const values = counterAccountChoices(accounts, transactions).map(a => a.value);
    assert.ok(!values.includes('checking') && !values.includes('petty'), 'money between your own accounts is a transfer');
    assert.ok(!values.includes('ar') && !values.includes('ap'), 'settling a document is done on the document');
    assert.ok(!values.includes('closed'), 'an account you closed is not offered');
    assert.deepEqual(values, ['rent', 'sales', 'deposits', 'equity-in'], 'the account used most comes first, then the picker’s own order (by code)');
    assert.ok(values.includes('equity-in') && values.includes('deposits'), 'an owner putting money in, and money held for a customer, are both recordable');
  });
});
