/**
 * EG-5: the customer's credit limit, enforced when an invoice is saved as issued through
 * POST /api/v1/documents/invoices/:id/post, on the local test database. Figures by hand:
 *   Acme: limit 5,000.00 (metadata.creditLimitCents 500000), workspace in USD
 *   owed on issued invoices: A-1 sent 3,000.00 unpaid + A-2 pending 1,500.00 less 300.00 paid = 1,200.00 → 4,200.00
 *   not counted: A-3 a draft of 3,000.00; A-4 void 2,000.00
 *   a new 1,000.00 invoice, issued: 4,200.00 + 1,000.00 = 5,200.00 > 5,000.00 → 409
 *     "Over Acme's credit limit: limit $5,000.00, owed $4,200.00, this invoice $1,000.00 → $5,200.00"
 *   the same as a draft → 200 (a draft is never refused)
 *   the same with an owner's override and a reason → 200, the override on the invoice and in the audit log
 *   the same with a bookkeeper's override → 403; a viewer → 403 (cannot change the books at all)
 *   an invoice of 700.00 → 200: 4,200.00 + 700.00 = 4,900.00, within
 *   an invoice of 1,000.00 in EUR → 200, not counted and not converted, a note in the answer
 *   the limit lowered to 4,000.00 (owed 4,900.00): the 700.00 invoice lowered to 600.00 → 200 (lowers the exposure);
 *   raised to 800.00 → 409 (4,200.00 + 800.00 = 5,000.00 > 4,000.00)
 * Pure: the report and the check agree on the same books (customerCreditLimits / creditLimitCheck).
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { creditLimitCheck, customerCreditLimits, creditLimitRefusalMessage } from '../lib/customerCreditLimits';
import type { ChartAccount, Workspace } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;
const MESSAGE = "Over Acme's credit limit: limit $5,000.00, owed $4,200.00, this invoice $1,000.00 → $5,200.00";

const acme: { id: string; name: string; metadata: Record<string, unknown> } = { id: 'acme', name: 'Acme', metadata: { creditLimitCents: 500_000 } };
const books = [
  { id: 'a1', customerId: 'acme', status: 'sent', amountCents: 300_000, currency: 'USD' },
  { id: 'a2', customerId: 'acme', status: 'pending', amountCents: 150_000, amountPaidCents: 30_000, currency: 'USD' },
  { id: 'a3', customerId: 'acme', status: 'draft', amountCents: 300_000, currency: 'USD' },
  { id: 'a4', customerId: 'acme', status: 'void', amountCents: 200_000, currency: 'USD' },
];

describe('EG-5: the credit-limit maths, shared by the report and the check', () => {
  test('the report and the check both see 4,200.00 owed', () => {
    assert.equal(customerCreditLimits({ customers: [acme], invoices: books, homeCurrency: 'USD' })[0].openCents, 420_000);
    const check = creditLimitCheck({ customer: acme, others: books, invoice: { id: 'n', customerId: 'acme', status: 'sent', amountCents: 100_000, currency: 'USD' }, homeCurrency: 'USD' })!;
    assert.deepEqual([check.owedCents, check.thisCents, check.totalCents, check.over], [420_000, 100_000, 520_000, true]);
    assert.equal(creditLimitRefusalMessage('Acme', check, 'USD'), MESSAGE);
  });
  test('a draft, no limit, exactly at 4,900.00, a foreign currency, an update that lowers: not over', () => {
    const at = (invoice: Record<string, unknown>, before?: Record<string, unknown>, customer: typeof acme = acme) =>
      creditLimitCheck({ customer, others: books, invoice: { id: 'n', customerId: 'acme', currency: 'USD', ...invoice }, before: before as never, homeCurrency: 'USD' });
    assert.equal(at({ status: 'draft', amountCents: 100_000 }), undefined);
    assert.equal(at({ status: 'sent', amountCents: 100_000 }, undefined, { ...acme, metadata: {} }), undefined);
    assert.equal(at({ status: 'sent', amountCents: 70_000 })!.over, false);
    const eur = at({ status: 'sent', amountCents: 100_000, currency: 'EUR' })!;
    assert.deepEqual([eur.thisCents, eur.over, eur.foreignCurrency], [0, false, 'EUR']);
    const tight = { ...acme, metadata: { creditLimitCents: 400_000 } };
    assert.equal(at({ status: 'sent', amountCents: 60_000 }, { id: 'n', customerId: 'acme', status: 'sent', amountCents: 70_000, currency: 'USD' }, tight)!.over, false);
    assert.equal(at({ status: 'sent', amountCents: 80_000 }, { id: 'n', customerId: 'acme', status: 'sent', amountCents: 70_000, currency: 'USD' }, tight)!.over, true);
  });
});

describe('EG-5: the credit limit enforced by POST /documents/invoices/:id/post', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_eg5_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-eg5', BOOKKEEPER = 'bk-eg5', VIEWER = 'viewer-eg5';
  let db: import('../server/db/pgFirestore').Firestore;
  let server: Server;
  let base = '';
  const accounts = [
    { id: `${ws}_ar`, name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
    { id: `${ws}_bank`, name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
    { id: `${ws}_vat`, name: 'VAT Payable', type: 'liability', category: 'Tax', code: '2200' },
    { id: `${ws}_sales`, name: 'Sales', type: 'income', code: '4000' },
    { id: `${ws}_fx`, name: 'FX Gain/Loss', type: 'expense', code: '7900' },
  ].map(a => ({ ...a, workspaceId: ws })) as unknown as ChartAccount[];
  const workspace = { id: ws, uid: OWNER, name: 'EG-5', currency: 'USD', timezone: 'UTC', defaultAccountMappings: { ar: `${ws}_ar`, revenue: `${ws}_sales`, tax: `${ws}_vat` } } as unknown as Workspace;
  const customerId = `${ws}_acme`;
  const invoice = (id: string, amountCents: number, status = 'sent', currency = 'USD') => ({
    id, workspaceId: ws, number: `N-${id.slice(-2)}`, customerName: 'Acme', customerId, date: '2026-10-21', dueDate: '2026-11-20', status, currency,
    ...(currency !== 'USD' ? { exchangeRate: 1.1 } : {}),
    amountCents, taxAmountCents: 0, taxRate: 0, taxVersion: 2,
    items: [{ id: 'l1', description: 'Work', quantity: 1, rateCents: amountCents, amountCents, accountId: `${ws}_sales` }],
  });
  const post = async (id: string, action: string, data: Record<string, unknown>, uid = OWNER, extra: Record<string, unknown> = {}) => {
    const res = await fetch(`${base}/api/v1/documents/invoices/${id}/post`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid, 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ workspaceId: ws, action, data, ...extra }) });
    return { status: res.status, body: await res.json() as Record<string, unknown> & { error?: string } };
  };
  const saved = async (id: string) => (await db.collection('invoices').doc(id).get()).data();
  const forget = (id: string) => db.collection('invoices').doc(id).delete();

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as unknown as typeof db;
    await db.collection('workspaces').doc(ws).set({ ...workspace, members: [OWNER, BOOKKEEPER, VIEWER], roles: { [OWNER]: 'owner', [BOOKKEEPER]: 'bookkeeper', [VIEWER]: 'viewer' } } as unknown as Record<string, unknown>);
    for (const a of accounts) await db.collection('chartAccounts').doc(a.id).set(a as unknown as Record<string, unknown>);
    await db.collection('customers').doc(customerId).set({ id: customerId, workspaceId: ws, name: 'Acme', metadata: { creditLimitCents: 500_000 } });
    for (const b of books) await db.collection('invoices').doc(`${ws}_${b.id}`).set({ ...b, id: `${ws}_${b.id}`, customerId, workspaceId: ws, date: '2026-10-01' });
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
    for (const table of ['transactions', 'invoices', 'customers', 'chartAccounts', 'idempotencyKeys', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    await db.terminate();
  });

  test('a new 1,000.00 invoice, issued: 409 with the figures, nothing saved', async () => {
    const id = `${ws}_n1`;
    const res = await post(id, 'create', invoice(id, 100_000));
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.error, MESSAGE);
    assert.equal(res.body.code, 'CREDIT_LIMIT');
    assert.equal(res.body.canOverride, true);
    assert.equal(await saved(id), undefined);
  });

  test('the same as a draft: 200', async () => {
    const id = `${ws}_d1`;
    const res = await post(id, 'create', invoice(id, 100_000, 'draft'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await saved(id))?.status, 'draft');
  });

  test('a bookkeeper\'s override: 403; a viewer\'s: 403; an empty reason: 400', async () => {
    const id = `${ws}_n2`;
    const bk = await post(id, 'create', invoice(id, 100_000), BOOKKEEPER, { creditLimitOverride: { reason: 'Trust me' } });
    assert.equal(bk.status, 403, JSON.stringify(bk.body));
    assert.match(String(bk.body.error), /Only an owner or accountant/);
    const bkPlain = await post(id, 'create', invoice(id, 100_000), BOOKKEEPER);
    assert.equal(bkPlain.status, 409);
    assert.equal(bkPlain.body.canOverride, false);
    assert.equal((await post(id, 'create', invoice(id, 100_000), VIEWER, { creditLimitOverride: { reason: 'Trust me' } })).status, 403);
    assert.equal((await post(id, 'create', invoice(id, 100_000), OWNER, { creditLimitOverride: { reason: '  ' } })).status, 400);
    assert.equal(await saved(id), undefined);
  });

  test('with the owner\'s override and a reason: 200, recorded on the invoice and in the audit log', async () => {
    const id = `${ws}_o1`;
    const res = await post(id, 'create', invoice(id, 100_000), OWNER, { creditLimitOverride: { reason: 'Paid by wire tomorrow' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const override = (await saved(id))?.metadata?.creditLimitOverride;
    assert.equal(override?.reason, 'Paid by wire tomorrow');
    assert.equal(override?.by, OWNER);
    assert.deepEqual([override?.limitCents, override?.owedCents, override?.thisCents, override?.totalCents], [500_000, 420_000, 100_000, 520_000]);
    const audit = (await db.collection('auditLogs').where('workspaceId', '==', ws).get()).docs.map(d => d.data());
    const entry = audit.find(a => a.action === 'CREDIT_LIMIT_OVERRIDE' && a.entityId === id);
    assert.ok(entry, 'in the audit log');
    assert.match(String(entry.details?.description), /Paid by wire tomorrow/);
    await forget(id); // back to 4,200.00 owed for the next cases
  });

  test('a 700.00 invoice: 200 (exactly 4,900.00)', async () => {
    const id = `${ws}_s7`;
    const res = await post(id, 'create', invoice(id, 70_000));
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test('an invoice of 1,000.00 in EUR: not counted, not converted, a note returned', async () => {
    const id = `${ws}_eu`;
    const res = await post(id, 'create', invoice(id, 100_000, 'sent', 'EUR'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.match(String(res.body.creditLimitNote), /in EUR: it is not counted against Acme's credit limit \(in USD\) and not converted/);
  });

  test('limit lowered to 4,000.00: lowering the 700.00 invoice to 600.00 passes, raising it to 800.00 is refused', async () => {
    await db.collection('customers').doc(customerId).update({ metadata: { creditLimitCents: 400_000 } });
    const id = `${ws}_s7`;
    const lower = await post(id, 'update', { amountCents: 60_000, items: [{ id: 'l1', description: 'Work', quantity: 1, rateCents: 60_000, amountCents: 60_000, accountId: `${ws}_sales` }] });
    assert.equal(lower.status, 200, JSON.stringify(lower.body));
    const raise = await post(id, 'update', { amountCents: 80_000, items: [{ id: 'l1', description: 'Work', quantity: 1, rateCents: 80_000, amountCents: 80_000, accountId: `${ws}_sales` }] });
    assert.equal(raise.status, 409, JSON.stringify(raise.body));
    assert.equal(raise.body.error, "Over Acme's credit limit: limit $4,000.00, owed $4,200.00, this invoice $800.00 → $5,000.00");
    assert.equal((await saved(id))?.amountCents, 60_000);
  });
});
