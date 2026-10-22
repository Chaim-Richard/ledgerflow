/**
 * ISS-160 (GitHub #160): saved bills on fixed-asset accounts are reported as equipment (ציוד) on Israel's VAT report,
 * through the month journey the Israel screen shows (israelMonthJourney → israelVatReturn), from what is saved —
 * no flag on the bills. September 2026, monthly dealer 514000000, agorot:
 *   sales as in the A-152 journey test: output VAT 180,000 + 18,000 − 9,000 = 189,000
 *   bill 9001  09-20  Office supplies 200,000 + VAT 36,000           → other input        36,000
 *   bill 9002  09-22  Machinery 100,000 + VAT 18,000                 → equipment          18,000
 *   bill 9003  09-24  Machinery 30,000 + Office supplies 20,000, VAT 9,000
 *                     → mixed: other input, and named so it can be split                  9,000
 *   bill 9004  09-26  Inventory 40,000 + VAT 7,200 (stock is not equipment) → other input  7,200
 *   credit V-1 09-28  on bill 9002: 10,000 + VAT 1,800               → equipment         −1,800
 *   credit V-2 09-29  on bill 9001:  5,000 + VAT 900                 → other input         −900
 *   equipment input VAT 18,000 − 1,800 = 16,200; other 36,000 + 9,000 + 7,200 − 900 = 51,300; inputs 67,500
 *   to pay 189,000 − 67,500 = 121,500 (the same with or without the split: only the line moves)
 */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { formatCurrency } from '../lib/utils';
import { ilPcn874Preview } from '../lib/israelMonthJourney';
import { IsraelMonthJourneyPanel } from '../components/reporting/IsraelMonthJourneyReportView';
import { israelMonthJourney } from '../lib/israelMonthJourney';
import { billEquipmentKind, withEquipment } from '../lib/tax/ilVatEquipment';
import { makeChartAccount } from './fixtures';
import type { TaxProfiles } from '../lib/tax/profile';

const profiles = { books: { name: 'Tel Aviv Ltd', registrations: [{ kind: 'vat', number: '514000000', place: { country: 'IL' }, filing: 'monthly' }] } } as TaxProfiles;
const accounts = [
  makeChartAccount({ id: 'machinery', code: '1500', name: 'Machinery & Equipment', type: 'asset', category: 'Fixed Assets' }),
  makeChartAccount({ id: 'stock', code: '1300', name: 'Inventory', type: 'asset', category: 'Inventory' }),
  makeChartAccount({ id: 'supplies', code: '6000', name: 'Office supplies', type: 'expense', category: 'Operating' }),
];
const customers = [{ id: 'c1', name: 'Buyer Ltd', metadata: { vatNumber: '512345678' } }, { id: 'c2', name: 'Private customer' }, { id: 'c3', name: 'Export Ltd', metadata: { vatNumber: '519999999' } }];
const vendors = [{ id: 'v1', name: 'Supplier Ltd', metadata: { vatNumber: '513333333' } }];
const invoices = [
  { id: 'i1', number: '1001', date: '2026-09-10', status: 'sent', taxVersion: 2, amountCents: 1_180_000, taxAmountCents: 180_000, customerId: 'c1' },
  { id: 'i2', number: '1002', date: '2026-09-15', status: 'sent', taxVersion: 2, amountCents: 118_000, taxAmountCents: 18_000, customerId: 'c2' },
  { id: 'i3', number: '1003', date: '2026-09-18', status: 'sent', taxVersion: 2, amountCents: 500_000, taxAmountCents: 0, taxTreatment: 'zero_rated', customerId: 'c3' },
] as never;
const creditNotes = [{ id: 'cn1', number: '7001', date: '2026-09-25', status: 'issued', taxVersion: 2, amountCents: 59_000, taxAmountCents: 9_000, customerId: 'c1' }] as never;
const bill = (id: string, number: string, date: string, vatCents: number, splits: Array<[string, number]>) => ({
  id, number, date, status: 'pending', taxVersion: 2, vendorId: 'v1', taxAmountCents: vatCents,
  amountCents: splits.reduce((s, [, c]) => s + c, 0) + vatCents, splits: splits.map(([accountId, amountCents]) => ({ accountId, amountCents })),
});
const bills = [
  bill('b1', '9001', '2026-09-20', 36_000, [['supplies', 200_000]]),
  bill('b2', '9002', '2026-09-22', 18_000, [['machinery', 100_000]]),
  bill('b3', '9003', '2026-09-24', 9_000, [['machinery', 30_000], ['supplies', 20_000]]),
  bill('b4', '9004', '2026-09-26', 7_200, [['stock', 40_000]]),
];
const vendorCredits = [
  { id: 'vc1', number: 'V-1', date: '2026-09-28', status: 'open', taxVersion: 2, vendorId: 'v1', billId: 'b2', amountCents: 11_800, taxAmountCents: 1_800 },
  { id: 'vc2', number: 'V-2', date: '2026-09-29', status: 'open', taxVersion: 2, vendorId: 'v1', billId: 'b1', amountCents: 5_900, taxAmountCents: 900 },
];
const journey = (withAccounts: boolean) => israelMonthJourney({
  month: '2026-09', today: '2026-10-19', currency: 'ILS', profiles, order: ['world'],
  invoices, creditNotes, bills: bills as never, vendorCredits: vendorCredits as never, customers, vendors, ...(withAccounts ? { accounts } : {}),
});
const vatReturn = (j: ReturnType<typeof journey>) => j.steps.find(s => s.id === 'vat-report')!.returns[0];

