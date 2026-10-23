/**
 * EG-2 step 1 (docs/design/EG-2-payment-ledger.md): payments and later applications write one immutable
 * payment-ledger row per document. The design's worked example as far as payments go (the credit row is step 2):
 * INV-1 €1,000 at 1.10; €400 paid 10-15 at 1.12 (cleared 440.00, settled 448.00, FX +8.00); €500 paid 11-02 at
 * 1.08 (cleared 550.00, settled 540.00, FX −10.00).
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { allocationId, realizedFxFor, splitAllocations } from '../server/services/allocationLedger';

test('ids, side-normalized FX and the largest-remainder split', () => {
  assert.equal(allocationId('payment', 'p1', 'p1', 'inv1'), 'payment-p1-p1-inv1');
  assert.equal(realizedFxFor('receivable', 44000, 44800), 800);
  assert.equal(realizedFxFor('payable', 44000, 44800), -800, 'a bill paid at a higher rate is a loss');
  const rows = splitAllocations({
    allocations: [1, 1, 1].map((_, i) => ({ documentId: `d${i}`, documentType: 'invoice' as const, amountCents: 3333 })),
    side: 'receivable', currency: 'EUR', baseCurrency: 'USD', documentRate: 1.1, settlementRate: 1.1234, settledBaseCents: Math.round(9999 * 1.1234),
  });
  assert.equal(rows.reduce((s, r) => s + r.baseSettledCents, 0), Math.round(9999 * 1.1234));
  assert.equal(rows.reduce((s, r) => s + r.baseClearedCents, 0), Math.round(9999 * 1.1));
  const yen = splitAllocations({ allocations: [{ documentId: 'j', documentType: 'invoice', amountCents: 100 }], side: 'receivable', currency: 'JPY', baseCurrency: 'USD', documentRate: 0.0067, settlementRate: 0.0067, settledBaseCents: 67 });
  assert.equal(yen[0].baseClearedCents, 67, '¥100 at 0.0067 is 67 US cents (minorUnitRate)');
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_eg2_${crypto.randomBytes(4).toString('hex')}`;
  let db: import('../server/db/pgFirestore').Firestore;
  let svc: typeof import('../server/services/paymentService');
  let ledger: typeof import('../server/services/allocationLedger');
  const id = (s: string) => `${ws}_${s}`;
  const rowsOf = async (doc: string) => ledger.allocationsOf(db, null, ws, id(doc));
  const sum = (rows: Array<Record<string, number | unknown>>, k: string) => rows.reduce((s, r) => s + Number(r[k]), 0);

  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    svc = await import('../server/services/paymentService');
    ledger = await import('../server/services/allocationLedger');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'EG2', currency: 'USD', members: ['owner-1'] });
    const account = (key: string, name: string, type: string, category = '') => db.collection('chartAccounts').doc(id(key)).set({ workspaceId: ws, uid: 'owner-1', name, type, category });
    await account('bank', 'Bank', 'asset', 'Cash');
    await account('ar', 'Accounts Receivable', 'asset', 'Receivables');
    await account('ap', 'Accounts Payable', 'liability', 'Payables');
    await account('fx', 'Exchange gain/loss', 'income', 'Rounding Differences');
    await account('wht', 'Tax withheld at source', 'liability', 'Taxes');
    const invoice = (key: string, amountCents: number, rate: number) => db.collection('invoices').doc(id(key)).set({
      workspaceId: ws, uid: 'owner-1', customerId: 'acme', customerName: 'Acme', number: key, date: '2026-10-01', dueDate: '2026-10-31',
      status: 'sent', currency: 'EUR', exchangeRate: rate, amountCents, amountPaidCents: 0, arAccountId: id('ar'),
    });
    await invoice('INV-1', 100000, 1.1);
    await invoice('INV-2', 50000, 1.1);
    await invoice('INV-3a', 10001, 1.1);
    await invoice('INV-3b', 20002, 1.1);
    await invoice('INV-4', 10000, 1.1);
    await invoice('INV-5', 30000, 1.15);
    await invoice('INV-6', 30000, 1.1);
    await db.collection('bills').doc(id('B-1')).set({ workspaceId: ws, uid: 'owner-1', vendorId: 'v1', vendorName: 'Supplier', number: 'B-1', date: '2026-10-01', status: 'unpaid', amountCents: 10000, amountPaidCents: 0, apAccountId: id('ap') });
  });
  after(async () => {
    for (const table of ['paymentAllocations', 'allocationOperations', 'idempotencyKeys', 'transactions', 'payments', 'invoices', 'bills', 'chartAccounts', 'auditLogs', 'numberingSeries', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => undefined);
    }
    await db.terminate();
  });

  const receive = (date: string, amountCents: number, rate: number | undefined, allocations: Array<[string, number]>) => ({
    workspaceId: ws, uid: 'owner-1', paymentDate: date, amountCents, cashAccountId: id('bank'), customerId: 'acme', entityName: 'Acme',
    ...(rate ? { paymentExchangeRate: rate } : {}),
    allocations: allocations.map(([doc, cents]) => ({ documentId: id(doc), documentType: 'invoice' as const, amountCents: cents })),
  });

  test('the worked example: PAY-1 €400 at 1.12 (+8.00), PAY-2 €500 at 1.08 (−10.00); rows = the cache increment', async () => {
    const pay1 = await svc.createPaymentAtomic(db, receive('2026-10-15', 40000, 1.12, [['INV-1', 40000]]));
    const pay2 = await svc.createPaymentAtomic(db, receive('2026-11-02', 50000, 1.08, [['INV-1', 50000]]));
    const rows = await rowsOf('INV-1');
    assert.deepEqual(rows.map(r => [r.allocationId, r.kind, r.date, r.amountCents, r.documentRate, r.settlementRate, r.baseClearedCents, r.baseSettledCents, r.realizedFxCents]), [
      [`payment-${pay1.paymentId}-${pay1.paymentId}-${id('INV-1')}`, 'payment', '2026-10-15', 40000, 1.1, 1.12, 44000, 44800, 800],
      [`payment-${pay2.paymentId}-${pay2.paymentId}-${id('INV-1')}`, 'payment', '2026-11-02', 50000, 1.1, 1.08, 55000, 54000, -1000],
    ]);
    assert.equal(rows[0].transactionId, pay1.transactionId);
    const inv = (await db.collection('invoices').doc(id('INV-1')).get()).data();
    assert.equal(inv?.amountPaidCents, 90000, 'the additive cache is kept');
    assert.equal(sum(rows as never, 'amountCents'), inv?.amountPaidCents, 'Σ rows = the amountPaidCents increment');
    assert.equal(sum(rows as never, 'realizedFxCents'), 800 - 1000);
    assert.deepEqual((await ledger.allocationsOf(db, null, ws, id('INV-1'), { asOf: '2026-10-31' })).map(r => r.amountCents), [40000], 'as of 10-31 only PAY-1');
    assert.deepEqual((await ledger.liveAllocationsOf(db, null, ws, id('INV-1'))).map(r => r.date), ['2026-10-15', '2026-11-02']);
  });

  test('two documents at 1.10 paid at 1.1234: Σ row FX = the entry\'s FX line, odd cents', async () => {
    const pay = await svc.createPaymentAtomic(db, receive('2026-10-20', 30003, 1.1234, [['INV-3a', 10001], ['INV-3b', 20002]]));
    const rows = [...await rowsOf('INV-3a'), ...await rowsOf('INV-3b')];
    const fxLine = pay.ledgerTransaction.lines.find((l: { accountId: string }) => l.accountId === id('fx'));
    assert.equal(sum(rows as never, 'realizedFxCents'), -fxLine.amountCents, 'gain = credit on the FX line');
    assert.equal(sum(rows as never, 'baseSettledCents'), Math.round(30003 * 1.1234));
  });

  test('a retried idempotent payment writes nothing new', async () => {
    const payload = receive('2026-10-20', 10000, 1.12, [['INV-2', 10000]]);
    const first = await svc.createPaymentIdempotent(db, payload, 'op-retry');
    const again = await svc.createPaymentIdempotent(db, payload, 'op-retry');
    assert.equal(again.replayed, true);
    assert.equal(again.paymentId, first.paymentId);
    assert.equal((await rowsOf('INV-2')).length, 1);
    assert.equal((await db.collection('invoices').doc(id('INV-2')).get()).data()?.amountPaidCents, 10000);
  });

  test('withholding: a 100.00 bill settled by 90.00 cash + 10.00 withheld is one 100.00 row', async () => {
    const pay = await svc.createPaymentAtomic(db, {
      workspaceId: ws, uid: 'owner-1', paymentDate: '2026-10-11', amountCents: 10000, cashAccountId: id('bank'), vendorId: 'v1', entityName: 'Supplier',
      allocations: [{ documentId: id('B-1'), documentType: 'bill', amountCents: 10000 }], withheldCents: 1000,
    });
    assert.equal(pay.ledgerTransaction.lines.find((l: { accountId: string }) => l.accountId === id('bank')).amountCents, -9000);
    const rows = await rowsOf('B-1');
    assert.deepEqual(rows.map(r => [r.amountCents, r.baseClearedCents, r.baseSettledCents, r.realizedFxCents]), [[10000, 10000, 10000, 0]]);
  });

  test('a payment dated before the invoice is refused and writes nothing', async () => {
    await assert.rejects(svc.createPaymentAtomic(db, receive('2026-09-30', 1000, undefined, [['INV-2', 1000]])), /before INV-2's date/);
    assert.equal((await rowsOf('INV-2')).length, 1);
  });

  test('applying an advance later: dated the application day, a retry writes nothing, earlier dates and other rates refused', async () => {
    const pay = await svc.createPaymentAtomic(db, receive('2026-10-05', 60000, undefined, [['INV-4', 10000]]));
    assert.equal((await rowsOf('INV-4'))[0].settlementRate, 1.1);
    const apply = (doc: string, cents: number, date: string, operationId?: string) => svc.applyUnappliedPayment(db, {
      workspaceId: ws, uid: 'owner-1', paymentId: pay.paymentId, date, operationId, allocations: [{ documentId: id(doc), documentType: 'invoice', amountCents: cents }],
    });
    await assert.rejects(apply('INV-5', 10000, '2026-11-10'), (err: Error & { status?: number }) => err.status === 409 && /another exchange rate/.test(err.message), 'cross-rate refused in step 1');
    await assert.rejects(apply('INV-6', 10000, '2026-10-04'), /before the payment's date/);
    assert.equal((await rowsOf('INV-5')).length + (await rowsOf('INV-6')).length, 0, 'refused applications write no rows');

    const first = await apply('INV-6', 20000, '2026-11-10', 'op-apply-1');
    const again = await apply('INV-6', 20000, '2026-11-10', 'op-apply-1');
    assert.equal((again as { replayed?: boolean }).replayed, true);
    assert.equal(again.unappliedCents, first.unappliedCents);
    const rows = await rowsOf('INV-6');
    assert.deepEqual(rows.map(r => [r.allocationId, r.kind, r.date, r.amountCents, r.baseClearedCents, r.baseSettledCents, r.realizedFxCents]), [
      [`advance_application-op-apply-1-${pay.paymentId}-${id('INV-6')}`, 'advance_application', '2026-11-10', 20000, 22000, 22000, 0],
    ]);
    assert.equal((await db.collection('invoices').doc(id('INV-6')).get()).data()?.amountPaidCents, 20000);
    assert.equal((await db.collection('payments').doc(pay.paymentId).get()).data()?.unappliedCents, 30000);
    await assert.rejects(apply('INV-6', 5000, '2026-11-10', 'op-apply-1'), /Idempotency key reused/);
    await apply('INV-6', 5000, '2026-11-11', 'op-apply-2');
    assert.equal((await rowsOf('INV-6')).length, 2, 'a second, legitimate application under a new key is a new row');
  });
});
