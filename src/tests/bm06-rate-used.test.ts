/**
 * BM-06: each converted line records which exchange rate it used (date and source; lib/rateUsed.ts). Figures by hand,
 * books in USD:
 *   INV-E1 €1,000.00 on 2026-10-01 at 1.10, today's market rate when it was entered → A/R +110,000, Sales −110,000;
 *     both lines carry "EUR>USD@2026-10-01:live:1.1"
 *   the same invoice whose rate was then typed as 1.12 → the record says 1.12, typed, on the invoice's date
 *   paid on 2026-10-15 at 1.12 typed: Cash +112,000 at "…@2026-10-15:typed:1.12", A/R −110,000 at
 *     "…@2026-10-01:live:1.1", exchange gain −2,000 = 1,000 × (1.12 − 1.10); the entry lists both rates
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingCore';
import { rateUsedText } from '../lib/rateUsed';
import type { ChartAccount, Invoice, Transaction, Workspace } from '../types';

const BOOKS = 'ws_bm06';
const accounts = [
  { id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
  { id: 'bank', name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
  { id: 'sales', name: 'Sales', type: 'income', code: '4000' },
].map(a => ({ ...a, workspaceId: BOOKS })) as unknown as ChartAccount[];
const invoice = (rateUsed: Record<string, unknown>, exchangeRate = 1.1) => ({
  id: 'inv-e1', workspaceId: BOOKS, number: 'INV-E1', customerName: 'Berlin GmbH', customerId: 'c1', date: '2026-10-01', dueDate: '2026-10-31', status: 'sent', currency: 'EUR',
  exchangeRate, amountCents: 100_000, items: [{ id: 'l1', description: 'Consulting', quantity: 1, rateCents: 100_000, amountCents: 100_000 }], metadata: { rateUsed },
}) as unknown as Invoice;
const build = async (data: Invoice) => {
  const context: LedgerPostContext = { accounts, workspaces: [{ id: BOOKS, uid: 'u1', name: 'US books', currency: 'USD', defaultAccountMappings: { ar: 'ar', revenue: 'sales' } } as unknown as Workspace], transactions: [], inventory: [], lockDate: null, uid: 'u1', today: '2026-10-22', capture: [] };
  await postInvoiceLedger(data.id!, data, BOOKS, 'u1', { collection: 'invoices', docId: data.id!, action: 'create' }, context);
  return context.capture![0].txs[0];
};

test('a €1,000.00 invoice at 1.10 (that day\'s market rate): the entry and each line say so', async () => {
  const entry = await build(invoice({ rate: 1.1, date: '2026-10-01', source: 'live' }));
  assert.deepEqual(entry.lines.map(l => [l.accountId, l.amountCents, l.rateUsedId]), [['ar', 110_000, 'EUR>USD@2026-10-01:live:1.1'], ['sales', -110_000, 'EUR>USD@2026-10-01:live:1.1']]);
  assert.equal(rateUsedText(entry.metadata!.rateUsed as never), '1 EUR = 1.1 USD on 2026-10-01 (that day\'s market rate)');
});

test('the rate typed later wins; a record for another rate is not used', async () => {
  const typed = await build(invoice({ rate: 1.12, date: '2026-10-01', source: 'typed' }, 1.12));
  assert.equal(typed.lines[0].rateUsedId, 'EUR>USD@2026-10-01:typed:1.12');
  const stale = await build(invoice({ rate: 1.1, date: '2026-09-30', source: 'live' }, 1.12));
  assert.equal(stale.lines[0].rateUsedId, 'EUR>USD@2026-10-01:document:1.12', 'the rate on the invoice, on its date');
  const home = await build({ ...invoice({}), currency: 'USD', exchangeRate: 1 } as Invoice);
  assert.equal(home.lines[0].rateUsedId, undefined, 'nothing converted, nothing recorded');
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('a payment at another day\'s rate (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_bm06_${crypto.randomBytes(4).toString('hex')}`;
  let db: import('../server/db/pgFirestore').Firestore;
  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as never;
    await db.collection('workspaces').doc(ws).set({ uid: 'u1', name: 'US books', currency: 'USD', timezone: 'UTC', members: ['u1'], defaultAccountMappings: { ar: `${ws}_ar` } });
    for (const [id, name, type, category] of [['ar', 'Accounts Receivable', 'asset', 'Receivables'], ['bank', 'Bank', 'asset', 'Cash'], ['fx', 'Exchange gain/loss', 'income', 'Rounding Differences']]) {
      await db.collection('chartAccounts').doc(`${ws}_${id}`).set({ workspaceId: ws, name, type, category });
    }
    await db.collection('customers').doc(`${ws}_c1`).set({ workspaceId: ws, name: 'Berlin GmbH' });
    await db.collection('invoices').doc(`${ws}_inv`).set({ ...invoice({ rate: 1.1, date: '2026-10-01', source: 'live' }), id: `${ws}_inv`, workspaceId: ws, customerId: `${ws}_c1`, amountPaidCents: 0 } as unknown as Record<string, unknown>);
  });
  after(async () => {
    for (const table of ['transactions', 'payments', 'invoices', 'customers', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    await db.terminate();
  });

  test('€1,000 paid at 1.12 (typed): cash at the day\'s rate, A/R at the invoice\'s, gain 2,000; both rates listed', async () => {
    const { createPaymentAtomic } = await import('../server/services/paymentService');
    await createPaymentAtomic(db, {
      workspaceId: ws, uid: 'u1', paymentDate: '2026-10-15', amountCents: 100_000, paymentMethod: 'bank_transfer', customerId: `${ws}_c1`, cashAccountId: `${ws}_bank`,
      paymentExchangeRate: 1.12, paymentRateSource: 'typed', allocations: [{ documentId: `${ws}_inv`, documentType: 'invoice', amountCents: 100_000 }],
    } as never);
    const [entry] = (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => d.data() as Transaction);
    const lines = Object.fromEntries(entry.lines.map(l => [l.accountId.replace(`${ws}_`, ''), [l.amountCents, l.rateUsedId ?? null]]));
    assert.deepEqual(lines, {
      bank: [112_000, 'EUR>USD@2026-10-15:typed:1.12'],
      ar: [-110_000, 'EUR>USD@2026-10-01:live:1.1'],
      fx: [-2_000, null],
    });
    assert.deepEqual((entry.metadata?.ratesUsed as Array<{ rate: number }>).map(r => r.rate), [1.1, 1.12]);
  });
});
