/**
 * EG-12 (probe): a posted invoice or bill keeps the exact tax breakdown it used (code, rate, compound parts, amounts),
 * unchanged after the workspace's tax code rate changes. On the local test database, through the server route.
 *
 * What the app supports (probe finding): ONE tax code per document (src/lib/taxCodes.ts; InvoiceModal / BillModal save
 * `taxCodeId`, `taxTreatment`, `taxBreakdown`, `taxAmountCents` on the document; usInvoiceTax.ts: "an invoice carries one
 * tax code ... per-line tax stays with AI #1"). Lines carry no tax code, so two lines at different codes cannot be posted;
 * the invoice below has two lines under one compound, two-part code.
 *
 * Figures by hand:
 *   INV-1  line 1: 1,000.00; line 2: 500.00 → net 1,500.00, code "GST+QST" (GST 5%, QST 9.975% compound)
 *          GST 5% of 1,500.00 = 75.00; QST 9.975% of 1,575.00 = 157.10625 → 157.11; tax 232.11; total 1,732.11
 *          entry: A/R +1,732.11 · Sales −1,500.00 · Tax payable −232.11
 *   BILL-1 400.00 at "VAT 17%" = 68.00; total 468.00 → entry: Supplies +400.00 · Tax payable +68.00 (the `tax` mapping) · A/P −468.00
 *   Then the codes change: GST 5% → 6%, QST → 10%, VAT 17% → 18%. Stored documents and entries still show the old
 *   breakdown; the return for Oct 2026: box 1 = 232.11, box 4 = 68.00, box 6 = 1,500.00, box 7 = 400.00, box 5 = 164.11;
 *   Israel's report (the books' registration): output 232.11, other inputs 68.00, to pay 164.11.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { computeTax, taxCodeFromRate } from '../lib/taxCodes';
import { buildTaxReturn, type TaxableDocument } from '../lib/taxReturnDocs';
import { israelVatReturn } from '../lib/tax/ilVatReturn';
import type { TaxProfiles } from '../lib/tax/profile';
import type { Transaction } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;

describe('EG-12: a posted document keeps the tax breakdown it used', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_eg12_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-eg12';
  let db: import('../server/db/pgFirestore').Firestore;
  let server: Server;
  let base = '';
  const accounts = [
    { id: `${ws}_ar`, name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
    { id: `${ws}_bank`, name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
    { id: `${ws}_ap`, name: 'Accounts Payable', type: 'liability', category: 'Payables', code: '2000' },
    { id: `${ws}_vat`, name: 'Tax Payable', type: 'liability', category: 'Tax', code: '2200' },
    { id: `${ws}_sales`, name: 'Sales', type: 'income', code: '4000' },
    { id: `${ws}_supplies`, name: 'Office Supplies', type: 'expense', code: '6000' },
  ].map(a => ({ ...a, workspaceId: ws }));
  const workspace = { id: ws, uid: OWNER, name: 'EG-12', currency: 'USD', timezone: 'UTC', defaultAccountMappings: { ar: `${ws}_ar`, ap: `${ws}_ap`, revenue: `${ws}_sales`, tax: `${ws}_vat`} };
  const gstQst = { id: `${ws}_gstqst`, workspaceId: ws, name: 'GST+QST', treatment: 'standard', components: [{ name: 'GST', rate: 5 }, { name: 'QST', rate: 9.975, compound: true }] };
  const vat17 = { id: `${ws}_vat17`, workspaceId: ws, name: 'VAT 17%', treatment: 'standard', components: [{ name: 'VAT', rate: 17 }] };
  const OLD_INV_PARTS = [{ name: 'GST', rate: 5, taxCents: 7_500 }, { name: 'QST', rate: 9.975, taxCents: 15_711 }];
  const OLD_BILL_PARTS = [{ name: 'VAT', rate: 17, taxCents: 6_800 }];
  const inv1 = `${ws}_inv1`;
  const bill1 = `${ws}_bill1`;

  const call = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': OWNER, 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const post = (type: string, id: string, data: Record<string, unknown>) => call(`/api/v1/documents/${type}/${id}/post`, { workspaceId: ws, action: 'create', data });
  const entries = async (key: string, docId: string) => (await db.collection('transactions').where('workspaceId', '==', ws).where(`metadata.${key}`, '==', docId).get()).docs.map(d => d.data() as Transaction);
  /** the account's net on the document's entries (a re-post reverses the old entry and writes a new one) */
  const net = (txs: Transaction[], account: string) => txs.flatMap(t => t.lines || []).filter(l => l.accountId === `${ws}_${account}`).reduce((s, l) => s + l.amountCents, 0);
  const docs = async (table: string) => (await db.collection(table).where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as TaxableDocument);
  const profiles: TaxProfiles = { books: { place: { country: 'IL' }, registrations: [{ kind: 'vat', number: '514000000', place: { country: 'IL' }, filing: 'monthly' }] } } as TaxProfiles;

  /** what the forms save (documentTotals → taxCodeId, taxTreatment, taxBreakdown, taxAmountCents, taxVersion 2) */
  const invoiceBody = () => {
    const tax = computeTax(150_000, taxCodeFromRate(gstQst as never));
    return {
      id: inv1, workspaceId: ws, number: 'INV-1', customerName: 'Acme', customerId: 'c1', date: '2026-10-21', dueDate: '2026-11-20', status: 'sent', currency: 'USD',
      amountCents: 150_000 + tax.taxCents, taxAmountCents: tax.taxCents, taxVersion: 2, lineSumCents: 150_000,
      taxCodeId: gstQst.id, taxTreatment: tax.treatment, taxBreakdown: tax.components,
      items: [
        { id: 'l1', description: 'Consulting', quantity: 1, rateCents: 100_000, amountCents: 100_000 },
        { id: 'l2', description: 'Training', quantity: 1, rateCents: 50_000, amountCents: 50_000 },
      ],
    };
  };
  const billBody = () => {
    const tax = computeTax(40_000, taxCodeFromRate(vat17 as never));
    return {
      id: bill1, workspaceId: ws, number: 'BILL-1', vendorName: 'Paper Co', vendorId: 'v1', date: '2026-10-22', dueDate: '2026-11-21', status: 'unpaid', currency: 'USD',
      amountCents: 40_000 + tax.taxCents, taxAmountCents: tax.taxCents, taxVersion: 2, lineSumCents: 40_000,
      taxCodeId: vat17.id, taxTreatment: tax.treatment, taxBreakdown: tax.components,
      items: [{ id: 'b1', description: 'Paper', quantity: 1, rateCents: 40_000, amountCents: 40_000, accountId: `${ws}_supplies` }],
    };
  };

  /** the stored invoice, bill and their entries show the breakdown they were posted with */
  const assertStored = async () => {
    const inv = (await db.collection('invoices').doc(inv1).get()).data()!;
    assert.equal(inv.taxCodeId, gstQst.id);
    assert.equal(inv.taxTreatment, 'standard');
    assert.deepEqual(inv.taxBreakdown, OLD_INV_PARTS);
    assert.equal(inv.taxAmountCents, 23_211);
    assert.equal(inv.amountCents, 173_211);
    assert.deepEqual((inv.items as Array<{ amountCents: number }>).map(i => i.amountCents), [100_000, 50_000]);
    const invTx = await entries('invoiceId', inv1);
    assert.equal(net(invTx, 'ar'), 173_211);
    assert.equal(net(invTx, 'sales'), -150_000);
    assert.equal(net(invTx, 'vat'), -23_211);
    // the entry's tax line keeps the code and its parts (the live one: not a reversal)
    const invTaxLines = invTx.filter(t => !t.metadata?.isReversal).flatMap(t => t.lines || []).filter(l => l.accountId === `${ws}_vat`);
    assert.ok(invTaxLines.length >= 1);
    for (const l of invTaxLines) {
      assert.deepEqual([l.taxCodeId, l.taxTreatment, l.taxBreakdown], [gstQst.id, 'standard', OLD_INV_PARTS]);
      assert.equal(l.taxRate, undefined, 'two parts: no single rate');
    }

    const bill = (await db.collection('bills').doc(bill1).get()).data()!;
    assert.equal(bill.taxCodeId, vat17.id);
    assert.deepEqual(bill.taxBreakdown, OLD_BILL_PARTS);
    assert.equal(bill.taxAmountCents, 6_800);
    const billTx = await entries('billId', bill1);
    // the workspace maps `tax` to Tax Payable, so the input tax goes there too (the builder's mapping rule)
    assert.equal(net(billTx, 'vat'), 6_800);
    const billTaxLines = billTx.flatMap(t => t.lines || []).filter(l => l.accountId === `${ws}_vat`);
    assert.deepEqual(billTaxLines.map(l => [l.amountCents, l.taxRate, l.taxCodeId, l.taxTreatment, l.taxBreakdown]), [[6_800, 17, vat17.id, 'standard', OLD_BILL_PARTS]]);
    assert.equal(net(billTx, 'ap'), -46_800);
    assert.equal(net(billTx, 'supplies'), 40_000);
  };
  const assertReturns = async () => {
    const period = { startDate: '2026-10-01', endDate: '2026-10-31' };
    const [invoices, bills] = [await docs('invoices'), await docs('bills')];
    const r = buildTaxReturn({ ...period, invoices, bills });
    const box = (k: string) => r.boxes.find(b => b.key === k)?.cents;
    assert.deepEqual(['1', '4', '5', '6', '7'].map(box), [23_211, 6_800, 16_411, 150_000, 40_000]);
    const il = israelVatReturn({ ...period, registration: 'vat:IL:514000000', profiles, order: [], invoices, bills });
    assert.deepEqual([il.taxableSalesCents, il.outputVatCents, il.otherInputVatCents, il.toPayCents, il.documentCount], [150_000, 23_211, 6_800, 16_411, 2]);
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as unknown as typeof db;
    await db.collection('workspaces').doc(ws).set({ ...workspace, members: [OWNER], roles: { [OWNER]: 'owner' } });
    for (const a of accounts) await db.collection('chartAccounts').doc(a.id).set(a);
    for (const r of [gstQst, vat17]) await db.collection('taxRates').doc(r.id).set(r);
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'invoices', 'bills', 'taxRates', 'chartAccounts', 'idempotencyKeys', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    await db.terminate();
  });

  test('INV-1 (two lines, GST 5% + QST 9.975% compound) and BILL-1 (VAT 17%) post with their breakdown stored', async () => {
    const i = await post('invoices', inv1, invoiceBody());
    assert.equal(i.status, 200, JSON.stringify(i.body));
    const b = await post('bills', bill1, billBody());
    assert.equal(b.status, 200, JSON.stringify(b.body));
    await assertStored();
    await assertReturns();
  });

  test('after the workspace\'s rates change, the documents, entries and returns keep the old figures', async () => {
    await db.collection('taxRates').doc(gstQst.id).update({ components: [{ name: 'GST', rate: 6 }, { name: 'QST', rate: 10, compound: true }] });
    await db.collection('taxRates').doc(vat17.id).update({ name: 'VAT 18%', components: [{ name: 'VAT', rate: 18 }] });
    await assertStored();
    await assertReturns();
  });

  test('an unrelated update of the posted invoice (its memo) re-posts the same tax, not the new rate', async () => {
    const res = await call(`/api/v1/documents/invoices/${inv1}/post`, { workspaceId: ws, action: 'update', data: { notes: 'Thanks' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    await assertStored();
    await assertReturns();
  });
});
