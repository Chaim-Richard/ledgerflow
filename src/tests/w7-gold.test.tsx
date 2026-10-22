/**
 * W7-GOLD (RELEASE_GATE W7, "Verified"): an Israeli VAT month end to end against a real database, figures by hand.
 * The tax on each invoice is the invoice screen's own answer (`resolveLineTax` for the seller and the buyer's place →
 * `taxChoiceFor` → `documentTotals`); invoices and bills are posted by the app's own posting code; the VAT report,
 * the allocation-number step and the PCN874 draft are read by the code the Israel Month Journey screen uses
 * (`israelMonthJourney`, `ilPcn874Preview`), from the documents and the chart as saved. Runs when LF_TEST_DATABASE_URL
 * is set.
 *
 * Worked figures (agorot). Tel Aviv Tech Ltd, VAT registration 514000001 (monthly), books in ILS, September 2026.
 * VAT 18% from 2025-01-01; an allocation number is needed above ₪5,000 net to a business buyer from 2026-06-01.
 *   INV 1001 09-03 Haifa Systems (512345678, Haifa)   12 h × 50,000 =   600,000 + 18% 108,000 =   708,000  allocation 123456789
 *   INV 1002 09-08 Cafe Neve (514444444, Tel Aviv)     6 h × 50,000 =   300,000 + 18%  54,000 =   354,000  (₪3,000: none needed)
 *   INV 1003 09-12 Haifa Systems                         8 h × 50,000 =   400,000 + 18%  72,000 =   472,000  (₪4,000: none needed)
 *   INV 1004 09-15 Red Sea Diving (513333333, אילת)    20 h × 50,000 = 1,000,000 zero-rated (a sale into Eilat, s.5)
 *   INV 1005 09-22 Berlin Data GmbH (DE, 123456789)    50 h × 50,000 = 2,500,000 zero-rated (export, s.30)
 *   BILL 9001 09-05 Office Depot IL (511111111)  supplies (Office expenses)        150,000 + 18%  27,000 =   177,000
 *   BILL 9002 09-18 CNC Machines Ltd (512222222) a router (Machinery and equipment) 800,000 + 18% 144,000 = 944,000
 *   VAT report (form 836 figures), 514000001, September:
 *     taxable sales 600,000 + 300,000 + 400,000 = 1,300,000; output VAT 108,000 + 54,000 + 72,000 = 234,000
 *     zero-rated 1,000,000 + 2,500,000 = 3,500,000; exempt 0
 *     input VAT, equipment 144,000 (from the bill's account, ISS-160); other 27,000
 *     to pay 234,000 − 144,000 − 27,000 = 63,000 (₪630)
 *   Ledger on 09-30: Output VAT −234,000; Input VAT +171,000 (27,000 + 144,000); net owed 63,000. A/R 708,000 + 354,000
 *     + 472,000 + 1,000,000 + 2,500,000 = 5,034,000. A/P −(177,000 + 944,000) = −1,121,000.
 *   Allocation step: one invoice needs a number (1001, ₪6,000 > ₪5,000, business buyer, VAT charged) and has it.
 *   PCN874 draft (historical Appendix A, never filing-ready), whole shekels, generated 2026-10-01:
 *     S 512345678 20260903 1001 VAT 1080 base 6000 allocation 123456789
 *     S 514444444 20260908 1002 VAT 540 base 3000;  S 512345678 20260912 1003 VAT 720 base 4000
 *     L 513333333 20260915 1004 VAT 0 base 10000;   L 123456789 20260922 1005 VAT 0 base 25000
 *     T 511111111 20260905 9001 VAT 270 base 1500;  R 512222222 20260918 9002 VAT 1440 base 8000
 *     header: taxable 13,000 / VAT 2,340, 5 sales, zero-rated 35,000, input other 270, equipment 1,440, 2 inputs,
 *     to pay 2,340 − 270 − 1,440 = 630 — the same as the report in shekels.
 * Fix this test found: the screen's PCN874 draft wrote the equipment bill as an "other" input (T, 1,440 in the other
 * column) because only the VAT report classified saved bills by their accounts (ISS-160); the draft now does too.
 */
import './helpers/dom';
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingKit';
import { resolveSellerProfile, type TaxPlace, type TaxProfiles } from '../lib/tax/profile';
import { resolveLineTax, taxChoiceFor } from '../lib/tax/resolveLineTax';
import { documentTotals, effectiveRate, taxCodeFromRate } from '../lib/taxCodes';
import { ilPcn874Preview, israelMonthJourney, type IlJourneyDocument, type IlJourneyParty } from '../lib/israelMonthJourney';
import type { ChartAccount, Transaction, Workspace } from '../types';
// the browser's posting host (stores + upload), as LedgerPostService registers it in the app (L-94)
import '../services/ledgerPost/postingKit';

