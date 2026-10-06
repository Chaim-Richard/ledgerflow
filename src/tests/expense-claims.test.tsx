/**
 * Expense claims (K-22): a claim is a draft bill owed to the person who paid, so nothing is in the
 * books until an owner or accountant approves it (then it posts and is paid like any bill); nobody
 * approves their own claim except the owner; a rejected claim stays out of the books with its reason.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ExpenseClaims, { type NewClaim } from '../components/purchases/ExpenseClaims';
import { claimBill, claimDecision, claimOf, claimProblem, decisionProblem, mileageCents, mileageLine, perDiemCents, perDiemLine, rateInThousandths, workedLineProblem } from '../lib/expenseClaims';
import { makeChartAccount } from './fixtures';
import type { Bill, Vendor } from '../types';

const accounts = [
  makeChartAccount({ id: 'travel', name: 'Travel', type: 'expense', category: 'Operating Expenses' }),
  makeChartAccount({ id: 'meals', name: 'Meals', type: 'expense', category: 'Operating Expenses' }),
  makeChartAccount({ id: 'bank', name: 'Checking', type: 'asset', category: 'Cash' }),
];
const submitted = (by: string) => ({ ...claimBill({ payee: { id: 'dana', name: 'Dana' }, date: '2026-10-03', lines: [{ description: 'Taxi', accountId: 'travel', amountCents: 2350 }, { description: 'Lunch', accountId: 'meals', amountCents: 1800 }], submittedBy: by, submittedByName: 'Dana', now: '2026-10-04T10:00:00Z', currency: 'USD' }), id: `claim-${by}`, uid: by, workspaceId: 'w' }) as unknown as Bill;

describe('The claim rules', () => {
  test('saved as a draft bill to the person who paid, one line per expense', () => {
    const bill = submitted('u-dana');
    assert.deepEqual([bill.status, bill.vendorId, bill.amountCents, bill.dueDate], ['draft', 'dana', 4150, '2026-10-03']);
    assert.deepEqual(bill.splits?.map(s => [s.accountId, s.amountCents, s.description]), [['travel', 2350, 'Taxi'], ['meals', 1800, 'Lunch']]);
    assert.deepEqual([claimOf(bill)?.state, claimOf(bill)?.submittedBy], ['submitted', 'u-dana']);
  });

  test('who may decide', () => {
    const claim = claimOf(submitted('u-dana'));
    assert.equal(decisionProblem(claim, 'accountant', 'u-acc'), null);
    assert.equal(decisionProblem(claim, 'owner', 'u-dana'), null, 'the owner of a business of one');
    assert.equal(decisionProblem(claim, 'accountant', 'u-dana'), 'Someone else must approve your own claim');
    assert.equal(decisionProblem(claim, 'bookkeeper', 'u-book'), 'Only owners and accountants approve expense claims');
    assert.equal(decisionProblem({ ...claim!, state: 'approved' }, 'owner', 'u-o'), 'Already approved');
    assert.equal(decisionProblem(undefined, 'owner', 'u-o'), 'Not an expense claim');
  });

  test('approving posts it (approved), rejecting keeps it out of the books with the reason', () => {
    const bill = submitted('u-dana');
    const yes = claimDecision(bill, true, 'u-acc', '2026-10-05T09:00:00Z');
    assert.deepEqual([yes.status, yes.metadata.expenseClaim.state, yes.metadata.expenseClaim.decidedBy], ['approved', 'approved', 'u-acc']);
    const no = claimDecision(bill, false, 'u-acc', '2026-10-05T09:00:00Z', 'No receipt');
    assert.deepEqual([no.status, no.metadata.expenseClaim.state, no.metadata.expenseClaim.reason], ['rejected', 'rejected', 'No receipt']);
    assert.equal((no.metadata as Record<string, unknown>).memo, bill.metadata?.memo, 'the rest of the bill is kept');
  });

  test('what a claim needs', () => {
    const line = { description: 'Taxi', accountId: 'travel', amountCents: 100 };
    assert.equal(claimProblem({ payeeName: '', date: '2026-10-01', lines: [line] }), 'Who paid? Type their name');
    assert.equal(claimProblem({ payeeName: 'Dana', date: '2026-10-01', lines: [] }), 'Add what was paid for');
    assert.equal(claimProblem({ payeeName: 'Dana', date: '2026-10-01', lines: [{ ...line, amountCents: 0 }] }), 'Every line needs an amount');
    assert.equal(claimProblem({ payeeName: 'Dana', date: '2026-10-01', lines: [{ ...line, accountId: '' }] }), 'Every line needs a category');
    assert.equal(claimProblem({ payeeName: 'Dana', date: '2026-10-01', lines: [line] }), null);
  });
});

describe('The claims panel', () => {
  afterEach(() => cleanup());
  const vendors = [{ id: 'dana', name: 'Dana', type: 'employee' }] as Vendor[];

  test('an accountant approves or rejects (with a reason) a waiting claim', async () => {
    const decided: Array<[string, boolean, string | undefined]> = [];
    render(<ExpenseClaims bills={[submitted('u-dana')]} vendors={vendors} accounts={accounts} userRole="accountant" uid="u-acc" currency="USD"
      onSubmit={() => {}} onDecide={(b, approve, reason) => { decided.push([b.id, approve, reason]); }} />);
    assert.match(document.body.textContent || '', /1 waiting/);
    assert.match(document.body.textContent || '', /Dana · 2026-10-03 · Taxi, Lunch/);
    fireEvent.click(screen.getByRole('button', { name: 'Approve the claim of Dana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject the claim of Dana' }));
    fireEvent.change(screen.getByLabelText('Why is it rejected?'), { target: { value: 'No receipt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    assert.deepEqual(decided, [['claim-u-dana', true, undefined], ['claim-u-dana', false, 'No receipt']]);
  });

  test('the submitter sees why they can’t approve it; a bookkeeper sees it waiting', () => {
    const { unmount } = render(<ExpenseClaims bills={[submitted('u-acc')]} vendors={vendors} accounts={accounts} userRole="accountant" uid="u-acc" currency="USD" onSubmit={() => {}} onDecide={() => {}} />);
    assert.match(document.body.textContent || '', /Someone else must approve your own claim/);
    assert.equal(screen.queryByRole('button', { name: /Approve/ }), null);
    unmount();
    render(<ExpenseClaims bills={[submitted('u-dana')]} vendors={vendors} accounts={accounts} userRole="bookkeeper" uid="u-book" currency="USD" onSubmit={() => {}} onDecide={() => {}} />);
    assert.match(document.body.textContent || '', /Waiting for approval/);
  });

  test('a new claim: two lines, the total, and it is submitted once', async () => {
    const claims: NewClaim[] = [];
    render(<ExpenseClaims bills={[]} vendors={vendors} accounts={accounts} userRole="bookkeeper" uid="u-book" currency="USD" onSubmit={c => { claims.push(c); }} onDecide={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'New expense claim' }));
    assert.equal(screen.getByRole('alert').textContent, 'Who paid? Type their name');
    fireEvent.change(screen.getByLabelText('Who paid'), { target: { value: 'Dana' } });
    fireEvent.change(screen.getByLabelText('What, line 1'), { target: { value: 'Taxi' } });
    fireEvent.change(screen.getByLabelText('Category, line 1'), { target: { value: 'travel' } });
    fireEvent.change(screen.getByLabelText('Amount, line 1'), { target: { value: '23.50' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add a line' }));
    assert.equal((screen.getByLabelText('Category, line 2') as HTMLSelectElement).value, 'travel', 'the next line starts in the same category');
    fireEvent.change(screen.getByLabelText('What, line 2'), { target: { value: 'Train' } });
    fireEvent.change(screen.getByLabelText('Amount, line 2'), { target: { value: '12' } });
    assert.match(document.body.textContent || '', /Total \$35\.50/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' })); });
    assert.equal(claims.length, 1);
    assert.deepEqual([claims[0].payeeName, claims[0].lines], ['Dana', [{ description: 'Taxi', accountId: 'travel', amountCents: 2350 }, { description: 'Train', accountId: 'travel', amountCents: 1200 }]]);
  });

  test('a viewer with nothing waiting sees no panel', () => {
    const { container } = render(<ExpenseClaims bills={[]} vendors={vendors} accounts={accounts} userRole="viewer" uid="u-v" currency="USD" onSubmit={() => {}} onDecide={() => {}} />);
    assert.equal(container.innerHTML, '');
  });
});

describe('Mileage and per diem (BE-09, BE-10)', () => {
  afterEach(() => { cleanup(); localStorage.clear(); });
  const vendors = [] as Vendor[];

  test('worked out in whole cents, the rate in tenths of a cent allowed, and the line says how', () => {
    assert.equal(rateInThousandths('0.655'), 655);
    assert.equal(mileageCents(42, rateInThousandths('0.655')), 2751, '42 mi × $0.655 = $27.51');
    assert.equal(mileageCents(12.5, rateInThousandths('0.68')), 850);
    assert.equal(perDiemCents(2.5, 5900), 14750);
    assert.deepEqual(mileageLine({ purpose: 'Client visit', from: 'Office', to: 'Acme', distance: 42, unit: 'mi', rateThousandths: 655, accountId: 'travel', currency: 'USD' }),
      { description: 'Mileage Office → Acme (42 mi × USD 0.655/mi): Client visit', accountId: 'travel', amountCents: 2751 });
    assert.deepEqual(perDiemLine({ purpose: 'Trade fair', days: 3, dailyRateCents: 5900, accountId: 'meals', currency: 'EUR' }),
      { description: 'Per diem (3 days × EUR 59.00): Trade fair', accountId: 'meals', amountCents: 17700 });
    assert.equal(workedLineProblem('mileage', { distance: 10 }), 'Mileage needs the rate per km or mile');
    assert.equal(workedLineProblem('perDiem', { dailyRateCents: 100 }), 'Per diem needs the number of days');
    assert.equal(workedLineProblem('expense', {}), null);
  });

  test('on the form: the amount is worked out, the claim gets ordinary lines, and the rates are remembered for next time', async () => {
    const claims: NewClaim[] = [];
    const view = render(<ExpenseClaims bills={[]} vendors={vendors} accounts={accounts} userRole="bookkeeper" uid="u-book" currency="USD" onSubmit={c => { claims.push(c); }} onDecide={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'New expense claim' }));
    fireEvent.change(screen.getByLabelText('Who paid'), { target: { value: 'Dana' } });
    fireEvent.change(screen.getByLabelText('Kind, line 1'), { target: { value: 'mileage' } });
    fireEvent.change(screen.getByLabelText('What, line 1'), { target: { value: 'Client visit' } });
    fireEvent.change(screen.getByLabelText('Category, line 1'), { target: { value: 'travel' } });
    fireEvent.change(screen.getByLabelText('Distance, line 1'), { target: { value: '42' } });
    assert.equal(screen.getByRole('alert').textContent, 'Mileage needs the rate per km or mile');
    fireEvent.change(screen.getByLabelText('Unit, line 1'), { target: { value: 'mi' } });
    fireEvent.change(screen.getByLabelText('Rate per mile, line 1'), { target: { value: '0.655' } });
    assert.equal(screen.getByLabelText('Amount, line 1').textContent, '$27.51');
    fireEvent.click(screen.getByRole('button', { name: '+ Add a line' }));
    fireEvent.change(screen.getByLabelText('Kind, line 2'), { target: { value: 'perDiem' } });
    fireEvent.change(screen.getByLabelText('Category, line 2'), { target: { value: 'meals' } });
    fireEvent.change(screen.getByLabelText('Days, line 2'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Daily rate, line 2'), { target: { value: '59' } });
    assert.match(document.body.textContent || '', /Total \$145\.51/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' })); });
    assert.deepEqual(claims[0].lines.map(l => [l.description, l.accountId, l.amountCents]), [
      ['Mileage (42 mi × USD 0.655/mi): Client visit', 'travel', 2751],
      ['Per diem (2 days × USD 59.00)', 'meals', 11800],
    ]);
    view.unmount();
    render(<ExpenseClaims bills={[]} vendors={vendors} accounts={accounts} userRole="bookkeeper" uid="u-book" currency="USD" onSubmit={() => {}} onDecide={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'New expense claim' }));
    fireEvent.change(screen.getByLabelText('Kind, line 1'), { target: { value: 'mileage' } });
    assert.equal((screen.getByLabelText('Rate per mile, line 1') as HTMLInputElement).value, '0.655', 'the last rate and unit come back');
  });
});
