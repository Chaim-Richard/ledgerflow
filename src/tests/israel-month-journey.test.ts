/**
 * A-152 (P2-3): the Israeli month journey, with hand-worked figures.
 *
 * The month is September 2026. The business is a registered dealer (VAT 514000000, monthly
 * reports). Every amount below is in agorot (cents), and the arithmetic is written out by hand:
 *
 *   invoice 1001  2026-09-10  net 1,000,000  VAT 180,000 (18%)   total 1,180,000  business buyer
 *   invoice 1002  2026-09-15  net   100,000  VAT  18,000 (18%)   total   118,000  private buyer
 *   invoice 1003  2026-09-18  net   500,000  zero-rated export   total   500,000
 *   credit  7001  2026-09-25  net   -50,000  VAT  -9,000         total   -59,000
 *   bill    9001  2026-09-20  net   200,000  VAT  36,000 (18%)   total   236,000  other input
 *   bill    9002  2026-09-22  net   100,000  VAT  18,000 (18%)   total   118,000  fixed asset
 *
 *   taxable sales 1,000,000 + 100,000 - 50,000 = 1,050,000
 *   output VAT      180,000 +  18,000 -  9,000 =   189,000
 *   zero-rated sales                              500,000
 *   input VAT, other                               36,000
 *   input VAT, equipment                           18,000
 *   to pay                189,000 - 54,000 =       135,000
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ilAllocationCases, ilMonthlyDueDate, ilPcn874Preview, ilPcn874Rows, ilVatRegistrations,
  israelMonthJourney, israelMonthOf, israelMonthProblem,
} from '../lib/israelMonthJourney';
import type { TaxProfiles } from '../lib/tax/profile';

const profiles: TaxProfiles = {
  books: {
    name: 'Tel Aviv Ltd',
    registrations: [{ kind: 'vat', number: '514000000', place: { country: 'IL' }, filing: 'monthly' }],
  },
} as TaxProfiles;

const customers = [
  { id: 'c1', name: 'Buyer Ltd', metadata: { vatNumber: '512345678' } },
  { id: 'c2', name: 'Private customer' },
  { id: 'c3', name: 'Export Ltd', metadata: { vatNumber: '519999999' } },
];
const vendors = [{ id: 'v1', name: 'Supplier Ltd', metadata: { vatNumber: '513333333' } }];

const invoices = [
  { id: 'i1', number: '1001', date: '2026-09-10', status: 'sent', taxVersion: 2, amountCents: 1180000, taxAmountCents: 180000, customerId: 'c1' },
  { id: 'i2', number: '1002', date: '2026-09-15', status: 'sent', taxVersion: 2, amountCents: 118000, taxAmountCents: 18000, customerId: 'c2' },
  { id: 'i3', number: '1003', date: '2026-09-18', status: 'sent', taxVersion: 2, amountCents: 500000, taxAmountCents: 0, taxTreatment: 'zero_rated', customerId: 'c3' },
] as never;
const creditNotes = [
  { id: 'cn1', number: '7001', date: '2026-09-25', status: 'issued', taxVersion: 2, amountCents: 59000, taxAmountCents: 9000, customerId: 'c1' },
] as never;
const bills = [
  { id: 'b1', number: '9001', date: '2026-09-20', status: 'pending', taxVersion: 2, amountCents: 236000, taxAmountCents: 36000, vendorId: 'v1' },
  { id: 'b2', number: '9002', date: '2026-09-22', status: 'pending', taxVersion: 2, amountCents: 118000, taxAmountCents: 18000, vendorId: 'v1', fixedAsset: true },
] as never;

const base = {
  month: '2026-09', today: '2026-10-19', currency: 'ILS', profiles, order: ['world'],
  invoices, creditNotes, bills, customers, vendors,
};

test('A-152 the month is read exactly, and a month that is not one is refused', () => {
  assert.deepEqual(israelMonthOf('2026-09'), { month: '2026-09', startDate: '2026-09-01', endDate: '2026-09-30', year: 2026 });
  assert.equal(israelMonthOf('2024-02')?.endDate, '2024-02-29', 'a leap February');
  assert.equal(israelMonthOf('2026-9'), undefined);
  assert.equal(israelMonthOf('2026-13'), undefined);
  assert.equal(israelMonthProblem('2026-09', '2026-10-19'), null);
  assert.match(String(israelMonthProblem('September', '2026-10-19')), /2026-09/);
  assert.equal(ilMonthlyDueDate('2026-09'), '2026-10-15');
  assert.equal(ilMonthlyDueDate('2026-12'), '2027-01-15');
});

test('A-152 the registration in force on the last day is the one the report belongs to', () => {
  const found = ilVatRegistrations(profiles, '2026-09-30');
  assert.equal(found.length, 1);
  assert.equal(found[0].registration, 'vat:IL:514000000');
  assert.equal(found[0].filing, 'monthly');
  assert.deepEqual(ilVatRegistrations(null, '2026-09-30'), []);
});

test('A-152 the VAT report figures, worked by hand: 1,050,000 taxable, 189,000 output, 54,000 input, 135,000 to pay', () => {
  const journey = israelMonthJourney(base);
  const step = journey.steps.find(s => s.id === 'vat-report')!;
  const [vat] = step.returns;
  assert.equal(vat.taxableSalesCents, 1050000);
  assert.equal(vat.outputVatCents, 189000);
  assert.equal(vat.zeroRatedSalesCents, 500000);
  assert.equal(vat.exemptSalesCents, 0);
  assert.equal(vat.otherInputVatCents, 36000);
  assert.equal(vat.fixedAssetInputVatCents, 18000);
  assert.equal(vat.toPayCents, 135000);
  assert.equal(vat.documentCount, 6, 'three invoices, the credit note and two bills');
  assert.equal(vat.dueDate, '2026-10-15', 'a monthly registration is planned to the 15th of the next month');
  assert.equal(vat.filed, false);
  assert.equal(step.status, 'attention');
  assert.match(step.detail, /to pay ILS 1,350\.00/);
});

test('A-152 a return the server recorded for exactly this month is shown as filed', () => {
  const journey = israelMonthJourney({ ...base, filedPeriods: [{ startDate: '2026-09-01', endDate: '2026-09-30' }] });
  const vat = journey.steps.find(s => s.id === 'vat-report')!.returns[0];
  assert.equal(vat.filed, true);
  assert.equal(journey.steps.find(s => s.id === 'vat-report')!.status, 'done');
  // a return for a different period is not this month's
  const other = israelMonthJourney({ ...base, filedPeriods: [{ startDate: '2026-08-01', endDate: '2026-08-31' }] });
  assert.equal(other.steps.find(s => s.id === 'vat-report')!.returns[0].filed, false);
});

test('A-152 allocation numbers: a business buyer above the threshold needs one; a private buyer and a zero-rated sale do not', () => {
  const cases = ilAllocationCases({ invoices, customers, month: '2026-09', currency: 'ILS' });
  assert.equal(cases.length, 1, 'only invoice 1001: net 10,000 is above the 5,000 threshold from 2026-06-01');
  assert.equal(cases[0].invoiceId, 'i1');
  assert.equal(cases[0].thresholdCents, 500000);
  assert.match(String(cases[0].problem), /No allocation number/);

  const journey = israelMonthJourney(base);
  assert.equal(journey.steps.find(s => s.id === 'allocation')!.status, 'attention');
  assert.equal(journey.nextStep, 'allocation');

  const withNumber = israelMonthJourney({
    ...base,
    invoices: [{ ...(invoices as never as Array<Record<string, unknown>>)[0], metadata: { ilAllocationNumber: '123456789' } }, (invoices as never as Array<unknown>)[1], (invoices as never as Array<unknown>)[2]] as never,
  });
  assert.equal(withNumber.steps.find(s => s.id === 'allocation')!.status, 'done');
});

test('A-152 a recorded number that is not nine digits is reported, never accepted', () => {
  const withBad = [{ ...(invoices as never as Array<Record<string, unknown>>)[0], metadata: { ilAllocationNumber: '12345' } }, (invoices as never as Array<unknown>)[1], (invoices as never as Array<unknown>)[2]] as never;
  const journey = israelMonthJourney({ ...base, invoices: withBad });
  const step = journey.steps.find(s => s.id === 'allocation')!;
  assert.equal(step.status, 'attention');
  assert.match(String(step.allocation[0].problem), /9 digits/);
});

test('A-152 the PCN874 rows: whole shekels, credit note as a minus row, and documents that cannot be written named', () => {
  const mapping = ilPcn874Rows({ month: '2026-09', currency: 'ILS', invoices, creditNotes, bills, customers, vendors });
  assert.equal(mapping.rows.length, 5, '1001, 1003, 7001, 9001 and 9002');
  assert.equal(mapping.unmapped.length, 1);
  assert.equal(mapping.unmapped[0].documentId, 'i2', 'the private buyer has no VAT number to write');
  assert.match(mapping.unmapped[0].reason, /VAT\/dealer number/);
  assert.deepEqual(mapping.totals, {
    taxableSalesNis: 9500, outputVatNis: 1710, zeroRatedSalesNis: 5000, inputOtherNis: 360, inputEquipmentNis: 180,
  });
  const credit = mapping.rows.find(r => r.referenceNumber === '7001')!;
  assert.equal(credit.sign, '-');
  assert.equal(credit.category, 'taxable-sale');
  assert.equal(credit.baseNis, 500);
  assert.equal(credit.vatNis, 90);
  const equipment = mapping.rows.find(r => r.referenceNumber === '9002')!;
  assert.equal(equipment.entryType, 'R');
  assert.equal(equipment.category, 'input-equipment');
});

test('A-152 a foreign-currency document is not converted into the draft', () => {
  const inUsd = [{ ...(invoices as never as Array<Record<string, unknown>>)[0], currency: 'USD' }, (invoices as never as Array<unknown>)[1], (invoices as never as Array<unknown>)[2]] as never;
  const mapping = ilPcn874Rows({ month: '2026-09', currency: 'ILS', invoices: inUsd, customers, vendors });
  const row = mapping.unmapped.find(u => u.documentId === 'i1')!;
  assert.match(row.reason, /USD/);
});

test('A-152 a reverse-charge purchase and an invalid allocation number are refused, never written as ordinary rows', () => {
  const reverseCharge = [{ ...(bills as never as Array<Record<string, unknown>>)[0], taxTreatment: 'reverse_charge' }] as never;
  const purchases = ilPcn874Rows({ month: '2026-09', currency: 'ILS', bills: reverseCharge, vendors });
  assert.equal(purchases.rows.length, 0);
  assert.equal(purchases.notRepresented, 1);
  assert.match(purchases.unmapped[0].reason, /reverse_charge/);

  const badNumber = [{ ...(invoices as never as Array<Record<string, unknown>>)[0], metadata: { ilAllocationNumber: '12345' } }] as never;
  const sales = ilPcn874Rows({ month: '2026-09', currency: 'ILS', invoices: badNumber, customers });
  assert.equal(sales.rows.length, 0);
  assert.match(sales.unmapped[0].reason, /not 9 digits/);
});

test('A-152 the preview builds no draft until a 9-digit dealer number is given and every document maps', () => {
  const returns = israelMonthJourney(base).steps.find(s => s.id === 'vat-report')!.returns;
  const blocked = ilPcn874Preview({ month: '2026-09', generatedOn: '2026-10-19', currency: 'ILS', invoices, creditNotes, bills, customers, vendors, returns });
  assert.equal(blocked.draft, undefined);
  assert.match(String(blocked.problem), /9-digit dealer number/);
  assert.match(String(blocked.problem), /cannot be written/);
  // paid: the unmapped invoice and the dealer number are the two reasons
  const paid = ilPcn874Preview({
    month: '2026-09', generatedOn: '2026-10-19', currency: 'ILS', dealerId: '514000000',
    invoices: [{ ...(invoices as never as Array<Record<string, unknown>>)[0] }, { ...(invoices as never as Array<Record<string, unknown>>)[1], customerId: 'c1' }, (invoices as never as Array<unknown>)[2]] as never,
    creditNotes, bills, customers, vendors, returns,
  });
  assert.ok(paid.draft, 'every document maps and the dealer number is 9 digits');
  assert.equal(paid.draft!.header.length, 131);
  assert.equal(paid.draft!.transactions.length, 6);
  assert.equal(paid.draft!.closing.length, 10);
  assert.equal(paid.draft!.filingReady, false);
  assert.deepEqual(paid.comparison.map(row => row.differenceNis), [0, 0, 0, 0, 0], 'whole-shekel totals equal the report');
});

test('A-152 a difference between the draft and the report is shown, not smoothed away', () => {
  const returns = israelMonthJourney(base).steps.find(s => s.id === 'vat-report')!.returns;
  const preview = ilPcn874Preview({ month: '2026-09', generatedOn: '2026-10-19', currency: 'ILS', dealerId: '514000000', invoices, creditNotes, bills, customers, vendors, returns });
  assert.equal(preview.draft, undefined, 'invoice 1002 cannot be written');
  const taxable = preview.comparison.find(row => row.label === 'Taxable sales')!;
  assert.equal(taxable.draftNis, 9500);
  assert.equal(taxable.returnNis, 10500);
  assert.equal(taxable.differenceNis, -1000, 'the unrepresented invoice is named by the difference');
});

test('A-152 the close step needs both the recorded return and a closed month', () => {
  const filed = { ...base, filedPeriods: [{ startDate: '2026-09-01', endDate: '2026-09-30' }] };
  const open = israelMonthJourney({ ...filed, periods: [{ month: '2026-09', state: 'open' }] });
  assert.equal(open.steps.find(s => s.id === 'close')!.status, 'attention');
  const closed = israelMonthJourney({ ...filed, periods: [{ month: '2026-09', state: 'hard' }] });
  assert.equal(closed.steps.find(s => s.id === 'close')!.status, 'done');
  const unfiledClosed = israelMonthJourney({ ...base, periods: [{ month: '2026-09', state: 'hard' }] });
  assert.equal(unfiledClosed.steps.find(s => s.id === 'close')!.status, 'attention');
  assert.match(unfiledClosed.steps.find(s => s.id === 'close')!.detail, /Record the VAT report/);
});

test('A-152 no registration means no report and no draft: said plainly, not guessed', () => {
  const journey = israelMonthJourney({ ...base, profiles: null });
  assert.equal(journey.steps.find(s => s.id === 'registration')!.status, 'attention');
  assert.equal(journey.steps.find(s => s.id === 'vat-report')!.status, 'not-applicable');
  assert.equal(journey.steps.find(s => s.id === 'pcn874')!.status, 'not-applicable');
  assert.match(journey.steps.find(s => s.id === 'registration')!.detail, /No Israeli VAT registration/);
  assert.equal(israelMonthJourney({ ...base, profiles: null }).readyToClose, false);
});

test('A-152 a complete month: every step done, ready to close, and no problems', () => {
  const complete = israelMonthJourney({
    ...base,
    invoices: [
      { ...(invoices as never as Array<Record<string, unknown>>)[0], metadata: { ilAllocationNumber: '123456789' } },
      { ...(invoices as never as Array<Record<string, unknown>>)[1], customerId: 'c1' },
      (invoices as never as Array<unknown>)[2],
    ] as never,
    filedPeriods: [{ startDate: '2026-09-01', endDate: '2026-09-30' }],
    periods: [{ month: '2026-09', state: 'hard' }],
  });
  assert.deepEqual(complete.steps.map(s => s.status), ['done', 'done', 'done', 'done', 'done']);
  assert.equal(complete.readyToClose, true);
  assert.equal(complete.done, 5);
  assert.equal(complete.nextStep, undefined);
});

test('A-152 a month written wrongly is reported and does not pretend to be a month', () => {
  const journey = israelMonthJourney({ ...base, month: '09/2026' });
  assert.match(journey.problems.join(' '), /2026-09/);
  assert.equal(journey.readyToClose, false);
  assert.equal(journey.steps.find(s => s.id === 'close')!.status, 'not-applicable');
});
