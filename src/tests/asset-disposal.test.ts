/**
 * Selling or scrapping a fixed asset (X-03), checked by hand: the entry posts the depreciation still
 * due through the disposal month, takes the cost and all accumulated depreciation off the books,
 * records the money received and the gain or loss, and balances; the asset is marked disposed. A
 * viewer, a future date, a date before the purchase or a missing account are refused; a second
 * disposal too. Undo voids the entry and puts the asset back, but not in a closed period. The
 * database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { disposalGainLoss, disposalLines, disposalProblem } from '../lib/assetDisposal';

const acc = (id: string) => ({ id, name: id });

describe('Disposal entry', () => {
  test('sold for more than its book value: catch-up depreciation, cost and depreciation off, a gain', () => {
    // cost 12,000.00; posted 4,000.00; 500.00 still due; sold for 9,000.00 → gain 9,000 + 4,500 − 12,000 = 1,500.00
    const input = { costCents: 1_200_000, postedDepreciationCents: 400_000, catchUpCents: 50_000, proceedsCents: 900_000 };
    assert.equal(disposalGainLoss(input), 150_000);
    const lines = disposalLines(input, { asset: acc('equipment'), accumulated: acc('accum'), expense: acc('depexp'), gainLoss: acc('gain'), proceeds: acc('bank') });
    assert.deepEqual(lines.map(l => [l.accountId, l.amountCents]), [
      ['depexp', 50_000], ['accum', 400_000], ['bank', 900_000], ['equipment', -1_200_000], ['gain', -150_000],
    ]);
    assert.equal(lines.reduce((s, l) => s + l.amountCents, 0), 0);
  });

  test('scrapped for nothing: the book value is a loss', () => {
    const input = { costCents: 100_000, postedDepreciationCents: 30_000, catchUpCents: 0, proceedsCents: 0 };
    const lines = disposalLines(input, { asset: acc('equipment'), accumulated: acc('accum'), gainLoss: acc('loss') });
    assert.deepEqual(lines.map(l => [l.accountId, l.amountCents]), [['accum', 30_000], ['equipment', -100_000], ['loss', 70_000]]);
  });

  test('what is missing is named', () => {
    const input = { costCents: 100, postedDepreciationCents: 0, catchUpCents: 10, proceedsCents: 50 };
    assert.match(String(disposalProblem(input, {})), /account the asset is in/);
    assert.match(String(disposalProblem(input, { asset: acc('a'), accumulated: acc('b') })), /depreciation expense/);
    assert.match(String(disposalProblem(input, { asset: acc('a'), accumulated: acc('b'), expense: acc('c') })), /money went to/);
    assert.match(String(disposalProblem(input, { asset: acc('a'), accumulated: acc('b'), expense: acc('c'), proceeds: acc('d') })), /gain or loss/);
    assert.match(String(disposalProblem({ ...input, proceedsCents: -1 }, {})), /zero or more/);
    assert.equal(disposalProblem({ costCents: 100, postedDepreciationCents: 50, catchUpCents: 0, proceedsCents: 50 }, { asset: acc('a'), accumulated: acc('b'), proceeds: acc('d') }), null, 'no gain or loss: no account needed');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Asset disposal (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_dispose_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const call = async (uid: string, method: string, body?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/assets/${id('van')}/disposal`, {
      method, headers: { 'Content-Type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json() as { message?: string; transactionId?: string; gainLossCents?: number; catchUpCents?: number } };
  };
  const sale = { date: '2026-10-05', proceedsCents: 1_000_000, proceedsAccountId: '', gainLossAccountId: '' };
  const van = async () => (await db.collection('assets').doc(id('van')).get()).data();

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    sale.proceedsAccountId = id('bank');
    sale.gainLossAccountId = id('gainloss');
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Disposal Co', currency: 'USD', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    const account = (name: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(name)).set({ workspaceId: ws, uid: 'owner-1', balanceCents: 0, isActive: true, ...fields });
    await account('equipment', { code: '1500', name: 'Vehicles', type: 'asset' });
    await account('accum', { code: '1590', name: 'Accumulated Depreciation', type: 'asset' });
    await account('depexp', { code: '6400', name: 'Depreciation Expense', type: 'expense' });
    await account('bank', { code: '1000', name: 'Checking', type: 'asset', category: 'Cash' });
    await account('gainloss', { code: '7900', name: 'Gain or loss on disposal', type: 'expense' });
    // 12,000.00 over 5 years, nothing left: 200.00 a month; 8 months posted (1,600.00)
    await db.collection('assets').doc(id('van')).set({
      workspaceId: ws, uid: 'owner-1', name: 'Delivery van', purchaseDate: '2026-01-01', purchasePriceCents: 1_200_000, salvageValueCents: 0,
      usefulLifeYears: 5, depreciationMethod: 'straight-line', accumulatedDepreciationCents: 160_000, depreciatedThrough: '2026-09',
      status: 'active', createdAt: '2026-01-01T00:00:00Z', assetAccountId: id('equipment'),
    });
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'assets', 'chartAccounts', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('refused: a viewer, a future date, a date before the purchase, no gain or loss account', async () => {
    assert.equal((await call('view-1', 'POST', sale)).status, 403);
    assert.match(String((await call('book-1', 'POST', { ...sale, date: '2099-01-01' })).body.message), /future/);
    assert.match(String((await call('book-1', 'POST', { ...sale, date: '2025-12-31' })).body.message), /bought on 2026-01-01/);
    const { gainLossAccountId: _omit, ...noGainLoss } = sale;
    assert.match(String((await call('book-1', 'POST', noGainLoss)).body.message), /gain or loss/);
    assert.equal((await van())?.status, 'active');
  });

  test('sold for 10,000.00: one balanced entry with the catch-up depreciation and a 200.00 loss; the van is disposed', async () => {
    const res = await call('book-1', 'POST', sale);
    assert.equal(res.status, 200);
    // through October: 9 months × 200.00 = 1,800.00; 200.00 still due; 10,000 + 1,800 − 12,000 = −200.00
    assert.equal(res.body.catchUpCents, 20_000);
    assert.equal(res.body.gainLossCents, -20_000);
    const entry = (await db.collection('transactions').doc(String(res.body.transactionId)).get()).data()!;
    assert.equal(entry.date, '2026-10-05');
    assert.equal(entry.description, 'Sale of Delivery van (loss $200.00)');
    const lines = Object.fromEntries((entry.lines as Array<{ accountId: string; amountCents: number }>).map(l => [l.accountId.replace(`${ws}_`, ''), l.amountCents]));
    assert.deepEqual(lines, { depexp: 20_000, accum: 160_000, bank: 1_000_000, equipment: -1_200_000, gainloss: 20_000 });
    const v = await van();
    assert.deepEqual([v?.status, v?.disposedOn, v?.accumulatedDepreciationCents, v?.depreciatedThrough, v?.disposalGainLossCents], ['disposed', '2026-10-05', 180_000, '2026-10', -20_000]);
    assert.equal((await call('book-1', 'POST', sale)).status, 409, 'not twice');
  });

  test('undo: refused while the date is closed; then the entry is void and the van is back as it was', async () => {
    const entryId = String((await van())?.disposalTransactionId);
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-10-31' });
    assert.equal((await call('book-1', 'DELETE')).status, 409);
    await db.collection('workspaces').doc(ws).update({ lockDate: null });
    assert.equal((await call('book-1', 'DELETE')).status, 200);
    assert.equal((await db.collection('transactions').doc(entryId).get()).data()?.status, 'void');
    const v = await van();
    assert.deepEqual([v?.status, v?.accumulatedDepreciationCents, v?.depreciatedThrough, v?.disposedOn], ['active', 160_000, '2026-09', undefined]);
  });
});
