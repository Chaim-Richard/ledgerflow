/**
 * Israel's VAT report (PLAN IL-3), checked by hand. Registration 514000000 (the books); a US entity
 * label with no Israeli VAT number is left out. Period Sep–Oct 2026, 18%.
 *  sales:   11,800 incl. 1,800 VAT (taxable 10,000) · 5,000 zero-rated (export) · 1,180 credit note (−1,000 net, −180 VAT)
 *  bills:   2,360 incl. 360 VAT (other) · 11,800 incl. 1,800 VAT on a machine (fixed asset)
 *  → output 1,620 · inputs 360 + 1,800 · to pay 1,620 − 2,160 = −540 (a refund)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { israelVatReturn, type IlVatDocument } from '../lib/tax/ilVatReturn';
import type { TaxProfiles } from '../lib/tax/profile';

const profiles: TaxProfiles = {
  books: { place: { country: 'IL' }, registrations: [{ kind: 'vat', number: '514000000', place: { country: 'IL' }, filing: 'bimonthly' }] },
  labels: { 'world:us': { place: { country: 'US', state: 'TX' }, registrations: [{ kind: 'sales_tax', number: '1', place: { country: 'US', state: 'TX' } }] } },
};
const doc = (id: string, date: string, amountCents: number, taxAmountCents: number, extra: Partial<IlVatDocument> = {}): IlVatDocument =>
  ({ id, date, status: 'sent', taxVersion: 2, amountCents, taxAmountCents, taxTreatment: taxAmountCents ? 'standard' : 'zero_rated', ...extra }) as IlVatDocument;

test('the period\'s VAT report for the Israeli registration', () => {
  const r = israelVatReturn({
    registration: 'vat:IL:514000000', profiles, order: ['world'], startDate: '2026-09-01', endDate: '2026-10-31',
    invoices: [
      doc('i1', '2026-09-10', 1180000, 180000),
      doc('i2', '2026-10-02', 500000, 0),
      doc('i3', '2026-10-05', 1180000, 180000, { dimensions: { world: 'us' } }), // the US entity: not this registration
      doc('i4', '2026-08-31', 1180000, 180000), // before the period
    ],
    creditNotes: [doc('c1', '2026-10-20', 118000, 18000, { status: 'applied' })],
    bills: [
      doc('b1', '2026-09-15', 236000, 36000, { status: 'unpaid' }),
      doc('b2', '2026-10-01', 1180000, 180000, { status: 'unpaid', fixedAsset: true }),
    ],
  });
  assert.deepEqual(
    [r.taxableSalesCents, r.outputVatCents, r.zeroRatedSalesCents, r.exemptSalesCents, r.otherInputVatCents, r.fixedAssetInputVatCents, r.toPayCents, r.documentCount],
    [900000, 162000, 500000, 0, 36000, 180000, -54000, 5],
  );
});