const url = process.env.LF_TEST_DATABASE_URL;

const PROFILES: TaxProfiles = {
  books: { name: 'Tel Aviv Tech Ltd', place: { country: 'IL', city: 'Tel Aviv' }, registrations: [
    { kind: 'vat', number: '514000001', place: { country: 'IL' }, validFrom: '2020-01-01', filing: 'monthly' },
  ] },
};
/** The workspace's VAT codes (Settings → Tax rates), as the invoice screen reads them. */
const CODES = [
  { id: 'vat18', name: 'VAT 18%', components: [{ name: 'VAT', rate: 18 }] },
  { id: 'zero', name: 'Zero rate', treatment: 'zero_rated' as const, components: [] },
  { id: 'exempt', name: 'Exempt', treatment: 'exempt' as const, components: [] },
].map(taxCodeFromRate);

describe('W7 with worked figures', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_w7_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-1';
  const id = (s: string) => `${ws}_${s}`;
  let server: Server;
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  const acct: Record<string, ChartAccount> = {};
  const workspace = { id: ws, uid: OWNER, name: 'Tel Aviv Tech', currency: 'ILS', taxProfiles: PROFILES } as unknown as Workspace;
  const all = async <T,>(collection: string) => (await db.collection(collection).where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }) as T);
  const context = async (): Promise<LedgerPostContext> => ({
    accounts: Object.values(acct), lockDate: null, uid: OWNER, inventory: [], transactions: await all<Transaction>('transactions'), workspaces: [workspace],
  });
  const balance = async (code: string) => (await all<Transaction>('transactions'))
    .filter(t => ['completed', 'approved', 'posted'].includes(String(t.status)) && String(t.date) <= '2026-09-30')
    .flatMap(t => t.lines || []).filter(l => l.accountId === acct[code].id).reduce((s, l) => s + l.amountCents, 0);

  /** An invoice saved as the invoice screen saves it: the tax the screen suggests for this seller and buyer. */
  const invoice = async (number: string, customerKey: string, date: string, hours: number, allocation?: string) => {
    const customer = (await db.collection('customers').doc(id(customerKey)).get()).data() as { name: string; metadata: { taxPlace: TaxPlace } };
    const tax = resolveLineTax({ seller: resolveSellerProfile(PROFILES, {}, ['world']), buyer: customer.metadata.taxPlace, date });
    // a zero-rated relief is offered on its conditions; the person keeps the documents and chooses it
    const choice = taxChoiceFor(tax.rate, CODES, effectiveRate, tax.treatment === 'zero_rated' ? 'zero_rated' : undefined);
    const code = CODES.find(c => c.id === choice.taxCodeId)!;
    const lines = hours * 50_000;
    const totals = documentTotals(lines, 0, code, false);
    const data = {
      id: id(`inv${number}`), workspaceId: ws, uid: OWNER, number, customerId: id(customerKey), customerName: customer.name, date, dueDate: date,
      status: 'sent' as const, currency: 'ILS', amountCents: totals.amountCents, amountPaidCents: 0, lineSumCents: totals.subtotalCents, discountCents: 0,
      taxAmountCents: totals.taxCents, taxInclusive: true, taxVersion: 2, pricesIncludeTax: false, taxCodeId: code.id, taxTreatment: code.treatment,
      taxBreakdown: totals.components, taxRate: Math.round(effectiveRate(code.components) * 100000) / 1000,
      items: [{ id: 'l0', description: 'Development hours', quantity: hours, rateCents: 50_000, amountCents: lines, accountId: acct['4000'].id }],
      metadata: { taxPlace: customer.metadata.taxPlace, ...(allocation ? { ilAllocationNumber: allocation } : {}) },
    };
    await postInvoiceLedger(data.id, data as never, ws, OWNER, { collection: 'invoices', docId: data.id, action: 'create', data }, await context());
    return [tax.reason, code.id, totals.netCents, totals.taxCents, totals.amountCents];
  };
  /** A bill as the bill screen saves it: the vendor's VAT on top of the lines, the lines on the account chosen. */
  const bill = async (number: string, vendorKey: string, date: string, netCents: number, accountCode: string, description: string) => {
    const vendorName = ((await db.collection('vendors').doc(id(vendorKey)).get()).data() as { name: string }).name;
    const totals = documentTotals(netCents, 0, CODES[0], false);
    const data = {
      id: id(`bill${number}`), workspaceId: ws, uid: OWNER, number, billNumber: number, vendorId: id(vendorKey), vendorName, date, dueDate: date,
      status: 'approved' as const, currency: 'ILS', amountCents: totals.amountCents, amountPaidCents: 0, taxAmountCents: totals.taxCents,
      taxVersion: 2, taxCodeId: 'vat18', taxTreatment: 'standard', pricesIncludeTax: false,
      splits: [{ amountCents: netCents, description, accountId: acct[accountCode].id }],
    };
    await postBillLedger(data.id, data as never, ws, OWNER, { collection: 'bills', docId: data.id, action: 'create', data }, await context());
    return [totals.netCents, totals.taxCents, totals.amountCents];
  };
  /** What the Israel Month Journey screen reads, as saved. */
  const saved = async () => ({
    invoices: await all<IlJourneyDocument>('invoices'), bills: await all<IlJourneyDocument>('bills'),
    customers: await all<IlJourneyParty>('customers'), vendors: await all<IlJourneyParty>('vendors'), accounts: await all<ChartAccount>('chartAccounts'),
  });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: workspace.name, currency: 'ILS', timezone: 'Asia/Jerusalem', members: [OWNER], taxProfiles: PROFILES });
    // the chart (Input VAT before Output VAT: a bill's VAT goes to the first tax account that is an asset or liability)
    for (const [code, name, type, category] of [
      ['1000', 'Bank Leumi', 'asset', 'Cash'], ['1100', 'Accounts Receivable', 'asset', 'Receivables'], ['1400', 'Input tax (VAT)', 'asset', 'Taxes'],
      ['1600', 'Machinery and equipment', 'asset', 'Fixed Assets'], ['2000', 'Accounts Payable', 'liability', 'Payables'],
      ['2200', 'Output tax (VAT)', 'liability', 'Taxes'], ['4000', 'Development revenue', 'income', 'Revenue'], ['6000', 'Office expenses', 'expense', 'Operating'],
    ] as const) {
      const data = { workspaceId: ws, code, name, type, category };
      await db.collection('chartAccounts').doc(id(code)).set(data);
      acct[code] = { ...data, id: id(code) } as unknown as ChartAccount;
    }
    const party = (collection: 'customers' | 'vendors', key: string, name: string, vatNumber: string, taxPlace: TaxPlace) =>
      db.collection(collection).doc(id(key)).set({ workspaceId: ws, uid: OWNER, name, metadata: { vatNumber, taxPlace } });
    await party('customers', 'haifa', 'Haifa Systems Ltd', '512345678', { country: 'IL', city: 'Haifa' });
    await party('customers', 'cafe', 'Cafe Neve', '514444444', { country: 'IL', city: 'Tel Aviv' });
    await party('customers', 'eilat', 'Red Sea Diving Ltd', '513333333', { country: 'IL', city: 'אילת' });
    await party('customers', 'berlin', 'Berlin Data GmbH', '123456789', { country: 'DE', city: 'Berlin' });
    await party('vendors', 'depot', 'Office Depot IL', '511111111', { country: 'IL' });
    await party('vendors', 'cnc', 'CNC Machines Ltd', '512222222', { country: 'IL' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@telaviv.test' }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      return realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
    }) as typeof fetch;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'invoices', 'bills', 'customers', 'vendors', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('five invoices take the tax the screen suggests: 18% in Israel, zero-rated into Eilat and abroad', async () => {
    assert.deepEqual(await invoice('1001', 'haifa', '2026-09-03', 12, '123456789'), ['taxed', 'vat18', 600_000, 108_000, 708_000]);
    assert.deepEqual(await invoice('1002', 'cafe', '2026-09-08', 6), ['taxed', 'vat18', 300_000, 54_000, 354_000]);
    assert.deepEqual(await invoice('1003', 'haifa', '2026-09-12', 8), ['taxed', 'vat18', 400_000, 72_000, 472_000]);
    assert.deepEqual(await invoice('1004', 'eilat', '2026-09-15', 20), ['zero-area', 'zero', 1_000_000, 0, 1_000_000]);
    assert.deepEqual(await invoice('1005', 'berlin', '2026-09-22', 50), ['export', 'zero', 2_500_000, 0, 2_500_000]);
    assert.deepEqual(await bill('9001', 'depot', '2026-09-05', 150_000, '6000', 'Printer paper and toner'), [150_000, 27_000, 177_000]);
    assert.deepEqual(await bill('9002', 'cnc', '2026-09-18', 800_000, '1600', 'CNC router'), [800_000, 144_000, 944_000]);
  });

  test('the books on 30 September: Output VAT −234,000, Input VAT +171,000, A/R 5,034,000, A/P −1,121,000', async () => {
    assert.equal(await balance('2200'), -234_000);
    assert.equal(await balance('1400'), 171_000);
    assert.equal(await balance('2200') + await balance('1400'), -63_000, 'net VAT owed ₪630');
    assert.equal(await balance('1100'), 5_034_000);
    assert.equal(await balance('2000'), -1_121_000);
    assert.equal(await balance('1600'), 800_000, 'the router is on the equipment account');
    assert.equal(await balance('4000'), -4_800_000);
  });

  test('the VAT report: taxable 1,300,000 / VAT 234,000, zero-rated 3,500,000, input equipment 144,000 + other 27,000, to pay 63,000', async () => {
    const docs = await saved();
    const journey = israelMonthJourney({ month: '2026-09', today: '2026-10-01', currency: 'ILS', profiles: PROFILES, order: ['world'], ...docs });
    const [ret] = journey.steps.find(s => s.id === 'vat-report')!.returns;
    assert.deepEqual(
      [ret.registration, ret.taxableSalesCents, ret.outputVatCents, ret.zeroRatedSalesCents, ret.exemptSalesCents, ret.fixedAssetInputVatCents, ret.otherInputVatCents, ret.toPayCents, ret.documentCount, ret.dueDate],
      ['vat:IL:514000001', 1_300_000, 234_000, 3_500_000, 0, 144_000, 27_000, 63_000, 7, '2026-10-15'],
    );
    const allocation = journey.steps.find(s => s.id === 'allocation')!;
    assert.deepEqual(allocation.allocation.map(a => [a.number, a.recorded, a.netCents, a.thresholdCents, a.problem]), [['1001', '123456789', 600_000, 500_000, null]]);
    assert.equal(allocation.status, 'done');
    assert.deepEqual(journey.problems, []);
  });

  test('the PCN874 draft: seven rows and a header whose totals equal the report in shekels', async () => {
    const docs = await saved();
    const journey = israelMonthJourney({ month: '2026-09', today: '2026-10-01', currency: 'ILS', profiles: PROFILES, order: ['world'], ...docs });
    const returns = journey.steps.find(s => s.id === 'vat-report')!.returns;
    // as the screen asks for it: the dealer's registration, the month's return beside it
    const preview = ilPcn874Preview({ month: '2026-09', generatedOn: '2026-10-01', currency: 'ILS', dealerId: '514000001', registration: 'vat:IL:514000001', profiles: PROFILES, order: ['world'], returns, ...docs });
    assert.deepEqual(preview.unmapped, []);
    const draft = preview.draft!;
    assert.equal(draft.filingReady, false);
    // type, counterparty, date, group (4 spaces), number, VAT, sign, base, allocation
    const row = (t: string, who: string, day: string, n: string, vat: number, base: number, alloc = '000000000') =>
      `${t}${who}${day}    ${n.padStart(9, '0')}${String(vat).padStart(9, '0')}+${String(base).padStart(10, '0')}${alloc}`;
    assert.deepEqual([...draft.transactions].sort(), [
      row('S', '512345678', '20260903', '1001', 1080, 6000, '123456789'),
      row('S', '514444444', '20260908', '1002', 540, 3000),
      row('S', '512345678', '20260912', '1003', 720, 4000),
      row('L', '513333333', '20260915', '1004', 0, 10000),
      row('L', '123456789', '20260922', '1005', 0, 25000),
      row('T', '511111111', '20260905', '9001', 270, 1500),
      row('R', '512222222', '20260918', '9002', 1440, 8000),
    ].sort());
    assert.equal(draft.header,
      'O' + '514000001' + '202609' + '1' + '20261001'
      + '+' + '00000013000' + '+' + '000002340'   // taxable sales, their VAT
      + '+' + '00000000000' + '+' + '000000000'   // the layout's unused pair
      + '000000005'                               // sales rows
      + '+' + '00000035000'                       // zero-rated sales
      + '+' + '000000270' + '+' + '000001440'     // input VAT: other, equipment
      + '000000002'                               // input rows
      + '+' + '00000000630');                     // to pay
    assert.equal(draft.closing, 'X514000001');
    assert.ok(preview.comparison.length > 0 && preview.comparison.every(c => c.differenceNis === 0), JSON.stringify(preview.comparison));
  });
});
