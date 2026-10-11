/**
 * Open advances (CA-09): deposits and prepayments not yet applied, oldest first, with their age at
 * the period end, grouped by contact, totals per currency; voided ones and later ones are left out.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OpenAdvancesView from '../components/reporting/OpenAdvancesView';
import { ageBucket, openAdvances, type PaymentDirection } from '../lib/advancePayments';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';

type Row = { id: string; number: string; date: string; direction: PaymentDirection; contactId: string; contactName: string; amountCents: number; unappliedCents: number; currency: string; status: string };
const payments: Row[] = [
  { id: 'p1', number: 'PAY-1', date: '2026-06-01', direction: 'received', contactId: 'c1', contactName: 'Acme', amountCents: 50000, unappliedCents: 20000, currency: 'USD', status: 'posted' },
  { id: 'p2', number: 'PAY-2', date: '2026-09-20', direction: 'received', contactId: 'c1', contactName: 'Acme', amountCents: 10000, unappliedCents: 10000, currency: 'USD', status: 'posted' },
  { id: 'p3', number: 'PAY-3', date: '2026-09-25', direction: 'received', contactId: 'c2', contactName: 'Beta', amountCents: 7000, unappliedCents: 0, currency: 'USD', status: 'posted' },
  { id: 'p4', number: 'PAY-4', date: '2026-08-01', direction: 'received', contactId: 'c2', contactName: 'Beta', amountCents: 9000, unappliedCents: 9000, currency: 'USD', status: 'void' },
  { id: 'p5', number: 'PAY-5', date: '2026-10-15', direction: 'received', contactId: 'c2', contactName: 'Beta', amountCents: 3000, unappliedCents: 3000, currency: 'USD', status: 'posted' },
  { id: 'p6', number: 'PAY-6', date: '2026-09-01', direction: 'made', contactId: 'v1', contactName: 'Paper Co', amountCents: 4000, unappliedCents: 4000, currency: 'USD', status: 'posted' },
];

describe('The rules', () => {
  test('open, not voided, not after the date; oldest first; per contact and in total', () => {
    const { rows, byParty, totals } = openAdvances(payments, 'received', '2026-09-30');
    assert.deepEqual(rows.map(r => [r.number, r.appliedCents, r.openCents, r.ageDays, r.bucket]), [['PAY-1', 30000, 20000, 121, '90+'], ['PAY-2', 0, 10000, 10, '0-30']]);
    assert.deepEqual(byParty.map(p => [p.partyName, p.openCents, p.count, p.oldestDays]), [['Acme', 30000, 2, 121]]);
    assert.deepEqual(totals, { USD: 30000 });
    assert.deepEqual(openAdvances(payments, 'made', '2026-09-30').rows.map(r => r.number), ['PAY-6']);
    assert.deepEqual([0, 30, 31, 60, 61, 90, 91].map(ageBucket), ['0-30', '0-30', '31-60', '31-60', '61-90', '61-90', '90+']);
  });
});

describe('On screen', () => {
  afterEach(() => cleanup());

  test('customer deposits by default, vendor prepayments on request', () => {
    setComponentWorkspace('owner');
    markComponentCollectionsLoaded('payments');
    useLedgerStore.setState({ payments: payments as never });
    render(<OpenAdvancesView startDate="2026-09-01" endDate="2026-09-30" />);
    const table = screen.getByRole('table', { name: 'Open customer deposits as of 2026-09-30' });
    assert.match(table.textContent || '', /AcmePAY-12026-06-01\$500\.00\$300\.00\$200\.00121/);
    assert.match(table.textContent || '', /Total still open\$300\.00/);
    fireEvent.change(screen.getByLabelText('Which advances'), { target: { value: 'made' } });
    assert.match(screen.getByRole('table').textContent || '', /Paper CoPAY-6/);
  });
});


test('open-advance currency totals stay under their heading after moving and hiding columns', async () => {
  localStorage.clear();
  setComponentWorkspace('owner');
  markComponentCollectionsLoaded('payments');
  useLedgerStore.setState({ payments: payments as never });
  const view = render(<OpenAdvancesView startDate="2026-09-01" endDate="2026-09-30" />);
  await waitFor(() => assert.ok(view.getByRole('button', { name: 'Columns' })));
  fireEvent.click(view.getByRole('button', { name: 'Columns' }));
  fireEvent.click(view.getByRole('button', { name: 'Move Still open earlier' }));
  const headings = Array.from(view.container.querySelectorAll('thead th')).map(cell => cell.textContent);
  assert.equal(headings[4], 'Still open');
  const total = view.container.querySelector('tfoot tr')!;
  assert.equal(total.children.length, 7);
  assert.equal(total.children[4].textContent, '$300.00');
  fireEvent.click(view.getByRole('checkbox', { name: 'Applied' }));
  assert.equal(total.children[4].textContent, '$300.00', 'hiding applied amounts never changes open money');
  localStorage.clear();
});
