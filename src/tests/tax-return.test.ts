/**
 * Tax returns (T-06 T-07): the server computes the return from saved documents in the home
 * currency, files a copy once per period (owners and accountants), and later changes show as
 * box differences. Database part needs LF_TEST_DATABASE_URL.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { buildTaxReturn, returnChanges, taxByRate } from '../lib/taxReturnDocs';
import type { TaxableDocument } from '../lib/taxReturnDocs';
import type { Firestore } from '../server/db/pgFirestore';

describe('Changes since a return was filed', () => {
  test('only the boxes that moved are listed', () => {
    const filed = { boxes: [{ key: '1', label: 'Tax on sales', cents: 2000 }, { key: '5', label: 'Net', cents: 1500 }] };
    const now = { boxes: [{ key: '1', label: 'Tax on sales', cents: 2400 }, { key: '5', label: 'Net', cents: 1500 }] };
    assert.deepEqual(returnChanges(filed, now), [{ key: '1', label: 'Tax on sales', filedCents: 2000, nowCents: 2400 }]);
  });
});

describe('Sales Tax Liability Summary: tax by rate (J-11)', () => {
  // version-2 documents: amountCents is the total with tax, taxAmountCents the tax
  const doc = (id: string, netCents: number, taxCents: number, extra: Partial<TaxableDocument> & { currency?: string } = {}): TaxableDocument =>
    ({ id, date: '2026-07-10', status: 'sent', amountCents: netCents + taxCents, taxAmountCents: taxCents, taxInclusive: true, taxVersion: 2, ...extra });
  const gst = (taxCents: number) => ({ name: 'GST', rate: 5, taxCents });
  const input = {
    invoices: [
      doc('a', 10000, 1200, { taxBreakdown: [gst(500), { name: 'PST', rate: 7, taxCents: 700 }] }),
      doc('b', 20000, 1000, { taxBreakdown: [gst(1000)], currency: 'EUR', exchangeRate: 1.1 }),
      doc('no-parts', 5000, 400),
      doc('draft', 9000, 900, { status: 'draft', taxBreakdown: [gst(900)] }),
      doc('june', 9000, 900, { date: '2026-06-30', taxBreakdown: [gst(900)] }),
    ],
    creditNotes: [doc('cn', 1000, 50, { status: 'applied', taxBreakdown: [gst(50)] })],
    bills: [doc('bill', 4000, 200, { status: 'approved', taxBreakdown: [gst(200)] })],
    vendorCredits: [],
    startDate: '2026-07-01', endDate: '2026-07-31',
  };

  test('each tax collected and paid in the home currency; credits reduce it; drafts and other months left out', () => {
    assert.deepEqual(taxByRate(input), [
      // 100.00 + €200 at 1.1 − 10.00 credit; 5.00 + €10 at 1.1 − 0.50; bill 40.00 with 2.00
      { name: 'GST', rate: 5, salesNetCents: 31000, salesTaxCents: 1550, purchasesNetCents: 4000, purchasesTaxCents: 200, netTaxCents: 1350 },
      { name: 'PST', rate: 7, salesNetCents: 10000, salesTaxCents: 700, purchasesNetCents: 0, purchasesTaxCents: 0, netTaxCents: 700 },
      { name: 'Tax', rate: 8, salesNetCents: 5000, salesTaxCents: 400, purchasesNetCents: 0, purchasesTaxCents: 0, netTaxCents: 400 },
    ]);
  });

  test('the rows add up to the return\'s boxes, even when saved parts are a cent off', () => {
    const odd = { ...input, invoices: [...input.invoices, doc('odd', 9000, 1001, { taxBreakdown: [gst(333), { name: 'PST', rate: 7, taxCents: 333 }, { name: 'HST', rate: 1, taxCents: 334 }] })] };
    const rows = taxByRate(odd);
    const ret = buildTaxReturn(odd);
    assert.equal(rows.reduce((s, r) => s + r.salesTaxCents, 0), ret.boxes.find(b => b.key === '1')!.cents);
    assert.equal(rows.reduce((s, r) => s + r.purchasesTaxCents, 0), ret.boxes.find(b => b.key === '4')!.cents);
  });
});

test('the tax liability endpoint adds foreign documents in the home currency', async () => {
  const { computeTaxLiability } = await import('../server/reports/computeReports');
  const eur = { id: 'e', date: '2026-07-10', status: 'sent', amountCents: 12000, taxAmountCents: 2000, taxInclusive: true, taxVersion: 2, currency: 'EUR', exchangeRate: 1.1 };
  const report = computeTaxLiability([eur] as never, [], '2026-07-01', '2026-07-31');
  assert.equal(report.taxCollectedCents, 2200); // €20 at 1.1, not 2000
  assert.equal(report.taxableSalesCents, 11000);
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Filing a tax return', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_taxret_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let db: Firestore;
  let svc: typeof import('../server/services/taxReturnService');

  before(async () => {
    process.env.DATABASE_URL = url;
    svc = await import('../server/services/taxReturnService');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'o', name: 'Tax Co', currency: 'USD', members: ['o', 'v'], roles: { v: 'viewer' } });
    const doc = (table: string, name: string, fields: Record<string, unknown>) => db.collection(table).doc(id(name)).set({ workspaceId: ws, date: '2026-07-10', status: 'sent', ...fields });
    // EUR 100.00 + 20% at 1.10: USD 110.00 net, 22.00 tax
    await doc('invoices', 'eur', { amountCents: 12000, taxAmountCents: 2000, taxInclusive: true, taxVersion: 2, taxTreatment: 'standard', currency: 'EUR', exchangeRate: 1.1 });
    await doc('invoices', 'zero', { amountCents: 5000, taxInclusive: true, taxVersion: 2, taxTreatment: 'zero_rated' });
    await doc('invoices', 'draft', { amountCents: 99900, taxAmountCents: 9990, taxVersion: 2, taxTreatment: 'standard', status: 'draft' });
    await doc('bills', 'rc', { amountCents: 2000, taxInclusive: true, taxVersion: 2, taxTreatment: 'reverse_charge', selfAssessedTaxCents: 400, status: 'approved', vendorId: 'v1', dueDate: '2026-08-01' });
  });

  after(async () => {
    for (const table of ['invoices', 'bills', 'taxReturns', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('the return is in the home currency; drafts are left out; reverse charge is due and reclaimable', async () => {
    const r = await svc.computeWorkspaceTaxReturn(db, ws, '2026-07-01', '2026-09-30');
    const box = (key: string) => r.boxes.find(b => b.key === key)?.cents;
    assert.deepEqual([box('1'), box('2'), box('3'), box('4'), box('5')], [2200, 400, 2600, 400, 2200]);
    assert.deepEqual([box('6'), box('8'), box('7')], [16000, 5000, 2000]);
  });

  test('viewers cannot file; owners file once per period; the copy keeps its numbers', async () => {
    await assert.rejects(svc.fileTaxReturn(db, { workspaceId: ws, uid: 'v', startDate: '2026-07-01', endDate: '2026-09-30' }), /owners and accountants/);
    const filed = await svc.fileTaxReturn(db, { workspaceId: ws, uid: 'o', startDate: '2026-07-01', endDate: '2026-09-30', reference: 'Q3' });
    assert.equal(filed.boxes.find(b => b.key === '5')?.cents, 2200);
    await assert.rejects(svc.fileTaxReturn(db, { workspaceId: ws, uid: 'o', startDate: '2026-07-01', endDate: '2026-09-30' }), /already filed/);
    // a late change to a document in that period does not change the filed copy
    await db.collection('invoices').doc(id('zero')).update({ taxTreatment: 'standard', taxAmountCents: 1000, amountCents: 6000 });
    const [saved] = await svc.listTaxReturns(db, ws);
    assert.equal(saved.boxes.find(b => b.key === '1')?.cents, 2200);
    const now = await svc.computeWorkspaceTaxReturn(db, ws, '2026-07-01', '2026-09-30');
    assert.equal(now.boxes.find(b => b.key === '1')?.cents, 3200, 'recomputed: the change shows');
  });
});
