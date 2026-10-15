/**
 * A-62: blanket purchase orders. Hand-checked: only documents explicitly linked to the order draw
 * it down (a bill that merely has the same amount is never counted), a damaged receipt line is
 * not goods received, draft and other-currency bills are counted as skipped and never added in,
 * "used" is the higher of the two recorded totals so one delivery recorded both ways counts once,
 * and the states read from the last valid day and what is left.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  blanketAgreementProblem, blanketCsvRows, blanketOrderReview, blanketStateLabel,
} from '../lib/blanketOrders';

const orders = [
  {
    id: 'po1', poNumber: 'PO-1', vendorName: 'Acme Ltd', issueDate: '2026-01-05', status: 'approved',
    totalAmountCents: 1_000_000, currency: 'USD',
    blanket: { validUntil: '2026-11-14' },
    receipts: [
      { id: 'r1', items: [
        { poItemId: 'li1', description: 'Widgets', quantityReceived: 10, unitPriceCents: 5_000, condition: 'good' as const },
        { poItemId: 'li2', description: 'Damaged box', quantityReceived: 2, unitPriceCents: 3_000, condition: 'damaged' as const },
      ] },
      { id: 'r2', items: [
        { poItemId: 'li3', description: 'More widgets', quantityReceived: 4, unitPriceCents: 5_000, condition: 'good' as const },
      ] },
    ],
  },
  {
    id: 'po2', poNumber: 'PO-2', vendorName: 'Beta GmbH', issueDate: '2026-02-01', status: 'approved',
    totalAmountCents: 500_000, currency: 'USD',
    blanket: { validUntil: '2026-12-31', capCents: 300_000 },
    receipts: [],
  },
  { id: 'po3', poNumber: 'PO-3', vendorName: 'Plain', issueDate: '2026-03-01', status: 'approved', totalAmountCents: 100_000, currency: 'USD', receipts: [] },
  { id: 'po4', poNumber: 'PO-4', vendorName: 'Gone', issueDate: '2026-03-01', status: 'cancelled', totalAmountCents: 100_000, currency: 'USD', blanket: { validUntil: '2026-12-31' }, receipts: [] },
];

const bills = [
  // linked by the order number, recorded: counts
  { id: 'b1', vendorId: 'v1', amountCents: 70_000, currency: 'USD', status: 'approved', metadata: { poNumber: 'PO-1' } },
  // linked by the order id but a draft: skipped, never drawn
  { id: 'b2', vendorId: 'v1', amountCents: 90_000, currency: 'USD', status: 'draft', metadata: { poId: 'po1' } },
  // same amount as part of PO-1 but not linked: never counted
  { id: 'b3', vendorId: 'v1', amountCents: 50_000, currency: 'USD', status: 'approved', metadata: {} },
  // linked but in another currency: counted as skipped, never converted
  { id: 'b4', vendorId: 'v1', amountCents: 40_000, currency: 'EUR', status: 'approved', metadata: { poNumber: 'PO-1' } },
  // PO-2: over-draws its 300,000 cap
  { id: 'b5', vendorId: 'v2', amountCents: 350_000, currency: 'USD', status: 'paid', metadata: { poId: 'po2' } },
];

const review = () => blanketOrderReview({ orders: orders as never, bills: bills as never, today: '2026-10-15' });

describe('blanket orders: what draws an agreement down', () => {
  test('receipts count good lines only, bills count only when explicitly linked', () => {
    const row = review().rows.find(entry => entry.poId === 'po1')!;
    assert.equal(row.receivedCents, 70_000, '10 × 50.00 good + 4 × 50.00 good; the damaged box is not goods received');
    assert.equal(row.billedCents, 70_000, 'only the linked recorded USD bill; the draft, the unlinked and the EUR bill do not count');
    assert.equal(row.usedCents, 70_000, 'a delivery recorded both ways is one delivery: the higher of the two totals');
    assert.equal(row.leftCents, 930_000, 'the cap defaults to the order total (10,000.00)');
    assert.equal(row.bills, 1);
    assert.equal(row.billsOtherCurrency, 1, 'the EUR bill is listed beside the row');
  });

  test('the two columns never double-count: billed beyond receipts is what is used', () => {
    const rows = review().rows;
    const po2 = rows.find(entry => entry.poId === 'po2')!;
    assert.equal(po2.receivedCents, 0);
    assert.equal(po2.billedCents, 350_000);
    assert.equal(po2.usedCents, 350_000, 'used is the higher of received and billed');
    assert.equal(po2.capCents, 300_000, 'the agreed cap replaces the order total when given');
    assert.equal(po2.leftCents, -50_000);
    assert.equal(po2.state, 'over-drawn');
  });

  test('the states read the last valid day and what is left', () => {
    const po1 = review().rows.find(entry => entry.poId === 'po1')!;
    assert.equal(po1.state, 'expiring', '30 days or less to the last valid day');
    const winter = blanketOrderReview({ orders: [{ ...orders[0], blanket: { validUntil: '2027-12-31' } }] as never, bills: [] as never, today: '2026-10-15' });
    assert.equal(winter.rows[0].state, 'open');
    const done = blanketOrderReview({ orders: [{ ...orders[1], blanket: { validUntil: '2026-12-31', capCents: 350_000 } }] as never, bills: [bills[4]] as never, today: '2026-10-15' });
    assert.equal(done.rows[0].state, 'exhausted', 'left exactly zero');
    assert.equal(blanketStateLabel('expiring'), 'Expiring (30 days)');
    assert.equal(blanketStateLabel('over-drawn'), 'Over-drawn');
  });

  test('unmarked, cancelled and unusable agreements are counted, never guessed', () => {
    const result = review();
    assert.equal(result.rows.length, 2, 'only the two marked agreements');
    assert.equal(result.skipped.notBlanket, 1, 'PO-3 is offered for marking');
    assert.equal(result.skipped.cancelled, 1);
    assert.equal(result.skipped.draftsBills, 1);
    assert.equal(result.skipped.billsOtherCurrency, 1);
    const broken = blanketOrderReview({
      orders: [{ ...orders[0], blanket: { validUntil: 'whenever' } }] as never, bills: [] as never, today: '2026-10-15',
    });
    assert.equal(broken.rows.length, 0);
    assert.equal(broken.skipped.invalidAgreement, 1, 'a blank date is refused, never assumed');
  });

  test('totals are per currency and the CSV keeps the two draw-down columns', () => {
    const result = review();
    assert.equal(result.totals.length, 1);
    assert.equal(result.totals[0].currency, 'USD');
    assert.equal(result.totals[0].capCents, 1_300_000);
    assert.equal(result.totals[0].usedCents, 420_000);
    const rows = blanketCsvRows(result);
    assert.equal(rows.length, 2);
    assert.equal(rows[0][0], 'PO-1');
    assert.equal(rows[0][8], '700.00', 'used');
    assert.equal(rows[0][9], '9300.00', 'left');
  });
});

describe('blanket orders: what makes an agreement', () => {
  test('a last valid day, on or after the order’s issue date', () => {
    assert.equal(blanketAgreementProblem({ validUntil: '2026-12-31', issueDate: '2026-01-05' }), null);
    assert.match(blanketAgreementProblem({ validUntil: '' }) || '', /last valid day/);
    assert.match(blanketAgreementProblem({ validUntil: '2025-12-31', issueDate: '2026-01-05' }) || '', /cannot be before/);
    assert.match(blanketAgreementProblem({ validUntil: '2026-12-31', capCents: -1 }) || '', /0 or more/);
    assert.equal(blanketAgreementProblem({ validUntil: '2026-12-31', capCents: 0 }), null, 'a zero cap is a real (fully used) agreement');
  });
});
