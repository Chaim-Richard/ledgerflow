/**
 * Expected bills (K-21): a vendor's rhythm is learned from their bills, and a bill that hasn't come
 * is shown with "Record bill" (the latest bill copied) and "Not expected".
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ExpectedBills from '../components/purchases/ExpectedBills';
import { cadenceLabel, expectedBills, scheduledBillVendors } from '../lib/expectedBills';
import type { Bill, RecurringTransaction, Vendor } from '../types';

const bill = (id: string, vendorId: string, date: string, amountCents: number, over: Partial<Bill> = {}): Bill =>
  ({ id, uid: 'u', workspaceId: 'w', vendorId, vendorName: vendorId, date, dueDate: date, amountCents, status: 'open', ...over } as Bill);
const vendors = [{ id: 'phone', name: 'Phone Co' }, { id: 'acct', name: 'Accountant' }, { id: 'odd', name: 'Odd jobs' }, { id: 'new', name: 'New vendor' }] as Vendor[];
const bills = [
  bill('p1', 'phone', '2026-06-03', 4500), bill('p2', 'phone', '2026-07-03', 4700), bill('p3', 'phone', '2026-08-04', 4500), bill('p4', 'phone', '2026-09-03', 5100),
  bill('a1', 'acct', '2026-01-15', 30000), bill('a2', 'acct', '2026-04-15', 30000), bill('a3', 'acct', '2026-07-15', 30000),
  bill('o1', 'odd', '2026-02-01', 100), bill('o2', 'odd', '2026-02-20', 100), bill('o3', 'odd', '2026-06-30', 100),
  bill('n1', 'new', '2026-08-01', 900), bill('n2', 'new', '2026-09-01', 900),
  bill('v1', 'phone', '2026-09-20', 999, { status: 'void' }),
];

describe('Which bills are expected', () => {
  test('a monthly vendor: next one usual gap after the last, usual amount and range; late after a few days', () => {
    const [phone] = expectedBills(bills, vendors, '2026-10-09');
    assert.deepEqual([phone.vendorName, phone.expectedDate, phone.cadenceDays, phone.typicalCents, phone.minCents, phone.maxCents, phone.daysLate, phone.late],
      ['Phone Co', '2026-10-03', 30, 4600, 4500, 5100, 6, true], 'gaps 30, 32, 30 → middle 30 days after 3 Sep; middle of 4500, 4500, 4700, 5100 → 4600');
    assert.equal(expectedBills(bills, vendors, '2026-10-08')[0].late, false, '5 days after: not late yet (grace 15% of 30 = 5 days)');
  });

  test('quarterly is learned too; irregular, too few, voided and far-off ones are not', () => {
    const july = expectedBills(bills, vendors, '2026-10-10').map(e => e.vendorId);
    assert.deepEqual(july, ['phone', 'acct'], 'accountant every 91 days → 14 Oct is within 10 days; odd jobs are irregular; the new vendor has two bills');
    assert.deepEqual(expectedBills(bills, vendors, '2026-09-10').map(e => e.vendorId), [], 'nothing due within 10 days on 10 Sep');
  });

  test('a vendor on a recurring schedule, or marked "not expected", is left out', () => {
    const scheduled = scheduledBillVendors([{ type: 'bill', isActive: true, billTemplate: { vendorId: 'phone' } }, { type: 'bill', isActive: false, billTemplate: { vendorId: 'acct' } }]);
    assert.deepEqual([...scheduled], ['phone']);
    assert.deepEqual(expectedBills(bills, vendors, '2026-10-10', { scheduledVendorIds: scheduled }).map(e => e.vendorId), ['acct']);
    assert.deepEqual(expectedBills(bills, [{ ...vendors[0], billsExpected: false }, vendors[1]], '2026-10-10').map(e => e.vendorId), ['acct']);
  });

  test('cadence in words', () => {
    assert.deepEqual([31, 91, 14, 7, 61, 20].map(cadenceLabel), ['every month', 'every 3 months', 'every 2 weeks', 'every week', 'every 2 months', 'every 20 days']);
  });
});

describe('The expected bills panel', () => {
  afterEach(() => cleanup());

  test('shows what is late and lets you record it or stop expecting it', () => {
    stubFetchWithBodies(200, {});
    const recorded: string[] = [];
    const dismissed: string[] = [];
    const late = bills.map(b => (b.vendorId === 'phone' ? { ...b, date: (b.date || '').replace('2026-', '2025-') } : b));
    render(<ExpectedBills bills={late} vendors={vendors} schedules={[] as RecurringTransaction[]} canEdit
      onRecord={e => recorded.push(e.lastBillId)} onDismiss={e => dismissed.push(e.vendorId)} />);
    assert.ok(screen.getByRole('heading', { name: 'Expected bills' }));
    assert.match(screen.getByText('Phone Co').parentElement?.textContent || '', /usually \$45\.00–\$51\.00, every month .* days late/);
    fireEvent.click(screen.getByRole('button', { name: 'Record the bill from Phone Co' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop expecting bills from Phone Co' }));
    assert.deepEqual([recorded, dismissed], [['p4'], ['phone']]);
  });

  test('nothing expected: no panel; a viewer gets no buttons', () => {
    const { container } = render(<ExpectedBills bills={[]} vendors={vendors} schedules={[]} canEdit onRecord={() => {}} onDismiss={() => {}} />);
    assert.equal(container.textContent, '');
    cleanup();
    const late = bills.map(b => ({ ...b, date: (b.date || '').replace('2026-', '2025-') }));
    render(<ExpectedBills bills={late} vendors={vendors} schedules={[]} canEdit={false} onRecord={() => {}} onDismiss={() => {}} />);
    assert.ok(screen.getByText('Phone Co'));
    assert.equal(screen.queryByRole('button'), null);
  });
});