test('each saved bill\'s kind comes from its lines\' accounts; a mark already on it is kept', () => {
  assert.deepEqual(bills.map(b => billEquipmentKind(b, accounts)), ['other', 'equipment', 'mixed', 'other']);
  assert.equal(billEquipmentKind({ ...bills[1], fixedAsset: false }, accounts), 'other', 'marked by hand');
  assert.equal(billEquipmentKind({ ...bills[0], metadata: { fixedAsset: true } }, accounts), 'equipment');
  const marked = withEquipment(bills, vendorCredits, accounts);
  assert.deepEqual(marked.vendorCredits.map(c => c.fixedAsset), [true, false], 'a credit follows the bill it credits');
  assert.deepEqual(marked.mixed.map(b => b.number), ['9003']);
});

test('the September report: equipment 16,200, other inputs 51,300, to pay 121,500; the mixed bill is named', () => {
  const j = journey(true);
  const r = vatReturn(j);
  assert.deepEqual([r.outputVatCents, r.fixedAssetInputVatCents, r.otherInputVatCents, r.toPayCents], [189_000, 16_200, 51_300, 121_500]);
  assert.ok(j.problems.some(p => /^Bill 9003 \(2026-09-24\) has both equipment and other purchases: its input VAT is reported as other input VAT/.test(p)), j.problems.join(' | '));
});

test('without the chart (as before), nothing is equipment — the gap #160 named; what is owed does not change', () => {
  const r = vatReturn(journey(false));
  assert.deepEqual([r.fixedAssetInputVatCents, r.otherInputVatCents, r.toPayCents], [0, 67_500, 121_500]);
});

afterEach(() => cleanup());

test('the Israel month screen says it: input VAT 675.00 (equipment 162.00), and names bill 9003', () => {
  const j = journey(true);
  const preview = ilPcn874Preview({ month: '2026-09', generatedOn: '2026-10-19', currency: 'ILS', dealerId: '514000000', invoices, bills: bills as never, customers, vendors, returns: j.steps.find(s => s.id === 'vat-report')!.returns });
  render(<IsraelMonthJourneyPanel journey={j} preview={preview} currency="ILS" monthText="2026-09" onMonthChange={() => {}} dealerId="514000000" onDealerIdChange={() => {}} />);
  const text = document.body.textContent || '';
  assert.ok(text.includes('input VAT ILS 675.00 (equipment ILS 162.00), to pay ILS 1,215.00'), text.slice(Math.max(0, text.indexOf('Periodic VAT report')), text.indexOf('Periodic VAT report') + 600));
  assert.ok(text.includes(formatCurrency(16_200, 'ILS')), 'the equipment column');
  assert.ok(screen.getAllByText(/Bill 9003 \(2026-09-24\) has both equipment and other purchases/).length >= 1);
});
